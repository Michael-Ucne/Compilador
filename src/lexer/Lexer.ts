import { type Span, type Position, Diagnostics } from "../errors/index.ts";
import type { DiagnosticBag } from "../errors/DiagnosticBag.ts";
import { type Token } from "./Token.ts";
import { TokenType } from "./TokenType.ts";
import { KEYWORDS } from "./keywords.ts";

// ── Utilidades de caracteres ─────────────────────────────────────────────────

function isAsciiLetter(ch: number): boolean {
  return (ch >= 0x41 && ch <= 0x5a) || (ch >= 0x61 && ch <= 0x7a);
}
function isAsciiDigit(ch: number): boolean {
  return ch >= 0x30 && ch <= 0x39;
}
function isHexDigit(ch: number): boolean {
  return (
    isAsciiDigit(ch) ||
    (ch >= 0x41 && ch <= 0x46) ||
    (ch >= 0x61 && ch <= 0x66)
  );
}
function isOctalDigit(ch: number): boolean {
  return ch >= 0x30 && ch <= 0x37;
}
function isBinaryDigit(ch: number): boolean {
  return ch === 0x30 || ch === 0x31;
}
function isLineBreak(ch: number): boolean {
  return ch === 0x0a || ch === 0x0d || ch === 0x2028 || ch === 0x2029;
}
function isWhitespace(ch: number): boolean {
  return (
    ch === 0x20 || ch === 0x09 || ch === 0x0b || ch === 0x0c || ch === 0xa0
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export class Lexer {
  private readonly source: string;
  private pos: number = 0;
  private line: number = 1;
  private col: number = 0;
  private readonly diagnostics: DiagnosticBag;

  /** El parser llama esto para indicar si '/' puede iniciar un regex */
  private regexAllowed: boolean = true;

  /** Stack para template literals anidados: profundidad de '${...}' */
  private readonly templateStack: number[] = [];

  constructor(source: string, diagnostics: DiagnosticBag) {
    this.source = source;
    this.diagnostics = diagnostics;
  }

  setRegexAllowed(allowed: boolean): void {
    this.regexAllowed = allowed;
  }

  saveState(): { pos: number; line: number; col: number; regexAllowed: boolean; templateStack: number[] } {
    return { pos: this.pos, line: this.line, col: this.col, regexAllowed: this.regexAllowed, templateStack: [...this.templateStack] };
  }

  restoreState(state: { pos: number; line: number; col: number; regexAllowed: boolean; templateStack: number[] }): void {
    this.pos = state.pos;
    this.line = state.line;
    this.col = state.col;
    this.regexAllowed = state.regexAllowed;
    this.templateStack.length = 0;
    this.templateStack.push(...state.templateStack);
  }

  // ── API pública ──────────────────────────────────────────────────────────────

  /** Lee todos los tokens de una vez (incluyendo trivia) */
  tokenize(): Token[] {
    const tokens: Token[] = [];
    let tok: Token;
    do {
      tok = this.nextToken();
      tokens.push(tok);
    } while (tok.type !== TokenType.EOF);
    return tokens;
  }

  /** Avanza y devuelve el siguiente token significativo (salta trivia) */
  nextToken(): Token {
    this.skipTrivia();
    if (this.pos >= this.source.length) {
      return this.makeToken(TokenType.EOF, this.makePosition(), this.makePosition(), "");
    }
    const tok = this.scanToken();
    // Auto-actualizar regexAllowed basado en el token emitido
    // (solo si el parser no lo está controlando externamente)
    this.regexAllowed = isRegexAllowedAfterToken(tok.type);
    return tok;
  }

  // ── Trivia ───────────────────────────────────────────────────────────────────

  private skipTrivia(): void {
    while (this.pos < this.source.length) {
      const ch = this.charCodeAt(this.pos);
      if (isWhitespace(ch)) {
        this.advance();
      } else if (isLineBreak(ch)) {
        this.advanceLine(ch);
      } else if (ch === 0x2f) {
        // '/'
        const next = this.charCodeAt(this.pos + 1);
        if (next === 0x2f) {
          // '//' single-line comment
          this.skipSingleLineComment();
        } else if (next === 0x2a) {
          // '/*' multi-line comment
          this.skipMultiLineComment();
        } else {
          break;
        }
      } else {
        break;
      }
    }
  }

  private skipSingleLineComment(): void {
    while (this.pos < this.source.length && !isLineBreak(this.charCodeAt(this.pos))) {
      this.pos++;
      this.col++;
    }
  }

  private skipMultiLineComment(): void {
    const start = this.makePosition();
    this.pos += 2; // skip '/*'
    this.col += 2;
    while (this.pos < this.source.length) {
      const ch = this.charCodeAt(this.pos);
      if (ch === 0x2a && this.charCodeAt(this.pos + 1) === 0x2f) {
        // '*/'
        this.pos += 2;
        this.col += 2;
        return;
      }
      if (isLineBreak(ch)) {
        this.advanceLine(ch);
      } else {
        this.pos++;
        this.col++;
      }
    }
    // EOF sin cerrar
    this.diagnostics.add(Diagnostics.UnterminatedMultiLineComment, {
      start,
      end: this.makePosition(),
    }, "<source>");
  }

  // ── Scanner principal ────────────────────────────────────────────────────────

  private scanToken(): Token {
    const start = this.makePosition();
    const ch = this.charCodeAt(this.pos);

    // ── Identificadores y palabras clave ──
    if (ch === 0x5f || ch === 0x24 || isAsciiLetter(ch)) {
      return this.scanIdentifierOrKeyword(start);
    }

    // ── Unicode identifier start ──
    if (ch > 127) {
      if (this.isUnicodeIdStart(ch)) {
        return this.scanIdentifierOrKeyword(start);
      }
    }

    // ── Dígitos ──
    if (isAsciiDigit(ch)) {
      return this.scanNumericLiteral(start);
    }

    // ── Punto (puede ser ... o .42) ──
    if (ch === 0x2e) {
      if (this.charCodeAt(this.pos + 1) === 0x2e && this.charCodeAt(this.pos + 2) === 0x2e) {
        this.pos += 3; this.col += 3;
        return this.makeToken(TokenType.DotDotDot, start, this.makePosition(), "...");
      }
      if (isAsciiDigit(this.charCodeAt(this.pos + 1))) {
        return this.scanNumericLiteral(start);
      }
      this.pos++; this.col++;
      return this.makeToken(TokenType.Dot, start, this.makePosition(), ".");
    }

    // ── Strings ──
    if (ch === 0x22 || ch === 0x27) {
      return this.scanStringLiteral(start, ch);
    }

    // ── Template literals ──
    if (ch === 0x60) {
      return this.scanTemplateHead(start);
    }

    // ── Regex o slash ──
    if (ch === 0x2f) {
      if (this.regexAllowed) {
        return this.scanRegexLiteral(start);
      }
      return this.scanSlashOperator(start);
    }

    // ── Operadores y puntuación ──
    return this.scanOperatorOrPunctuation(start, ch);
  }

  // ── Identificadores ──────────────────────────────────────────────────────────

  private scanIdentifierOrKeyword(start: Position): Token {
    const begin = this.pos;
    while (this.pos < this.source.length) {
      const ch = this.charCodeAt(this.pos);
      if (
        ch === 0x5f ||
        ch === 0x24 ||
        isAsciiLetter(ch) ||
        isAsciiDigit(ch) ||
        (ch > 127 && this.isUnicodeIdContinue(ch))
      ) {
        this.pos++;
        this.col++;
      } else {
        break;
      }
    }
    const text = this.source.slice(begin, this.pos);
    const end = this.makePosition();
    const kwType = KEYWORDS.get(text);
    if (kwType !== undefined) {
      return this.makeToken(kwType, start, end, text);
    }
    return this.makeToken(TokenType.Identifier, start, end, text);
  }

  private isUnicodeIdStart(ch: number): boolean {
    // Para el hot path limitamos a Latin Extended y comunes
    // El rango U+00C0–U+02AF cubre la mayoría de letras extendidas latinas
    if (ch >= 0xc0 && ch <= 0x02af) return true;
    // Para el resto usamos la API de regex de V8/Bun
    try {
      return /^\p{ID_Start}$/u.test(String.fromCodePoint(ch));
    } catch {
      return false;
    }
  }

  private isUnicodeIdContinue(ch: number): boolean {
    if (ch >= 0xc0 && ch <= 0x02af) return true;
    try {
      return /^\p{ID_Continue}$/u.test(String.fromCodePoint(ch));
    } catch {
      return false;
    }
  }

  // ── Numéricos ────────────────────────────────────────────────────────────────

  private scanNumericLiteral(start: Position): Token {
    const begin = this.pos;
    let type = TokenType.NumericLiteral;

    if (this.charCodeAt(this.pos) === 0x30) {
      const next = this.charCodeAt(this.pos + 1);

      // Hexadecimal: 0x / 0X
      if (next === 0x78 || next === 0x58) {
        this.pos += 2; this.col += 2;
        const digitStart = this.pos;
        while (this.pos < this.source.length) {
          const ch = this.charCodeAt(this.pos);
          if (isHexDigit(ch) || ch === 0x5f) { this.pos++; this.col++; }
          else break;
        }
        if (this.pos === digitStart) {
          this.diagnostics.add(Diagnostics.InvalidNumericLiteral, { start, end: this.makePosition() }, "<source>");
        }
        if (this.charCodeAt(this.pos) === 0x6e) { // 'n' BigInt
          this.pos++; this.col++;
          type = TokenType.BigIntLiteral;
        }
        return this.makeToken(type, start, this.makePosition(), this.source.slice(begin, this.pos));
      }

      // Octal: 0o / 0O
      if (next === 0x6f || next === 0x4f) {
        this.pos += 2; this.col += 2;
        const digitStart = this.pos;
        while (this.pos < this.source.length) {
          const ch = this.charCodeAt(this.pos);
          if (isOctalDigit(ch) || ch === 0x5f) { this.pos++; this.col++; }
          else if (isAsciiDigit(ch)) {
            this.diagnostics.add(Diagnostics.InvalidOctalLiteral, { start, end: this.makePosition() }, "<source>");
            this.pos++; this.col++;
          } else break;
        }
        if (this.pos === digitStart) {
          this.diagnostics.add(Diagnostics.InvalidNumericLiteral, { start, end: this.makePosition() }, "<source>");
        }
        if (this.charCodeAt(this.pos) === 0x6e) { this.pos++; this.col++; type = TokenType.BigIntLiteral; }
        return this.makeToken(type, start, this.makePosition(), this.source.slice(begin, this.pos));
      }

      // Binario: 0b / 0B
      if (next === 0x62 || next === 0x42) {
        this.pos += 2; this.col += 2;
        const digitStart = this.pos;
        while (this.pos < this.source.length) {
          const ch = this.charCodeAt(this.pos);
          if (isBinaryDigit(ch) || ch === 0x5f) { this.pos++; this.col++; }
          else if (isAsciiDigit(ch)) {
            this.diagnostics.add(Diagnostics.InvalidBinaryLiteral, { start, end: this.makePosition() }, "<source>");
            this.pos++; this.col++;
          } else break;
        }
        if (this.pos === digitStart) {
          this.diagnostics.add(Diagnostics.InvalidNumericLiteral, { start, end: this.makePosition() }, "<source>");
        }
        if (this.charCodeAt(this.pos) === 0x6e) { this.pos++; this.col++; type = TokenType.BigIntLiteral; }
        return this.makeToken(type, start, this.makePosition(), this.source.slice(begin, this.pos));
      }
    }

    // Decimal (incluyendo .5, 1_000_000, 1e10, 1.5e-3)
    while (this.pos < this.source.length) {
      const ch = this.charCodeAt(this.pos);
      if (isAsciiDigit(ch) || ch === 0x5f) { this.pos++; this.col++; }
      else break;
    }

    // Parte decimal
    if (this.charCodeAt(this.pos) === 0x2e && isAsciiDigit(this.charCodeAt(this.pos + 1))) {
      this.pos++; this.col++; // '.'
      while (this.pos < this.source.length && (isAsciiDigit(this.charCodeAt(this.pos)) || this.charCodeAt(this.pos) === 0x5f)) {
        this.pos++; this.col++;
      }
    }

    // Exponente
    const expCh = this.charCodeAt(this.pos);
    if (expCh === 0x65 || expCh === 0x45) { // 'e' 'E'
      this.pos++; this.col++;
      const signCh = this.charCodeAt(this.pos);
      if (signCh === 0x2b || signCh === 0x2d) { this.pos++; this.col++; }
      while (this.pos < this.source.length && isAsciiDigit(this.charCodeAt(this.pos))) {
        this.pos++; this.col++;
      }
    }

    // BigInt suffix
    if (this.charCodeAt(this.pos) === 0x6e) {
      this.pos++; this.col++;
      type = TokenType.BigIntLiteral;
    }

    return this.makeToken(type, start, this.makePosition(), this.source.slice(begin, this.pos));
  }

  // ── Strings ──────────────────────────────────────────────────────────────────

  private scanStringLiteral(start: Position, quote: number): Token {
    const begin = this.pos;
    this.pos++; this.col++; // opening quote
    while (this.pos < this.source.length) {
      const ch = this.charCodeAt(this.pos);
      if (ch === quote) {
        this.pos++; this.col++;
        break;
      }
      if (isLineBreak(ch)) {
        // string no terminado en esta línea
        this.diagnostics.add(Diagnostics.UnterminatedStringLiteral, { start, end: this.makePosition() }, "<source>");
        break;
      }
      if (ch === 0x5c) {
        // backslash escape
        this.pos++; this.col++;
        this.scanEscapeSequence(start);
      } else {
        this.pos++; this.col++;
      }
    }
    if (this.pos >= this.source.length && this.charCodeAt(this.pos - 1) !== quote) {
      this.diagnostics.add(Diagnostics.UnterminatedStringLiteral, { start, end: this.makePosition() }, "<source>");
    }
    return this.makeToken(TokenType.StringLiteral, start, this.makePosition(), this.source.slice(begin, this.pos));
  }

  private scanEscapeSequence(errorStart: Position): void {
    if (this.pos >= this.source.length) return;
    const ch = this.charCodeAt(this.pos);
    switch (ch) {
      case 0x30: case 0x27: case 0x22: case 0x5c:
      case 0x6e: case 0x72: case 0x74: case 0x62:
      case 0x66: case 0x76: case 0x60:
        this.pos++; this.col++;
        break;
      case 0x75: // \u
        this.pos++; this.col++;
        if (this.charCodeAt(this.pos) === 0x7b) {
          // \u{XXXXXX}
          this.pos++; this.col++;
          while (this.pos < this.source.length && isHexDigit(this.charCodeAt(this.pos))) {
            this.pos++; this.col++;
          }
          if (this.charCodeAt(this.pos) === 0x7d) { this.pos++; this.col++; }
        } else {
          // \uXXXX
          for (let i = 0; i < 4 && this.pos < this.source.length; i++) {
            if (isHexDigit(this.charCodeAt(this.pos))) { this.pos++; this.col++; }
          }
        }
        break;
      case 0x78: // \xXX
        this.pos++; this.col++;
        for (let i = 0; i < 2 && this.pos < this.source.length; i++) {
          if (isHexDigit(this.charCodeAt(this.pos))) { this.pos++; this.col++; }
        }
        break;
      default:
        if (isLineBreak(ch)) {
          this.advanceLine(ch); // line continuation
        } else {
          this.pos++; this.col++;
        }
    }
  }

  // ── Template literals ────────────────────────────────────────────────────────

  private scanTemplateHead(start: Position): Token {
    const begin = this.pos;
    this.pos++; this.col++; // '`'
    while (this.pos < this.source.length) {
      const ch = this.charCodeAt(this.pos);
      if (ch === 0x60) {
        // backtick: no-substitution template
        this.pos++; this.col++;
        return this.makeToken(TokenType.NoSubstitutionTemplate, start, this.makePosition(), this.source.slice(begin, this.pos));
      }
      if (ch === 0x24 && this.charCodeAt(this.pos + 1) === 0x7b) {
        // '${': template head ends here
        this.pos += 2; this.col += 2;
        this.templateStack.push(0); // push template depth marker
        return this.makeToken(TokenType.TemplateHead, start, this.makePosition(), this.source.slice(begin, this.pos));
      }
      if (ch === 0x5c) { // backslash
        this.pos++; this.col++;
        this.scanEscapeSequence(start);
      } else if (isLineBreak(ch)) {
        this.advanceLine(ch);
      } else {
        this.pos++; this.col++;
      }
    }
    this.diagnostics.add(Diagnostics.UnterminatedTemplateLiteral, { start, end: this.makePosition() }, "<source>");
    return this.makeToken(TokenType.NoSubstitutionTemplate, start, this.makePosition(), this.source.slice(begin, this.pos));
  }

  /** Escanea el cierre de una interpolación: '}' y el resto del template */
  scanTemplateContinuation(): Token {
    const start = this.makePosition();
    const begin = this.pos;
    // Asumimos que estamos justo después del '}' que cierra la interpolación
    // El parser ya consumió el '}'; aquí escaneamos el contenido del siguiente span

    while (this.pos < this.source.length) {
      const ch = this.charCodeAt(this.pos);
      if (ch === 0x60) {
        // backtick: template tail
        this.pos++; this.col++;
        this.templateStack.pop();
        return this.makeToken(TokenType.TemplateTail, start, this.makePosition(), this.source.slice(begin, this.pos));
      }
      if (ch === 0x24 && this.charCodeAt(this.pos + 1) === 0x7b) {
        this.pos += 2; this.col += 2;
        return this.makeToken(TokenType.TemplateMiddle, start, this.makePosition(), this.source.slice(begin, this.pos));
      }
      if (ch === 0x5c) { this.pos++; this.col++; this.scanEscapeSequence(start); }
      else if (isLineBreak(ch)) { this.advanceLine(ch); }
      else { this.pos++; this.col++; }
    }
    this.diagnostics.add(Diagnostics.UnterminatedTemplateLiteral, { start, end: this.makePosition() }, "<source>");
    return this.makeToken(TokenType.TemplateTail, start, this.makePosition(), this.source.slice(begin, this.pos));
  }

  isInTemplate(): boolean {
    return this.templateStack.length > 0;
  }

  // ── Regex ────────────────────────────────────────────────────────────────────

  private scanRegexLiteral(start: Position): Token {
    const begin = this.pos;
    this.pos++; this.col++; // '/'

    let inClass = false;
    while (this.pos < this.source.length) {
      const ch = this.charCodeAt(this.pos);
      if (ch === 0x5b) { inClass = true; this.pos++; this.col++; }
      else if (ch === 0x5d) { inClass = false; this.pos++; this.col++; }
      else if (ch === 0x2f && !inClass) {
        this.pos++; this.col++;
        break;
      } else if (ch === 0x5c) {
        this.pos += 2; this.col += 2; // skip escape
      } else if (isLineBreak(ch)) {
        // regex no puede cruzar líneas
        break;
      } else {
        this.pos++; this.col++;
      }
    }

    // flags: g, i, m, s, u, v, d, y
    while (this.pos < this.source.length && isAsciiLetter(this.charCodeAt(this.pos))) {
      this.pos++; this.col++;
    }

    return this.makeToken(TokenType.RegexLiteral, start, this.makePosition(), this.source.slice(begin, this.pos));
  }

  // ── Operadores ───────────────────────────────────────────────────────────────

  private scanSlashOperator(start: Position): Token {
    this.pos++; this.col++;
    if (this.charCodeAt(this.pos) === 0x3d) { // /=
      this.pos++; this.col++;
      return this.makeToken(TokenType.SlashEquals, start, this.makePosition(), "/=");
    }
    return this.makeToken(TokenType.Slash, start, this.makePosition(), "/");
  }

  private scanOperatorOrPunctuation(start: Position, ch: number): Token {
    this.pos++; this.col++; // consume el primer carácter

    switch (ch) {
      case 0x28: return this.makeToken(TokenType.OpenParen, start, this.makePosition(), "(");
      case 0x29: return this.makeToken(TokenType.CloseParen, start, this.makePosition(), ")");
      case 0x5b: return this.makeToken(TokenType.OpenBracket, start, this.makePosition(), "[");
      case 0x5d: return this.makeToken(TokenType.CloseBracket, start, this.makePosition(), "]");
      case 0x7b: return this.makeToken(TokenType.OpenBrace, start, this.makePosition(), "{");
      case 0x7d: return this.makeToken(TokenType.CloseBrace, start, this.makePosition(), "}");
      case 0x3b: return this.makeToken(TokenType.Semicolon, start, this.makePosition(), ";");
      case 0x2c: return this.makeToken(TokenType.Comma, start, this.makePosition(), ",");
      case 0x40: return this.makeToken(TokenType.At, start, this.makePosition(), "@");
      case 0x23: return this.makeToken(TokenType.Hash, start, this.makePosition(), "#");
      case 0x3a: return this.makeToken(TokenType.Colon, start, this.makePosition(), ":");
      case 0x7e: return this.makeToken(TokenType.Tilde, start, this.makePosition(), "~");

      case 0x3d: { // = == === =>
        const n = this.charCodeAt(this.pos);
        if (n === 0x3d) {
          this.pos++; this.col++;
          if (this.charCodeAt(this.pos) === 0x3d) {
            this.pos++; this.col++;
            return this.makeToken(TokenType.EqualsEqualsEquals, start, this.makePosition(), "===");
          }
          return this.makeToken(TokenType.EqualsEquals, start, this.makePosition(), "==");
        }
        if (n === 0x3e) {
          this.pos++; this.col++;
          return this.makeToken(TokenType.EqualsGreaterThan, start, this.makePosition(), "=>");
        }
        return this.makeToken(TokenType.Equals, start, this.makePosition(), "=");
      }

      case 0x21: { // ! != !==
        if (this.charCodeAt(this.pos) === 0x3d) {
          this.pos++; this.col++;
          if (this.charCodeAt(this.pos) === 0x3d) {
            this.pos++; this.col++;
            return this.makeToken(TokenType.ExclamationEqualsEquals, start, this.makePosition(), "!==");
          }
          return this.makeToken(TokenType.ExclamationEquals, start, this.makePosition(), "!=");
        }
        return this.makeToken(TokenType.Exclamation, start, this.makePosition(), "!");
      }

      case 0x3c: { // < <= << <<=
        if (this.charCodeAt(this.pos) === 0x3d) {
          this.pos++; this.col++;
          return this.makeToken(TokenType.LessThanEquals, start, this.makePosition(), "<=");
        }
        if (this.charCodeAt(this.pos) === 0x3c) {
          this.pos++; this.col++;
          if (this.charCodeAt(this.pos) === 0x3d) {
            this.pos++; this.col++;
            return this.makeToken(TokenType.LessThanLessThanEquals, start, this.makePosition(), "<<=");
          }
          return this.makeToken(TokenType.LessThanLessThan, start, this.makePosition(), "<<");
        }
        return this.makeToken(TokenType.LessThan, start, this.makePosition(), "<");
      }

      case 0x3e: { // > >= >> >>= >>> >>>=
        if (this.charCodeAt(this.pos) === 0x3d) {
          this.pos++; this.col++;
          return this.makeToken(TokenType.GreaterThanEquals, start, this.makePosition(), ">=");
        }
        if (this.charCodeAt(this.pos) === 0x3e) {
          this.pos++; this.col++;
          if (this.charCodeAt(this.pos) === 0x3e) {
            this.pos++; this.col++;
            if (this.charCodeAt(this.pos) === 0x3d) {
              this.pos++; this.col++;
              return this.makeToken(TokenType.GreaterThanGreaterThanGreaterThanEquals, start, this.makePosition(), ">>>=");
            }
            return this.makeToken(TokenType.GreaterThanGreaterThanGreaterThan, start, this.makePosition(), ">>>");
          }
          if (this.charCodeAt(this.pos) === 0x3d) {
            this.pos++; this.col++;
            return this.makeToken(TokenType.GreaterThanGreaterThanEquals, start, this.makePosition(), ">>=");
          }
          return this.makeToken(TokenType.GreaterThanGreaterThan, start, this.makePosition(), ">>");
        }
        return this.makeToken(TokenType.GreaterThan, start, this.makePosition(), ">");
      }

      case 0x2b: { // + ++ +=
        if (this.charCodeAt(this.pos) === 0x2b) { this.pos++; this.col++; return this.makeToken(TokenType.PlusPlus, start, this.makePosition(), "++"); }
        if (this.charCodeAt(this.pos) === 0x3d) { this.pos++; this.col++; return this.makeToken(TokenType.PlusEquals, start, this.makePosition(), "+="); }
        return this.makeToken(TokenType.Plus, start, this.makePosition(), "+");
      }

      case 0x2d: { // - -- -=
        if (this.charCodeAt(this.pos) === 0x2d) { this.pos++; this.col++; return this.makeToken(TokenType.MinusMinus, start, this.makePosition(), "--"); }
        if (this.charCodeAt(this.pos) === 0x3d) { this.pos++; this.col++; return this.makeToken(TokenType.MinusEquals, start, this.makePosition(), "-="); }
        return this.makeToken(TokenType.Minus, start, this.makePosition(), "-");
      }

      case 0x2a: { // * ** *= **=
        if (this.charCodeAt(this.pos) === 0x2a) {
          this.pos++; this.col++;
          if (this.charCodeAt(this.pos) === 0x3d) { this.pos++; this.col++; return this.makeToken(TokenType.AsteriskAsteriskEquals, start, this.makePosition(), "**="); }
          return this.makeToken(TokenType.AsteriskAsterisk, start, this.makePosition(), "**");
        }
        if (this.charCodeAt(this.pos) === 0x3d) { this.pos++; this.col++; return this.makeToken(TokenType.AsteriskEquals, start, this.makePosition(), "*="); }
        return this.makeToken(TokenType.Asterisk, start, this.makePosition(), "*");
      }

      case 0x25: { // % %=
        if (this.charCodeAt(this.pos) === 0x3d) { this.pos++; this.col++; return this.makeToken(TokenType.PercentEquals, start, this.makePosition(), "%="); }
        return this.makeToken(TokenType.Percent, start, this.makePosition(), "%");
      }

      case 0x26: { // & && && &&= &=
        if (this.charCodeAt(this.pos) === 0x26) {
          this.pos++; this.col++;
          if (this.charCodeAt(this.pos) === 0x3d) { this.pos++; this.col++; return this.makeToken(TokenType.AmpersandAmpersandEquals, start, this.makePosition(), "&&="); }
          return this.makeToken(TokenType.AmpersandAmpersand, start, this.makePosition(), "&&");
        }
        if (this.charCodeAt(this.pos) === 0x3d) { this.pos++; this.col++; return this.makeToken(TokenType.AmpersandEquals, start, this.makePosition(), "&="); }
        return this.makeToken(TokenType.Ampersand, start, this.makePosition(), "&");
      }

      case 0x7c: { // | || ||= |=
        if (this.charCodeAt(this.pos) === 0x7c) {
          this.pos++; this.col++;
          if (this.charCodeAt(this.pos) === 0x3d) { this.pos++; this.col++; return this.makeToken(TokenType.BarBarEquals, start, this.makePosition(), "||="); }
          return this.makeToken(TokenType.BarBar, start, this.makePosition(), "||");
        }
        if (this.charCodeAt(this.pos) === 0x3d) { this.pos++; this.col++; return this.makeToken(TokenType.BarEquals, start, this.makePosition(), "|="); }
        return this.makeToken(TokenType.Bar, start, this.makePosition(), "|");
      }

      case 0x5e: { // ^ ^=
        if (this.charCodeAt(this.pos) === 0x3d) { this.pos++; this.col++; return this.makeToken(TokenType.CaretEquals, start, this.makePosition(), "^="); }
        return this.makeToken(TokenType.Caret, start, this.makePosition(), "^");
      }

      case 0x3f: { // ? ?. ?? ??=
        if (this.charCodeAt(this.pos) === 0x2e && !isAsciiDigit(this.charCodeAt(this.pos + 1))) {
          this.pos++; this.col++;
          return this.makeToken(TokenType.QuestionDot, start, this.makePosition(), "?.");
        }
        if (this.charCodeAt(this.pos) === 0x3f) {
          this.pos++; this.col++;
          if (this.charCodeAt(this.pos) === 0x3d) { this.pos++; this.col++; return this.makeToken(TokenType.QuestionQuestionEquals, start, this.makePosition(), "??="); }
          return this.makeToken(TokenType.QuestionQuestion, start, this.makePosition(), "??");
        }
        return this.makeToken(TokenType.Question, start, this.makePosition(), "?");
      }

      default: {
        const charStr = String.fromCodePoint(ch);
        this.diagnostics.add(
          Diagnostics.UnexpectedCharacter,
          { start, end: this.makePosition() },
          "<source>",
          charStr,
        );
        return this.makeToken(TokenType.Unknown, start, this.makePosition(), charStr);
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private makePosition(): Position {
    return { line: this.line, column: this.col, offset: this.pos };
  }

  private makeToken(type: TokenType, start: Position, end: Position, value: string): Token {
    return { type, value, span: { start, end } };
  }

  private charCodeAt(index: number): number {
    return index < this.source.length ? this.source.charCodeAt(index) : 0;
  }

  private advance(): void {
    this.pos++;
    this.col++;
  }

  private advanceLine(ch: number): void {
    if (ch === 0x0d && this.charCodeAt(this.pos + 1) === 0x0a) {
      this.pos++; // CR+LF counts as one line break
    }
    this.pos++;
    this.line++;
    this.col = 0;
  }
}

/**
 * Determina si un token permite que el siguiente '/' sea un regex literal.
 * Usado por el Lexer en modo standalone (tokenize() sin parser).
 */
function isRegexAllowedAfterToken(t: TokenType): boolean {
  switch (t) {
    case TokenType.CloseParen:
    case TokenType.CloseBracket:
    case TokenType.CloseBrace:
    case TokenType.Identifier:
    case TokenType.NumericLiteral:
    case TokenType.BigIntLiteral:
    case TokenType.StringLiteral:
    case TokenType.NoSubstitutionTemplate:
    case TokenType.TemplateTail:
    case TokenType.TrueKeyword:
    case TokenType.FalseKeyword:
    case TokenType.NullKeyword:
    case TokenType.UndefinedKeyword:
    case TokenType.PlusPlus:
    case TokenType.MinusMinus:
    case TokenType.Equals:
    case TokenType.PlusEquals:
    case TokenType.MinusEquals:
    case TokenType.AsteriskEquals:
    case TokenType.SlashEquals:
    case TokenType.PercentEquals:
    case TokenType.AsteriskAsteriskEquals:
    case TokenType.LessThanLessThanEquals:
    case TokenType.GreaterThanGreaterThanEquals:
    case TokenType.GreaterThanGreaterThanGreaterThanEquals:
    case TokenType.AmpersandEquals:
    case TokenType.BarEquals:
    case TokenType.CaretEquals:
    case TokenType.AmpersandAmpersandEquals:
    case TokenType.BarBarEquals:
    case TokenType.QuestionQuestionEquals:
    // Operadores binarios simples — después de un operador aritmético,
    // el '/' siguiente es división (no regex) en modo standalone
    // Nota: en modo parser, el parser controla esto con setRegexAllowed
    case TokenType.Plus:
    case TokenType.Minus:
    case TokenType.Asterisk:
    case TokenType.AsteriskAsterisk:
    case TokenType.Percent:
    case TokenType.Slash:
    case TokenType.Ampersand:
    case TokenType.Bar:
    case TokenType.Caret:
    case TokenType.LessThan:
    case TokenType.LessThanLessThan:
    case TokenType.GreaterThan:
    case TokenType.GreaterThanGreaterThan:
    case TokenType.GreaterThanGreaterThanGreaterThan:
    case TokenType.EqualsEquals:
    case TokenType.EqualsEqualsEquals:
    case TokenType.ExclamationEquals:
    case TokenType.ExclamationEqualsEquals:
    case TokenType.LessThanEquals:
    case TokenType.GreaterThanEquals:
    case TokenType.AmpersandAmpersand:
    case TokenType.BarBar:
    case TokenType.QuestionQuestion:
    case TokenType.EqualsGreaterThan:
    case TokenType.Colon:
    case TokenType.Comma:
      return false;
    default:
      return true;
  }
}
