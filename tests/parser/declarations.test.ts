import { describe, it, expect } from "bun:test";
import { Lexer } from "../../src/lexer/Lexer.ts";
import { Parser } from "../../src/parser/Parser.ts";
import { DiagnosticBag } from "../../src/errors/DiagnosticBag.ts";
import { NodeKind } from "../../src/ast/Node.ts";
import type { SourceFile } from "../../src/ast/Declarations.ts";

function parse(src: string): { ast: SourceFile; errors: number } {
  const bag = new DiagnosticBag();
  const lexer = new Lexer(src, bag);
  const parser = new Parser(lexer, bag);
  const ast = parser.parseSourceFile("<test>", src);
  return { ast, errors: bag.errorCount };
}

describe("Parser - variables", () => {
  it("const simple", () => {
    const { ast, errors } = parse("const x = 42;");
    expect(errors).toBe(0);
    expect(ast.statements).toHaveLength(1);
    expect(ast.statements[0]!.kind).toBe(NodeKind.VariableStatement);
  });

  it("let con tipo", () => {
    const { ast, errors } = parse("let nombre: string = 'hola';");
    expect(errors).toBe(0);
    const stmt = ast.statements[0] as any;
    expect(stmt.kind).toBe(NodeKind.VariableStatement);
    expect(stmt.declarationKind).toBe("let");
    expect(stmt.declarations[0].type).toBeDefined();
  });

  it("var sin inicializador", () => {
    const { ast, errors } = parse("var x: number;");
    expect(errors).toBe(0);
  });

  it("destructuring de objeto", () => {
    const { ast, errors } = parse("const { a, b } = obj;");
    expect(errors).toBe(0);
    const decl = (ast.statements[0] as any).declarations[0];
    expect(decl.name.kind).toBe(NodeKind.ObjectBindingPattern);
  });

  it("destructuring de array", () => {
    const { ast, errors } = parse("const [x, y] = arr;");
    expect(errors).toBe(0);
    const decl = (ast.statements[0] as any).declarations[0];
    expect(decl.name.kind).toBe(NodeKind.ArrayBindingPattern);
  });
});

describe("Parser - funciones", () => {
  it("función simple", () => {
    const { ast, errors } = parse("function foo() {}");
    expect(errors).toBe(0);
    expect(ast.statements[0]!.kind).toBe(NodeKind.FunctionDeclaration);
  });

  it("función con parámetros tipados", () => {
    const { ast, errors } = parse("function add(a: number, b: number): number { return a + b; }");
    expect(errors).toBe(0);
    const fn = ast.statements[0] as any;
    expect(fn.parameters).toHaveLength(2);
    expect(fn.returnType).toBeDefined();
  });

  it("función genérica", () => {
    const { ast, errors } = parse("function identity<T>(x: T): T { return x; }");
    expect(errors).toBe(0);
    const fn = ast.statements[0] as any;
    expect(fn.typeParameters).toHaveLength(1);
  });

  it("función async", () => {
    const { ast, errors } = parse("async function fetchData(): Promise<string> { return ''; }");
    expect(errors).toBe(0);
    const fn = ast.statements[0] as any;
    expect(fn.isAsync).toBe(true);
  });

  it("función generadora", () => {
    const { ast, errors } = parse("function* gen() { yield 1; }");
    expect(errors).toBe(0);
    const fn = ast.statements[0] as any;
    expect(fn.isGenerator).toBe(true);
  });
});

describe("Parser - clases", () => {
  it("clase simple", () => {
    const { ast, errors } = parse("class Foo {}");
    expect(errors).toBe(0);
    expect(ast.statements[0]!.kind).toBe(NodeKind.ClassDeclaration);
  });

  it("clase con herencia", () => {
    const { ast, errors } = parse("class Dog extends Animal {}");
    expect(errors).toBe(0);
    const cls = ast.statements[0] as any;
    expect(cls.heritageClauses).toHaveLength(1);
  });

  it("clase con implements", () => {
    const { ast, errors } = parse("class Cat implements Animal {}");
    expect(errors).toBe(0);
    const cls = ast.statements[0] as any;
    expect(cls.heritageClauses).toHaveLength(1);
  });

  it("clase con constructor y miembros", () => {
    const src = `
      class Person {
        private name: string;
        constructor(name: string) {
          this.name = name;
        }
        greet(): string {
          return "Hi";
        }
      }
    `;
    const { errors } = parse(src);
    expect(errors).toBe(0);
  });
});

describe("Parser - interfaces", () => {
  it("interfaz simple", () => {
    const { ast, errors } = parse("interface Foo { bar: string; }");
    expect(errors).toBe(0);
    expect(ast.statements[0]!.kind).toBe(NodeKind.InterfaceDeclaration);
  });

  it("interfaz con métodos", () => {
    const { ast, errors } = parse("interface Animal { nombre: string; sonido(): string; }");
    expect(errors).toBe(0);
    const iface = ast.statements[0] as any;
    expect(iface.members).toHaveLength(2);
  });
});

describe("Parser - enums", () => {
  it("enum simple", () => {
    const { ast, errors } = parse("enum Color { Red, Green, Blue }");
    expect(errors).toBe(0);
    const en = ast.statements[0] as any;
    expect(en.members).toHaveLength(3);
  });

  it("enum con valores", () => {
    const { ast, errors } = parse('enum Status { Active = "active", Inactive = "inactive" }');
    expect(errors).toBe(0);
  });
});

describe("Parser - type alias", () => {
  it("alias simple", () => {
    const { ast, errors } = parse("type Name = string;");
    expect(errors).toBe(0);
    expect(ast.statements[0]!.kind).toBe(NodeKind.TypeAliasDeclaration);
  });

  it("union type alias", () => {
    const { ast, errors } = parse("type StringOrNumber = string | number;");
    expect(errors).toBe(0);
  });

  it("generic type alias", () => {
    const { ast, errors } = parse("type Maybe<T> = T | null | undefined;");
    expect(errors).toBe(0);
  });
});

describe("Parser - imports/exports", () => {
  it("import named", () => {
    const { ast, errors } = parse('import { foo, bar } from "./mod";');
    expect(errors).toBe(0);
    expect(ast.statements[0]!.kind).toBe(NodeKind.ImportDeclaration);
  });

  it("import namespace", () => {
    const { ast, errors } = parse('import * as fs from "fs";');
    expect(errors).toBe(0);
  });

  it("import default", () => {
    const { ast, errors } = parse('import React from "react";');
    expect(errors).toBe(0);
  });

  it("export named", () => {
    const { errors } = parse('export { foo, bar };');
    expect(errors).toBe(0);
  });
});
