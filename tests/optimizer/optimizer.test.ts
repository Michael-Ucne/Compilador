import { describe, it, expect } from "bun:test";
import { Optimizer } from "../../src/optimizer/Optimizer.ts";
import { IRKind } from "../../src/ir/IRNode.ts";
import type {
  IRProgram, IRStatement, IRExpression,
  IRLiteral, IRBinaryExpr, IRVariableDecl,
  IRIfStatement, IRWhileStatement,
} from "../../src/ir/IRNode.ts";

function lit(value: string | number | boolean | null | undefined): IRLiteral {
  return { kind: IRKind.Literal, value, raw: String(value) };
}

function ident(name: string) {
  return { kind: IRKind.Identifier as const, name };
}

function binExpr(op: string, left: IRExpression, right: IRExpression): IRBinaryExpr {
  return { kind: IRKind.BinaryExpr, operator: op, left, right };
}

function program(...body: IRStatement[]): IRProgram {
  return { kind: IRKind.Program, body };
}

function varDecl(name: string, init: IRExpression, declKind: "const" | "let" | "var" = "const"): IRVariableDecl {
  return { kind: IRKind.VariableDecl, declKind, bindings: [{ name, init }] };
}

function exprStmt(expression: IRExpression) {
  return { kind: IRKind.ExprStatement as const, expression };
}

const opt = new Optimizer();

describe("Optimizador - constant folding aritmético", () => {
  it("dobla suma de dos literales numéricos via varDecl", () => {
    const prog = program(varDecl("x", binExpr("+", lit(3), lit(4))));
    const result = opt.optimize(prog);
    const decl = result.body[0] as IRVariableDecl;
    expect(decl.bindings[0]!.init!.kind).toBe(IRKind.Literal);
    expect((decl.bindings[0]!.init! as IRLiteral).value).toBe(7);
  });

  it("dobla resta", () => {
    const expr = opt.optimizeExpression(binExpr("-", lit(10), lit(3)), new Map());
    expect((expr as IRLiteral).value).toBe(7);
  });

  it("dobla multiplicación", () => {
    const expr = opt.optimizeExpression(binExpr("*", lit(6), lit(7)), new Map());
    expect((expr as IRLiteral).value).toBe(42);
  });

  it("dobla división", () => {
    const expr = opt.optimizeExpression(binExpr("/", lit(10), lit(2)), new Map());
    expect((expr as IRLiteral).value).toBe(5);
  });

  it("dobla potencia", () => {
    const expr = opt.optimizeExpression(binExpr("**", lit(2), lit(8)), new Map());
    expect((expr as IRLiteral).value).toBe(256);
  });

  it("dobla concatenación de strings", () => {
    const expr = opt.optimizeExpression(binExpr("+", lit("hello"), lit(" world")), new Map());
    expect((expr as IRLiteral).value).toBe("hello world");
  });

  it("dobla comparación === con números", () => {
    const expr = opt.optimizeExpression(binExpr("===", lit(5), lit(5)), new Map());
    expect((expr as IRLiteral).value).toBe(true);
  });

  it("dobla comparación !== con números", () => {
    const expr = opt.optimizeExpression(binExpr("!==", lit(5), lit(6)), new Map());
    expect((expr as IRLiteral).value).toBe(true);
  });

  it("dobla < con literales", () => {
    const expr = opt.optimizeExpression(binExpr("<", lit(3), lit(10)), new Map());
    expect((expr as IRLiteral).value).toBe(true);
  });

  it("dobla && con literales", () => {
    const expr = opt.optimizeExpression(binExpr("&&", lit(true), lit(42)), new Map());
    expect((expr as IRLiteral).value).toBe(42);
  });

  it("dobla || con literales", () => {
    const expr = opt.optimizeExpression(binExpr("||", lit(0), lit("fallback")), new Map());
    expect((expr as IRLiteral).value).toBe("fallback");
  });

  it("dobla ?? con null", () => {
    const expr = opt.optimizeExpression(binExpr("??", lit(null), lit("default")), new Map());
    expect((expr as IRLiteral).value).toBe("default");
  });

  it("no dobla división por cero", () => {
    const expr = opt.optimizeExpression(binExpr("/", lit(10), lit(0)), new Map());
    expect(expr.kind).toBe(IRKind.BinaryExpr);
  });
});

describe("Optimizador - strength reduction", () => {
  it("x * 0 → 0", () => {
    const expr = opt.optimizeExpression(binExpr("*", ident("x"), lit(0)), new Map());
    expect((expr as IRLiteral).value).toBe(0);
  });

  it("x * 1 → x", () => {
    const expr = opt.optimizeExpression(binExpr("*", ident("x"), lit(1)), new Map());
    expect(expr.kind).toBe(IRKind.Identifier);
  });

  it("x + 0 → x", () => {
    const expr = opt.optimizeExpression(binExpr("+", ident("x"), lit(0)), new Map());
    expect(expr.kind).toBe(IRKind.Identifier);
  });

  it("x - 0 → x", () => {
    const expr = opt.optimizeExpression(binExpr("-", ident("x"), lit(0)), new Map());
    expect(expr.kind).toBe(IRKind.Identifier);
  });

  it("x / 1 → x", () => {
    const expr = opt.optimizeExpression(binExpr("/", ident("x"), lit(1)), new Map());
    expect(expr.kind).toBe(IRKind.Identifier);
  });
});

describe("Optimizador - constant folding unario", () => {
  it("!true → false", () => {
    const expr = opt.optimizeExpression({ kind: IRKind.UnaryExpr, operator: "!", operand: lit(true), prefix: true }, new Map());
    expect((expr as IRLiteral).value).toBe(false);
  });

  it("-5 → -5", () => {
    const expr = opt.optimizeExpression({ kind: IRKind.UnaryExpr, operator: "-", operand: lit(5), prefix: true }, new Map());
    expect((expr as IRLiteral).value).toBe(-5);
  });

  it("typeof 42 → 'number'", () => {
    const expr = opt.optimizeExpression({ kind: IRKind.UnaryExpr, operator: "typeof", operand: lit(42), prefix: true }, new Map());
    expect((expr as IRLiteral).value).toBe("number");
  });

  it("void 0 → undefined", () => {
    const expr = opt.optimizeExpression({ kind: IRKind.UnaryExpr, operator: "void", operand: lit(0), prefix: true }, new Map());
    expect((expr as IRLiteral).value).toBe(undefined);
  });
});

describe("Optimizador - constant propagation", () => {
  it("propaga constantes declaradas con const en otro varDecl", () => {
    const prog = program(
      varDecl("PI", lit(3.14)),
      varDecl("copy", ident("PI")),
    );
    const result = opt.optimize(prog);
    const second = result.body[1] as IRVariableDecl;
    expect(second.bindings[0]!.init!.kind).toBe(IRKind.Literal);
    expect((second.bindings[0]!.init! as IRLiteral).value).toBe(3.14);
  });

  it("no propaga variables declaradas con let", () => {
    const prog = program(
      varDecl("x", lit(5), "let"),
      varDecl("copy", ident("x")),
    );
    const result = opt.optimize(prog);
    const second = result.body[1] as IRVariableDecl;
    expect(second.bindings[0]!.init!.kind).toBe(IRKind.Identifier);
  });

  it("pliega expresiones con constantes propagadas en varDecl", () => {
    const prog = program(
      varDecl("R", lit(5)),
      varDecl("area", binExpr("*", ident("R"), ident("R"))),
    );
    const result = opt.optimize(prog);
    const second = result.body[1] as IRVariableDecl;
    expect(second.bindings[0]!.init!.kind).toBe(IRKind.Literal);
    expect((second.bindings[0]!.init! as IRLiteral).value).toBe(25);
  });
});

describe("Optimizador - dead code elimination", () => {
  it("elimina if (false)", () => {
    const prog = program({
      kind: IRKind.IfStatement,
      test: lit(false),
      consequent: exprStmt(ident("unreachable")),
      alternate: null,
    } as IRIfStatement);
    const result = opt.optimize(prog);
    expect(result.body).toHaveLength(0);
  });

  it("mantiene if (true) → solo then", () => {
    const prog = program({
      kind: IRKind.IfStatement,
      test: lit(true),
      consequent: exprStmt(ident("reached")),
      alternate: exprStmt(ident("unreachable")),
    } as IRIfStatement);
    const result = opt.optimize(prog);
    expect(result.body).toHaveLength(1);
    const stmt = result.body[0] as any;
    expect(stmt.expression.name).toBe("reached");
  });

  it("elimina while (false)", () => {
    const prog = program({
      kind: IRKind.WhileStatement,
      test: lit(false),
      body: exprStmt(ident("unreachable")),
    } as IRWhileStatement);
    const result = opt.optimize(prog);
    expect(result.body).toHaveLength(0);
  });

  it("elimina sentencias de expresión que son literales puros", () => {
    const prog = program(exprStmt(lit(42)));
    const result = opt.optimize(prog);
    expect(result.body).toHaveLength(0);
  });

  it("mantiene sentencias de expresión con efectos (llamadas)", () => {
    const prog = program(exprStmt({ kind: IRKind.CallExpr, callee: ident("foo"), args: [], optional: false }));
    const result = opt.optimize(prog);
    expect(result.body).toHaveLength(1);
  });
});

describe("Optimizador - ternario constante", () => {
  it("true ? a : b → a", () => {
    const expr = opt.optimizeExpression({
      kind: IRKind.ConditionalExpr,
      test: lit(true),
      consequent: ident("a"),
      alternate: ident("b"),
    }, new Map());
    expect(expr.kind).toBe(IRKind.Identifier);
    expect((expr as any).name).toBe("a");
  });

  it("false ? a : b → b", () => {
    const expr = opt.optimizeExpression({
      kind: IRKind.ConditionalExpr,
      test: lit(false),
      consequent: ident("a"),
      alternate: ident("b"),
    }, new Map());
    expect(expr.kind).toBe(IRKind.Identifier);
    expect((expr as any).name).toBe("b");
  });
});
