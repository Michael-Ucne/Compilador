import { describe, it, expect } from "bun:test";
import { Lexer } from "../../src/lexer/Lexer.ts";
import { TokenType } from "../../src/lexer/TokenType.ts";
import { DiagnosticBag } from "../../src/errors/DiagnosticBag.ts";

function types(src: string): TokenType[] {
  const bag = new DiagnosticBag();
  return new Lexer(src, bag)
    .tokenize()
    .filter(t => t.type !== TokenType.EOF)
    .map(t => t.type);
}

describe("Lexer - operadores de asignación", () => {
  it("= += -= *= /= %= **=", () => {
    expect(types("= += -= *= /= %= **=")).toEqual([
      TokenType.Equals,
      TokenType.PlusEquals,
      TokenType.MinusEquals,
      TokenType.AsteriskEquals,
      TokenType.SlashEquals,
      TokenType.PercentEquals,
      TokenType.AsteriskAsteriskEquals,
    ]);
  });

  it("&&= ||= ??=", () => {
    expect(types("&&= ||= ??=")).toEqual([
      TokenType.AmpersandAmpersandEquals,
      TokenType.BarBarEquals,
      TokenType.QuestionQuestionEquals,
    ]);
  });

  it("<<= >>= >>>=", () => {
    expect(types("<<= >>= >>>=")).toEqual([
      TokenType.LessThanLessThanEquals,
      TokenType.GreaterThanGreaterThanEquals,
      TokenType.GreaterThanGreaterThanGreaterThanEquals,
    ]);
  });
});

describe("Lexer - operadores de comparación", () => {
  it("== === != !==", () => {
    expect(types("== === != !==")).toEqual([
      TokenType.EqualsEquals,
      TokenType.EqualsEqualsEquals,
      TokenType.ExclamationEquals,
      TokenType.ExclamationEqualsEquals,
    ]);
  });

  it("< <= > >=", () => {
    expect(types("< <= > >=")).toEqual([
      TokenType.LessThan,
      TokenType.LessThanEquals,
      TokenType.GreaterThan,
      TokenType.GreaterThanEquals,
    ]);
  });
});

describe("Lexer - operadores aritméticos", () => {
  it("+ - * / % **", () => {
    expect(types("+ - * / % **")).toEqual([
      TokenType.Plus,
      TokenType.Minus,
      TokenType.Asterisk,
      TokenType.Slash,
      TokenType.Percent,
      TokenType.AsteriskAsterisk,
    ]);
  });

  it("++ --", () => {
    expect(types("++ --")).toEqual([
      TokenType.PlusPlus,
      TokenType.MinusMinus,
    ]);
  });
});

describe("Lexer - operadores lógicos y bit a bit", () => {
  it("&& || !", () => {
    expect(types("&& || !")).toEqual([
      TokenType.AmpersandAmpersand,
      TokenType.BarBar,
      TokenType.Exclamation,
    ]);
  });

  it("& | ^ ~", () => {
    expect(types("& | ^ ~")).toEqual([
      TokenType.Ampersand,
      TokenType.Bar,
      TokenType.Caret,
      TokenType.Tilde,
    ]);
  });

  it("<< >> >>>", () => {
    expect(types("<< >> >>>")).toEqual([
      TokenType.LessThanLessThan,
      TokenType.GreaterThanGreaterThan,
      TokenType.GreaterThanGreaterThanGreaterThan,
    ]);
  });
});

describe("Lexer - operadores TypeScript específicos", () => {
  it("=> (arrow)", () => {
    expect(types("=>")).toEqual([TokenType.EqualsGreaterThan]);
  });

  it("?. (optional chaining)", () => {
    expect(types("?.")).toEqual([TokenType.QuestionDot]);
  });

  it("?? (nullish coalescing)", () => {
    expect(types("??")).toEqual([TokenType.QuestionQuestion]);
  });

  it("? : (ternario)", () => {
    expect(types("? :")).toEqual([TokenType.Question, TokenType.Colon]);
  });

  it("max-munch: >>= no es >= seguido de >", () => {
    expect(types(">>=")).toEqual([TokenType.GreaterThanGreaterThanEquals]);
  });

  it("max-munch: === no es == seguido de =", () => {
    expect(types("===")).toEqual([TokenType.EqualsEqualsEquals]);
  });
});
