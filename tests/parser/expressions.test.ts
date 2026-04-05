import { describe, it, expect } from "bun:test";
import { Lexer } from "../../src/lexer/Lexer.ts";
import { Parser } from "../../src/parser/Parser.ts";
import { DiagnosticBag } from "../../src/errors/DiagnosticBag.ts";
import { NodeKind } from "../../src/ast/Node.ts";
import type { SourceFile, ExpressionStatement } from "../../src/ast/index.ts";
import type { BinaryExpression } from "../../src/ast/Expressions.ts";

function parseExpr(src: string) {
  const bag = new DiagnosticBag();
  const lexer = new Lexer(src, bag);
  const parser = new Parser(lexer, bag);
  const ast = parser.parseSourceFile("<test>", src);
  const stmt = ast.statements[0] as ExpressionStatement;
  return { expr: stmt?.expression, errors: bag.errorCount };
}

describe("Parser - expresiones binarias", () => {
  it("suma", () => {
    const { expr, errors } = parseExpr("1 + 2");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.BinaryExpression);
    expect((expr as BinaryExpression).operator).toBe("+");
  });

  it("precedencia: * tiene mayor precedencia que +", () => {
    const { expr } = parseExpr("1 + 2 * 3");
    // Debe ser: 1 + (2 * 3)
    const bin = expr as BinaryExpression;
    expect(bin.operator).toBe("+");
    expect((bin.right as BinaryExpression).operator).toBe("*");
  });

  it("precedencia: && tiene mayor que ||", () => {
    const { expr } = parseExpr("a || b && c");
    const bin = expr as BinaryExpression;
    expect(bin.operator).toBe("||");
    expect((bin.right as BinaryExpression).operator).toBe("&&");
  });

  it("** es right-associativo", () => {
    const { expr } = parseExpr("2 ** 3 ** 4");
    const bin = expr as BinaryExpression;
    expect(bin.operator).toBe("**");
    expect((bin.right as BinaryExpression).operator).toBe("**");
  });

  it("comparación", () => {
    const { expr, errors } = parseExpr("x === 42");
    expect(errors).toBe(0);
    expect((expr as BinaryExpression).operator).toBe("===");
  });
});

describe("Parser - expresiones unarias", () => {
  it("negación lógica", () => {
    const { expr, errors } = parseExpr("!flag");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.UnaryExpression);
  });

  it("typeof", () => {
    const { expr, errors } = parseExpr("typeof x");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.TypeofExpression);
  });

  it("postfix ++", () => {
    const { expr, errors } = parseExpr("i++");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.PostfixUnaryExpression);
  });
});

describe("Parser - arrow functions", () => {
  it("arrow con un parámetro", () => {
    const { expr, errors } = parseExpr("x => x + 1");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.ArrowFunctionExpression);
  });

  it("arrow con parámetros y tipo de retorno", () => {
    const { expr, errors } = parseExpr("(a: number, b: number): number => a + b");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.ArrowFunctionExpression);
    const arrow = expr as any;
    expect(arrow.parameters).toHaveLength(2);
  });

  it("arrow con body de bloque", () => {
    const { expr, errors } = parseExpr("(x) => { return x; }");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.ArrowFunctionExpression);
    const arrow = expr as any;
    expect(arrow.body.kind).toBe(NodeKind.Block);
  });
});

describe("Parser - llamadas y acceso", () => {
  it("llamada simple", () => {
    const { expr, errors } = parseExpr("foo()");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.CallExpression);
  });

  it("llamada genérica", () => {
    const { expr, errors } = parseExpr("identity<string>('hello')");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.CallExpression);
    expect((expr as any).typeArguments).toHaveLength(1);
  });

  it("acceso a propiedad", () => {
    const { expr, errors } = parseExpr("obj.prop");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.PropertyAccessExpression);
  });

  it("acceso opcional ?.", () => {
    const { expr, errors } = parseExpr("obj?.prop");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.PropertyAccessExpression);
    expect((expr as any).isOptional).toBe(true);
  });

  it("llamada opcional ?.()", () => {
    const { expr, errors } = parseExpr("fn?.()");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.CallExpression);
    expect((expr as any).isOptional).toBe(true);
  });

  it("new expression", () => {
    const { expr, errors } = parseExpr("new Foo(1, 2)");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.NewExpression);
  });
});

describe("Parser - tipos en expresiones", () => {
  it("as expression", () => {
    const { expr, errors } = parseExpr("valor as string");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.AsExpression);
  });

  it("non-null assertion !", () => {
    const { expr, errors } = parseExpr("valor!");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.NonNullExpression);
  });
});

describe("Parser - literales compuestos", () => {
  it("object literal", () => {
    const { expr, errors } = parseExpr("({ a: 1, b: 'hello' })");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.ParenthesizedExpression);
  });

  it("array literal", () => {
    const { expr, errors } = parseExpr("[1, 2, 3]");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.ArrayLiteralExpression);
    expect((expr as any).elements).toHaveLength(3);
  });

  it("template literal", () => {
    const { expr, errors } = parseExpr("`hello`");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.TemplateLiteral);
  });

  it("ternary", () => {
    const { expr, errors } = parseExpr("cond ? 'yes' : 'no'");
    expect(errors).toBe(0);
    expect(expr.kind).toBe(NodeKind.ConditionalExpression);
  });

  it("nullish coalescing", () => {
    const { expr, errors } = parseExpr("val ?? 'default'");
    expect(errors).toBe(0);
    expect((expr as BinaryExpression).operator).toBe("??");
  });
});
