import { describe, it, expect } from "bun:test";
import { Lexer } from "../../src/lexer/Lexer.ts";
import { Parser } from "../../src/parser/Parser.ts";
import { SemanticAnalyzer } from "../../src/semantic/SemanticAnalyzer.ts";
import { DiagnosticBag } from "../../src/errors/DiagnosticBag.ts";
import { DiagnosticSeverity } from "../../src/errors/Diagnostic.ts";

function check(src: string) {
  const bag = new DiagnosticBag();
  const lexer = new Lexer(src, bag);
  const parser = new Parser(lexer, bag);
  const ast = parser.parseSourceFile("<test>", src);
  new SemanticAnalyzer(bag).analyze(ast);
  return {
    errors: bag.getErrors(),
    all: bag.getAll(),
    hasError: (code: number) => bag.getErrors().some(d => d.message.code === code),
    errorCount: bag.errorCount,
  };
}

describe("Semántico - variables no declaradas", () => {
  it("detecta uso de variable no declarada", () => {
    const { hasError } = check("console.log(variableInexistente);");
    expect(hasError(3001)).toBe(true);
  });

  it("no reporta error para variables declaradas", () => {
    const { errorCount } = check("const x = 1; console.log(x);");
    expect(errorCount).toBe(0);
  });

  it("no reporta error para globales (console, Math, etc.)", () => {
    const { hasError } = check("console.log(Math.PI);");
    expect(hasError(3001)).toBe(false);
  });
});

describe("Semántico - identificadores duplicados", () => {
  it("detecta const duplicado", () => {
    const { hasError } = check("const x = 1;\nconst x = 2;");
    expect(hasError(3002)).toBe(true);
  });

  it("no reporta error para variables en scopes diferentes", () => {
    const src = `
      const x = 1;
      function foo() {
        const x = 2;
      }
    `;
    const { hasError } = check(src);
    expect(hasError(3002)).toBe(false);
  });
});

describe("Semántico - reasignación de const", () => {
  it("detecta reasignación de constante", () => {
    const { hasError } = check("const PI = 3.14;\nPI = 3;");
    expect(hasError(3007)).toBe(true);
  });

  it("no reporta error para let", () => {
    const { hasError } = check("let x = 1;\nx = 2;");
    expect(hasError(3007)).toBe(false);
  });
});

describe("Semántico - funciones", () => {
  it("no reporta error para llamadas a funciones declaradas", () => {
    const src = `
      function greet(name: string): string {
        return "Hello, " + name;
      }
      greet("world");
    `;
    const { errorCount } = check(src);
    expect(errorCount).toBe(0);
  });

  it("detecta llamada a función no declarada", () => {
    const { hasError } = check("funcionInexistente();");
    expect(hasError(3001)).toBe(true);
  });
});
