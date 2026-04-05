import { describe, it, expect } from "bun:test";
import { Lexer } from "../../src/lexer/Lexer.ts";
import { TokenType } from "../../src/lexer/TokenType.ts";
import { DiagnosticBag } from "../../src/errors/DiagnosticBag.ts";
import type { Token } from "../../src/lexer/Token.ts";

function tokenize(src: string): Token[] {
  const bag = new DiagnosticBag();
  return new Lexer(src, bag).tokenize().filter(t => t.type !== TokenType.EOF);
}

function types(src: string): TokenType[] {
  return tokenize(src).map(t => t.type);
}

function values(src: string): string[] {
  return tokenize(src).map(t => t.value);
}

describe("Lexer - palabras clave", () => {
  it("reconoce palabras clave de tipos", () => {
    expect(types("any number boolean string void never unknown")).toEqual([
      TokenType.AnyKeyword,
      TokenType.NumberKeyword,
      TokenType.BooleanKeyword,
      TokenType.StringKeyword,
      TokenType.VoidKeyword,
      TokenType.NeverKeyword,
      TokenType.UnknownKeyword,
    ]);
  });

  it("reconoce palabras clave de declaración", () => {
    expect(types("const let var function class interface enum type")).toEqual([
      TokenType.ConstKeyword,
      TokenType.LetKeyword,
      TokenType.VarKeyword,
      TokenType.FunctionKeyword,
      TokenType.ClassKeyword,
      TokenType.InterfaceKeyword,
      TokenType.EnumKeyword,
      TokenType.TypeKeyword,
    ]);
  });

  it("reconoce palabras clave de control de flujo", () => {
    expect(types("if else while for return break continue throw try catch finally")).toEqual([
      TokenType.IfKeyword,
      TokenType.ElseKeyword,
      TokenType.WhileKeyword,
      TokenType.ForKeyword,
      TokenType.ReturnKeyword,
      TokenType.BreakKeyword,
      TokenType.ContinueKeyword,
      TokenType.ThrowKeyword,
      TokenType.TryKeyword,
      TokenType.CatchKeyword,
      TokenType.FinallyKeyword,
    ]);
  });

  it("reconoce palabras clave TypeScript específicas", () => {
    expect(types("abstract override readonly implements extends keyof satisfies")).toEqual([
      TokenType.AbstractKeyword,
      TokenType.OverrideKeyword,
      TokenType.ReadonlyKeyword,
      TokenType.ImplementsKeyword,
      TokenType.ExtendsKeyword,
      TokenType.KeyofKeyword,
      TokenType.SatisfiesKeyword,
    ]);
  });

  it("reconoce modificadores de acceso", () => {
    expect(types("public private protected static")).toEqual([
      TokenType.PublicKeyword,
      TokenType.PrivateKeyword,
      TokenType.ProtectedKeyword,
      TokenType.StaticKeyword,
    ]);
  });

  it("reconoce true, false, null", () => {
    expect(types("true false null")).toEqual([
      TokenType.TrueKeyword,
      TokenType.FalseKeyword,
      TokenType.NullKeyword,
    ]);
  });
});

describe("Lexer - identificadores", () => {
  it("reconoce identificadores simples", () => {
    expect(types("foo bar baz")).toEqual([
      TokenType.Identifier,
      TokenType.Identifier,
      TokenType.Identifier,
    ]);
    expect(values("foo bar baz")).toEqual(["foo", "bar", "baz"]);
  });

  it("distingue identificadores de keywords", () => {
    expect(types("myConst constName")).toEqual([
      TokenType.Identifier,
      TokenType.Identifier,
    ]);
  });

  it("reconoce identificadores con $ y _", () => {
    expect(types("$var _name __proto__")).toEqual([
      TokenType.Identifier,
      TokenType.Identifier,
      TokenType.Identifier,
    ]);
  });
});

describe("Lexer - puntuación", () => {
  it("reconoce todos los símbolos de puntuación", () => {
    expect(types("( ) [ ] { } ; , . @ #")).toEqual([
      TokenType.OpenParen,
      TokenType.CloseParen,
      TokenType.OpenBracket,
      TokenType.CloseBracket,
      TokenType.OpenBrace,
      TokenType.CloseBrace,
      TokenType.Semicolon,
      TokenType.Comma,
      TokenType.Dot,
      TokenType.At,
      TokenType.Hash,
    ]);
  });

  it("reconoce ...", () => {
    expect(types("...args")).toEqual([TokenType.DotDotDot, TokenType.Identifier]);
  });
});

describe("Lexer - posición", () => {
  it("registra línea y columna correctamente", () => {
    const toks = tokenize("  foo");
    expect(toks[0]!.span.start.line).toBe(1);
    expect(toks[0]!.span.start.column).toBe(2);
  });

  it("incrementa la línea en newlines", () => {
    const toks = tokenize("a\nb");
    expect(toks[0]!.span.start.line).toBe(1);
    expect(toks[1]!.span.start.line).toBe(2);
    expect(toks[1]!.span.start.column).toBe(0);
  });

  it("calcula el offset correctamente", () => {
    const toks = tokenize("abc def");
    expect(toks[0]!.span.start.offset).toBe(0);
    expect(toks[1]!.span.start.offset).toBe(4);
  });
});
