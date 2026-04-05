import { describe, it, expect } from "bun:test";
import { Lexer } from "../../src/lexer/Lexer.ts";
import { TokenType } from "../../src/lexer/TokenType.ts";
import { DiagnosticBag } from "../../src/errors/DiagnosticBag.ts";
import type { Token } from "../../src/lexer/Token.ts";

function tokenize(src: string): Token[] {
  const bag = new DiagnosticBag();
  return new Lexer(src, bag).tokenize().filter(t => t.type !== TokenType.EOF);
}
function firstToken(src: string): Token {
  return tokenize(src)[0]!;
}
function noErrors(src: string): boolean {
  const bag = new DiagnosticBag();
  new Lexer(src, bag).tokenize();
  return !bag.hasErrors();
}

describe("Lexer - literales numéricos", () => {
  it("entero decimal", () => {
    const t = firstToken("42");
    expect(t.type).toBe(TokenType.NumericLiteral);
    expect(t.value).toBe("42");
  });

  it("decimal con separadores", () => {
    const t = firstToken("1_000_000");
    expect(t.type).toBe(TokenType.NumericLiteral);
    expect(t.value).toBe("1_000_000");
  });

  it("hexadecimal", () => {
    const t = firstToken("0xFF");
    expect(t.type).toBe(TokenType.NumericLiteral);
    expect(t.value).toBe("0xFF");
  });

  it("octal", () => {
    const t = firstToken("0o17");
    expect(t.type).toBe(TokenType.NumericLiteral);
    expect(t.value).toBe("0o17");
  });

  it("binario", () => {
    const t = firstToken("0b1010");
    expect(t.type).toBe(TokenType.NumericLiteral);
    expect(t.value).toBe("0b1010");
  });

  it("flotante con exponente", () => {
    const t = firstToken("1.5e-3");
    expect(t.type).toBe(TokenType.NumericLiteral);
    expect(t.value).toBe("1.5e-3");
  });

  it("bigint", () => {
    const t = firstToken("42n");
    expect(t.type).toBe(TokenType.BigIntLiteral);
    expect(t.value).toBe("42n");
  });

  it("bigint hexadecimal", () => {
    const t = firstToken("0xFFn");
    expect(t.type).toBe(TokenType.BigIntLiteral);
  });
});

describe("Lexer - strings", () => {
  it("string con comillas dobles", () => {
    const t = firstToken('"hello world"');
    expect(t.type).toBe(TokenType.StringLiteral);
    expect(t.value).toBe('"hello world"');
  });

  it("string con comillas simples", () => {
    const t = firstToken("'TypeScript'");
    expect(t.type).toBe(TokenType.StringLiteral);
  });

  it("string vacío", () => {
    const t = firstToken('""');
    expect(t.type).toBe(TokenType.StringLiteral);
    expect(t.value).toBe('""');
  });

  it("string con escape", () => {
    const t = firstToken('"hello\\nworld"');
    expect(t.type).toBe(TokenType.StringLiteral);
  });

  it("string con escape unicode", () => {
    expect(noErrors('"\\u0041"')).toBe(true);
    expect(noErrors('"\\u{1F600}"')).toBe(true);
  });

  it("string no terminado emite diagnóstico", () => {
    const bag = new DiagnosticBag();
    new Lexer('"sin terminar', bag).tokenize();
    expect(bag.hasErrors()).toBe(true);
  });
});

describe("Lexer - template literals", () => {
  it("template sin interpolación", () => {
    const toks = tokenize("`hola mundo`");
    expect(toks[0]!.type).toBe(TokenType.NoSubstitutionTemplate);
  });

  it("template con interpolación (head)", () => {
    const toks = tokenize("`hola ${ ");
    expect(toks[0]!.type).toBe(TokenType.TemplateHead);
  });

  it("template no terminado emite diagnóstico", () => {
    const bag = new DiagnosticBag();
    new Lexer("`sin terminar", bag).tokenize();
    expect(bag.hasErrors()).toBe(true);
  });
});

describe("Lexer - regex", () => {
  it("regex simple (al inicio del archivo → regex permitido)", () => {
    const bag = new DiagnosticBag();
    const lexer = new Lexer("/hello/g", bag);
    lexer.setRegexAllowed(true);
    const tok = lexer.nextToken();
    expect(tok.type).toBe(TokenType.RegexLiteral);
    expect(tok.value).toBe("/hello/g");
  });

  it("regex con flags múltiples", () => {
    const bag = new DiagnosticBag();
    const lexer = new Lexer("/^test$/gim", bag);
    lexer.setRegexAllowed(true);
    const tok = lexer.nextToken();
    expect(tok.type).toBe(TokenType.RegexLiteral);
  });
});
