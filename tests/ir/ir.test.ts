import { describe, it, expect } from "bun:test";
import { Lexer } from "../../src/lexer/Lexer.ts";
import { Parser } from "../../src/parser/Parser.ts";
import { IRGenerator } from "../../src/ir/IRGenerator.ts";
import { IRKind } from "../../src/ir/IRNode.ts";
import { DiagnosticBag } from "../../src/errors/DiagnosticBag.ts";
import type { IRProgram, IRFunctionDecl, IRVariableDecl, IRClassDecl } from "../../src/ir/IRNode.ts";

function toIR(src: string): IRProgram {
  const bag = new DiagnosticBag();
  const lexer = new Lexer(src, bag);
  const ast = new Parser(lexer, bag).parseSourceFile("<test>", src);
  return new IRGenerator().generate(ast);
}

describe("IRGenerator - tipos eliminados", () => {
  it("elimina anotaciones de tipo en variables", () => {
    const ir = toIR("const x: number = 42;");
    expect(ir.body).toHaveLength(1);
    const decl = ir.body[0] as IRVariableDecl;
    expect(decl.kind).toBe(IRKind.VariableDecl);
    expect(decl.bindings[0]!.name).toBe("x");
  });

  it("elimina interfaces completamente", () => {
    const ir = toIR("interface Foo { bar: string; }");
    expect(ir.body).toHaveLength(0);
  });

  it("elimina type aliases completamente", () => {
    const ir = toIR("type Name = string;");
    expect(ir.body).toHaveLength(0);
  });

  it("elimina imports completamente", () => {
    const ir = toIR('import { foo } from "./mod";');
    expect(ir.body).toHaveLength(0);
  });

  it("elimina anotaciones de tipo en funciones pero mantiene el cuerpo", () => {
    const ir = toIR("function add(a: number, b: number): number { return a + b; }");
    expect(ir.body).toHaveLength(1);
    const fn = ir.body[0] as IRFunctionDecl;
    expect(fn.kind).toBe(IRKind.FunctionDecl);
    expect(fn.name).toBe("add");
    expect(fn.params).toHaveLength(2);
    expect(fn.params[0]!.name).toBe("a");
    expect(fn.params[1]!.name).toBe("b");
  });

  it("elimina as-expression y mantiene solo la expresión", () => {
    const ir = toIR("const x = value as string;");
    const decl = ir.body[0] as IRVariableDecl;
    const init = decl.bindings[0]!.init!;
    expect(init.kind).toBe(IRKind.Identifier);
  });
});

describe("IRGenerator - declaraciones", () => {
  it("genera VariableDecl para const", () => {
    const ir = toIR("const n = 10;");
    const decl = ir.body[0] as IRVariableDecl;
    expect(decl.kind).toBe(IRKind.VariableDecl);
    expect(decl.declKind).toBe("const");
  });

  it("genera VariableDecl para let", () => {
    const ir = toIR("let x = 1;");
    const decl = ir.body[0] as IRVariableDecl;
    expect(decl.declKind).toBe("let");
  });

  it("genera FunctionDecl correctamente", () => {
    const ir = toIR("function greet() {}");
    const fn = ir.body[0] as IRFunctionDecl;
    expect(fn.kind).toBe(IRKind.FunctionDecl);
    expect(fn.name).toBe("greet");
    expect(fn.isAsync).toBe(false);
    expect(fn.isGenerator).toBe(false);
  });

  it("marca funciones async", () => {
    const ir = toIR("async function fetchData() {}");
    const fn = ir.body[0] as IRFunctionDecl;
    expect(fn.isAsync).toBe(true);
  });

  it("marca funciones generadoras", () => {
    const ir = toIR("function* gen() {}");
    const fn = ir.body[0] as IRFunctionDecl;
    expect(fn.isGenerator).toBe(true);
  });

  it("genera ClassDecl correctamente", () => {
    const ir = toIR("class Dog {}");
    const cls = ir.body[0] as IRClassDecl;
    expect(cls.kind).toBe(IRKind.ClassDecl);
    expect(cls.name).toBe("Dog");
    expect(cls.superClass).toBeNull();
  });

  it("genera ClassDecl con superclase", () => {
    const ir = toIR("class Poodle extends Dog {}");
    const cls = ir.body[0] as IRClassDecl;
    expect(cls.superClass).not.toBeNull();
    expect(cls.superClass!.kind).toBe(IRKind.Identifier);
  });
});

describe("IRGenerator - enum a objeto", () => {
  it("convierte enum a objeto JS", () => {
    const ir = toIR("enum Color { Red, Green, Blue }");
    const decl = ir.body[0] as IRVariableDecl;
    expect(decl.kind).toBe(IRKind.VariableDecl);
    expect(decl.declKind).toBe("const");
    expect(decl.bindings[0]!.name).toBe("Color");
    const obj = decl.bindings[0]!.init!;
    expect(obj.kind).toBe(IRKind.ObjectExpr);
  });
});

describe("IRGenerator - expresiones", () => {
  it("genera Literal numérico", () => {
    const ir = toIR("42;");
    const stmt = ir.body[0] as any;
    expect(stmt.expression.kind).toBe(IRKind.Literal);
    expect(stmt.expression.value).toBe(42);
  });

  it("genera Literal string", () => {
    const ir = toIR('"hola";');
    const stmt = ir.body[0] as any;
    expect(stmt.expression.kind).toBe(IRKind.Literal);
    expect(stmt.expression.value).toBe("hola");
  });

  it("genera BinaryExpr para operaciones aritméticas", () => {
    const ir = toIR("1 + 2;");
    const stmt = ir.body[0] as any;
    expect(stmt.expression.kind).toBe(IRKind.BinaryExpr);
    expect(stmt.expression.operator).toBe("+");
  });

  it("genera AssignExpr para asignaciones", () => {
    const ir = toIR("let x = 0; x = 5;");
    const stmt = ir.body[1] as any;
    expect(stmt.expression.kind).toBe(IRKind.AssignExpr);
    expect(stmt.expression.operator).toBe("=");
  });

  it("genera CallExpr para llamadas", () => {
    const ir = toIR("foo(1, 2);");
    const stmt = ir.body[0] as any;
    expect(stmt.expression.kind).toBe(IRKind.CallExpr);
    expect(stmt.expression.args).toHaveLength(2);
  });

  it("genera MemberExpr para acceso a propiedades", () => {
    const ir = toIR("obj.prop;");
    const stmt = ir.body[0] as any;
    expect(stmt.expression.kind).toBe(IRKind.MemberExpr);
    expect(stmt.expression.computed).toBe(false);
  });

  it("genera MemberExpr computed para indexing", () => {
    const ir = toIR("arr[0];");
    const stmt = ir.body[0] as any;
    expect(stmt.expression.kind).toBe(IRKind.MemberExpr);
    expect(stmt.expression.computed).toBe(true);
  });

  it("genera ArrowFunctionExpr", () => {
    const ir = toIR("const f = (x: number) => x * 2;");
    const decl = ir.body[0] as IRVariableDecl;
    const arrow = decl.bindings[0]!.init!;
    expect(arrow.kind).toBe(IRKind.ArrowFunctionExpr);
  });

  it("genera ConditionalExpr para ternario", () => {
    const ir = toIR("true ? 1 : 2;");
    const stmt = ir.body[0] as any;
    expect(stmt.expression.kind).toBe(IRKind.ConditionalExpr);
  });
});

describe("IRGenerator - sentencias de control", () => {
  it("genera IfStatement", () => {
    const ir = toIR("if (x > 0) { return x; }");
    expect(ir.body[0]!.kind).toBe(IRKind.IfStatement);
  });

  it("genera WhileStatement", () => {
    const ir = toIR("while (true) {}");
    expect(ir.body[0]!.kind).toBe(IRKind.WhileStatement);
  });

  it("genera ForStatement", () => {
    const ir = toIR("for (let i = 0; i < 10; i++) {}");
    expect(ir.body[0]!.kind).toBe(IRKind.ForStatement);
  });

  it("genera ReturnStatement", () => {
    const ir = toIR("function f() { return 42; }");
    const fn = ir.body[0] as IRFunctionDecl;
    const ret = fn.body.body[0]!;
    expect(ret.kind).toBe(IRKind.ReturnStatement);
  });

  it("genera TryStatement", () => {
    const ir = toIR("try { foo(); } catch (e) { bar(); }");
    expect(ir.body[0]!.kind).toBe(IRKind.TryStatement);
  });
});
