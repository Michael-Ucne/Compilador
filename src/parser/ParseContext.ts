import { Lexer } from "../lexer/Lexer.ts";
import { TokenType } from "../lexer/TokenType.ts";
import type { Token } from "../lexer/Token.ts";
import type { DiagnosticBag } from "../errors/DiagnosticBag.ts";
import { Diagnostics } from "../errors/Diagnostic.ts";
import type { Node } from "../ast/Node.ts";

// Tamaño del buffer circular de lookahead
const LOOKAHEAD_SIZE = 8;

/**
 * Gestiona el buffer de lookahead, el consumo de tokens y el
 * backtracking especulativo (tryParse).
 */
export class ParseContext {
  private readonly lexer: Lexer;
  private readonly diagnostics: DiagnosticBag;
  private readonly buffer: Token[] = new Array(LOOKAHEAD_SIZE);
  private head = 0;   // índice del token actual
  private size = 0;   // cuántos tokens hay en el buffer

  constructor(lexer: Lexer, diagnostics: DiagnosticBag) {
    this.lexer = lexer;
    this.diagnostics = diagnostics;
    // pre-carga el primer token
    this.fill(1);
  }

  private fill(needed: number): void {
    while (this.size < needed) {
      const idx = (this.head + this.size) % LOOKAHEAD_SIZE;
      this.buffer[idx] = this.lexer.nextToken();
      this.size++;
    }
  }

  /** Token en la posición `offset` desde el actual (0 = actual, 1 = siguiente...) */
  peek(offset = 0): Token {
    this.fill(offset + 1);
    const idx = (this.head + offset) % LOOKAHEAD_SIZE;
    return this.buffer[idx]!;
  }

  /** Token actual */
  current(): Token {
    return this.peek(0);
  }

  /** Tipo del token actual */
  currentType(): TokenType {
    return this.current().type;
  }

  /** Consume y devuelve el token actual */
  consume(): Token {
    this.fill(1);
    const tok = this.buffer[this.head % LOOKAHEAD_SIZE]!;
    this.head = (this.head + 1) % LOOKAHEAD_SIZE;
    this.size--;

    // Informa al lexer si el siguiente '/' puede ser regex
    this.lexer.setRegexAllowed(isRegexAllowedAfter(tok.type));

    return tok;
  }

  /** Consume si el tipo coincide, de lo contrario emite un diagnóstico y devuelve un token sintético */
  expect(type: TokenType): Token {
    if (this.currentType() === type) {
      return this.consume();
    }
    const cur = this.current();
    this.diagnostics.add(
      Diagnostics.Expected,
      cur.span,
      "<source>",
      tokenTypeName(type),
    );
    // Token sintético para continuar el parse
    return { type, value: "", span: cur.span };
  }

  /** Consume si el tipo coincide; devuelve el token o undefined */
  expectOptional(type: TokenType): Token | undefined {
    if (this.currentType() === type) {
      return this.consume();
    }
    return undefined;
  }

  /** true si el tipo actual coincide con alguno de los dados */
  match(...types: TokenType[]): boolean {
    const cur = this.currentType();
    return types.some((t) => t === cur);
  }

  /** Consume si coincide; true si se consumió */
  tryConsume(type: TokenType): boolean {
    if (this.currentType() === type) {
      this.consume();
      return true;
    }
    return false;
  }

  isEOF(): boolean {
    return this.currentType() === TokenType.EOF;
  }

  /**
   * Ejecuta `fn` de forma especulativa.
   * Si `fn` retorna `undefined`, deshace el avance del lexer (backtracking).
   * Si retorna un valor, acepta los tokens consumidos.
   *
   * Nota: el backtracking en lexers pull es costoso; usamos save/restore de
   * posición. Dado que el lexer es un objeto con estado interno, guardamos
   * la posición del buffer de lookahead y la restauramos.
   */
  tryParse<T>(fn: () => T | undefined): T | undefined {
    // Snapshot del estado del buffer y del lexer
    const savedHead = this.head;
    const savedSize = this.size;
    const savedBuffer = [...this.buffer];
    const savedLexer = this.lexer.saveState();
    const diagCheckpoint = this.diagnostics.beginSpeculation();

    const result = fn();

    if (result === undefined) {
      // Restaurar tokens y posición del lexer
      this.head = savedHead;
      this.size = savedSize;
      for (let i = 0; i < savedBuffer.length; i++) {
        this.buffer[i] = savedBuffer[i]!;
      }
      this.lexer.restoreState(savedLexer);
      // Descartar diagnósticos emitidos durante la especulación
      this.diagnostics.endSpeculation(diagCheckpoint, false);
      return undefined;
    }

    this.diagnostics.endSpeculation(diagCheckpoint, true);
    return result;
  }

  /** Posición de inicio del nodo que se va a construir */
  getNodeStart(): number {
    return this.current().span.start.offset;
  }

  /** Completa un nodo parcial asignando start/end y kind */
  finish<T extends Node>(partial: Omit<T, "start" | "end">, start: number): T {
    const end = this.peek(-1 + this.size > 0 ? -1 : 0)?.span.end.offset ?? start;
    return { ...partial, start, end } as T;
  }

  /** Crea un nodo con start/end explícitos */
  node<T extends Node>(partial: Omit<T, "start" | "end">, start: number, end: number): T {
    return { ...partial, start, end } as T;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Determina si '/' puede comenzar un regex después del token `t`.
 * Regla: regex es posible después de operadores, '{', '(', '[', ',', ';',
 * 'return', 'typeof', 'in', 'instanceof', 'new', 'delete', 'void', 'throw',
 * 'case', y al inicio del archivo.
 */
function isRegexAllowedAfter(t: TokenType): boolean {
  switch (t) {
    // Tokens después de los cuales '/' NO puede ser regex
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
    // Operadores de asignación compuestos
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
    case TokenType.Equals:
      return false;
    default:
      return true;
  }
}

function tokenTypeName(t: TokenType): string {
  const names: Partial<Record<TokenType, string>> = {
    [TokenType.Semicolon]: ";",
    [TokenType.Colon]: ":",
    [TokenType.Comma]: ",",
    [TokenType.Dot]: ".",
    [TokenType.OpenParen]: "(",
    [TokenType.CloseParen]: ")",
    [TokenType.OpenBracket]: "[",
    [TokenType.CloseBracket]: "]",
    [TokenType.OpenBrace]: "{",
    [TokenType.CloseBrace]: "}",
    [TokenType.EqualsGreaterThan]: "=>",
    [TokenType.Equals]: "=",
    [TokenType.LessThan]: "<",
    [TokenType.GreaterThan]: ">",
    [TokenType.Identifier]: "identifier",
    [TokenType.EOF]: "end of file",
  };
  return names[t] ?? `token(${t})`;
}
