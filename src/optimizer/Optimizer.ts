import {
  IRKind,
  type IRProgram, type IRStatement, type IRExpression,
  type IRBlock, type IRFunctionDecl, type IRVariableDecl, type IRClassDecl,
  type IRExprStatement, type IRIfStatement, type IRWhileStatement,
  type IRDoWhileStatement, type IRForStatement,
  type IRReturnStatement, type IRThrowStatement, type IRTryStatement,
  type IRSwitchStatement, type IRLabeledStatement,
  type IRBinaryExpr, type IRUnaryExpr, type IRLiteral,
  type IRBinding, type IRArrowFunctionExpr, type IRFunctionExpr,
  type IRConditionalExpr,
} from "../ir/IRNode.ts";

type ConstantMap = Map<string, IRLiteral>;

export class Optimizer {
  optimize(program: IRProgram): IRProgram {
    const constants: ConstantMap = new Map();
    const body = this.optimizeStatements(program.body, constants);
    return { kind: IRKind.Program, body };
  }

  private optimizeStatements(stmts: IRStatement[], constants: ConstantMap): IRStatement[] {
    const result: IRStatement[] = [];
    for (const stmt of stmts) {
      const opt = this.optimizeStatement(stmt, constants);
      if (opt !== null) result.push(opt);
    }
    return result;
  }

  private optimizeStatement(node: IRStatement, constants: ConstantMap): IRStatement | null {
    switch (node.kind) {
      case IRKind.Block:
        return { kind: IRKind.Block, body: this.optimizeStatements(node.body, new Map(constants)) };

      case IRKind.FunctionDecl:
        return this.optimizeFunctionDecl(node, constants);

      case IRKind.ClassDecl:
        return this.optimizeClassDecl(node, constants);

      case IRKind.VariableDecl:
        return this.optimizeVariableDecl(node, constants);

      case IRKind.ExprStatement:
        return this.optimizeExprStatement(node, constants);

      case IRKind.IfStatement:
        return this.optimizeIfStatement(node, constants);

      case IRKind.WhileStatement:
        return this.optimizeWhileStatement(node, constants);

      case IRKind.DoWhileStatement:
        return {
          kind: IRKind.DoWhileStatement,
          body: this.optimizeStatement(node.body, constants) ?? { kind: IRKind.Block, body: [] },
          test: this.optimizeExpression(node.test, constants),
        };

      case IRKind.ForStatement:
        return this.optimizeForStatement(node, constants);

      case IRKind.ReturnStatement:
        return {
          kind: IRKind.ReturnStatement,
          argument: node.argument ? this.optimizeExpression(node.argument, constants) : null,
        };

      case IRKind.ThrowStatement:
        return {
          kind: IRKind.ThrowStatement,
          argument: this.optimizeExpression(node.argument, constants),
        };

      case IRKind.TryStatement:
        return this.optimizeTryStatement(node, constants);

      case IRKind.SwitchStatement:
        return this.optimizeSwitchStatement(node, constants);

      case IRKind.LabeledStatement:
        return {
          kind: IRKind.LabeledStatement,
          label: node.label,
          body: this.optimizeStatement(node.body, constants) ?? { kind: IRKind.Block, body: [] },
        };

      case IRKind.BreakStatement:
      case IRKind.ContinueStatement:
        return node;

      default:
        return node;
    }
  }

  private optimizeFunctionDecl(node: IRFunctionDecl, _constants: ConstantMap): IRFunctionDecl {
    const localConsts: ConstantMap = new Map();
    return {
      ...node,
      body: { kind: IRKind.Block, body: this.optimizeStatements(node.body.body, localConsts) },
    };
  }

  private optimizeClassDecl(node: IRClassDecl, constants: ConstantMap): IRClassDecl {
    return {
      ...node,
      superClass: node.superClass ? this.optimizeExpression(node.superClass, constants) : null,
      body: node.body.map(m => ({
        ...m,
        body: { kind: IRKind.Block as const, body: this.optimizeStatements(m.body.body, new Map()) },
      })),
    };
  }

  private optimizeVariableDecl(node: IRVariableDecl, constants: ConstantMap): IRVariableDecl {
    const bindings: IRBinding[] = node.bindings.map(b => {
      const init = b.init ? this.optimizeExpression(b.init, constants) : null;
      if (node.declKind === "const" && b.name.kind === IRKind.Identifier && init?.kind === IRKind.Literal) {
        constants.set(b.name.name, init);
      }
      return { name: b.name, init };
    });
    return { kind: IRKind.VariableDecl, declKind: node.declKind, bindings };
  }

  private optimizeExprStatement(node: IRExprStatement, constants: ConstantMap): IRExprStatement | null {
    const expr = this.optimizeExpression(node.expression, constants);
    if (expr.kind === IRKind.Literal) return null;
    return { kind: IRKind.ExprStatement, expression: expr };
  }

  private optimizeIfStatement(node: IRIfStatement, constants: ConstantMap): IRStatement | null {
    const test = this.optimizeExpression(node.test, constants);
    if (test.kind === IRKind.Literal) {
      const isTruthy = test.value !== false && test.value !== null && test.value !== undefined && test.value !== 0 && test.value !== "";
      if (isTruthy) return this.optimizeStatement(node.consequent, constants);
      return node.alternate ? this.optimizeStatement(node.alternate, constants) : null;
    }
    return {
      kind: IRKind.IfStatement,
      test,
      consequent: this.optimizeStatement(node.consequent, constants) ?? { kind: IRKind.Block, body: [] },
      alternate: node.alternate ? this.optimizeStatement(node.alternate, constants) : null,
    };
  }

  private optimizeWhileStatement(node: IRWhileStatement, constants: ConstantMap): IRStatement | null {
    const test = this.optimizeExpression(node.test, constants);
    if (test.kind === IRKind.Literal) {
      const isFalsy = test.value === false || test.value === null || test.value === undefined || test.value === 0 || test.value === "";
      if (isFalsy) return null;
    }
    return {
      kind: IRKind.WhileStatement,
      test,
      body: this.optimizeStatement(node.body, constants) ?? { kind: IRKind.Block, body: [] },
    };
  }

  private optimizeForStatement(node: IRForStatement, constants: ConstantMap): IRForStatement {
    const localConsts = new Map(constants);
    return {
      kind: IRKind.ForStatement,
      init: node.init
        ? (node.init.kind === IRKind.VariableDecl
          ? this.optimizeVariableDecl(node.init, localConsts)
          : this.optimizeExpression(node.init, localConsts))
        : null,
      test: node.test ? this.optimizeExpression(node.test, localConsts) : null,
      update: node.update ? this.optimizeExpression(node.update, localConsts) : null,
      body: this.optimizeStatement(node.body, localConsts) ?? { kind: IRKind.Block, body: [] },
    };
  }

  private optimizeTryStatement(node: IRTryStatement, constants: ConstantMap): IRTryStatement {
    return {
      kind: IRKind.TryStatement,
      block: { kind: IRKind.Block, body: this.optimizeStatements(node.block.body, constants) },
      handler: node.handler ? {
        param: node.handler.param,
        body: { kind: IRKind.Block, body: this.optimizeStatements(node.handler.body.body, new Map(constants)) },
      } : null,
      finalizer: node.finalizer
        ? { kind: IRKind.Block, body: this.optimizeStatements(node.finalizer.body, constants) }
        : null,
    };
  }

  private optimizeSwitchStatement(node: IRSwitchStatement, constants: ConstantMap): IRSwitchStatement {
    return {
      kind: IRKind.SwitchStatement,
      discriminant: this.optimizeExpression(node.discriminant, constants),
      cases: node.cases.map(c => ({
        kind: IRKind.SwitchCase as const,
        test: c.test ? this.optimizeExpression(c.test, constants) : null,
        consequent: this.optimizeStatements(c.consequent, constants),
      })),
    };
  }

  optimizeExpression(node: IRExpression, constants: ConstantMap): IRExpression {
    switch (node.kind) {
      case IRKind.Literal:
        return node;

      case IRKind.Identifier:
        return constants.has(node.name) ? constants.get(node.name)! : node;

      case IRKind.BinaryExpr:
        return this.optimizeBinaryExpr(node, constants);

      case IRKind.UnaryExpr:
        return this.optimizeUnaryExpr(node, constants);

      case IRKind.AssignExpr:
        return {
          ...node,
          left: this.optimizeExpression(node.left, constants),
          right: this.optimizeExpression(node.right, constants),
        };

      case IRKind.CallExpr:
        return {
          ...node,
          callee: this.optimizeExpression(node.callee, constants),
          args: node.args.map(a => this.optimizeExpression(a, constants)),
        };

      case IRKind.NewExpr:
        return {
          ...node,
          callee: this.optimizeExpression(node.callee, constants),
          args: node.args.map(a => this.optimizeExpression(a, constants)),
        };

      case IRKind.MemberExpr:
        return {
          ...node,
          object: this.optimizeExpression(node.object, constants),
          property: node.computed ? this.optimizeExpression(node.property, constants) : node.property,
        };

      case IRKind.ConditionalExpr:
        return this.optimizeConditionalExpr(node, constants);

      case IRKind.ArrayExpr:
        return {
          ...node,
          elements: node.elements.map(e => e ? this.optimizeExpression(e, constants) : null),
        };

      case IRKind.ObjectExpr:
        return {
          ...node,
          properties: node.properties.map(p => ({
            ...p,
            key: p.computed ? this.optimizeExpression(p.key, constants) : p.key,
            value: this.optimizeExpression(p.value, constants),
          })),
        };

      case IRKind.FunctionExpr:
        return this.optimizeFunctionExpr(node);

      case IRKind.ArrowFunctionExpr:
        return this.optimizeArrowFunctionExpr(node);

      case IRKind.SequenceExpr:
        return { ...node, expressions: node.expressions.map(e => this.optimizeExpression(e, constants)) };

      case IRKind.SpreadExpr:
        return { ...node, argument: this.optimizeExpression(node.argument, constants) };

      case IRKind.TemplateLiteral:
        return { ...node, expressions: node.expressions.map(e => this.optimizeExpression(e, constants)) };

      case IRKind.TaggedTemplate:
        return {
          ...node,
          tag: this.optimizeExpression(node.tag, constants),
          quasi: { ...node.quasi, expressions: node.quasi.expressions.map(e => this.optimizeExpression(e, constants)) },
        };

      case IRKind.Await:
        return { ...node, argument: this.optimizeExpression(node.argument, constants) };

      case IRKind.Yield:
        return { ...node, argument: node.argument ? this.optimizeExpression(node.argument, constants) : null };

      default:
        return node;
    }
  }

  private optimizeBinaryExpr(node: IRBinaryExpr, constants: ConstantMap): IRExpression {
    const left = this.optimizeExpression(node.left, constants);
    const right = this.optimizeExpression(node.right, constants);

    if (left.kind === IRKind.Literal && right.kind === IRKind.Literal) {
      const folded = this.foldBinary(node.operator, left.value, right.value);
      if (folded !== undefined) {
        return { kind: IRKind.Literal, value: folded, raw: String(folded) };
      }
    }

    if (node.operator === "*") {
      if (right.kind === IRKind.Literal) {
        if (right.value === 0) return { kind: IRKind.Literal, value: 0, raw: "0" };
        if (right.value === 1) return left;
        if (right.value === 2) return { kind: IRKind.BinaryExpr, operator: "+", left, right: left };
      }
      if (left.kind === IRKind.Literal) {
        if (left.value === 0) return { kind: IRKind.Literal, value: 0, raw: "0" };
        if (left.value === 1) return right;
      }
    }

    if (node.operator === "+") {
      if (right.kind === IRKind.Literal && right.value === 0) return left;
      if (left.kind === IRKind.Literal && left.value === 0) return right;
    }

    if (node.operator === "-" && right.kind === IRKind.Literal && right.value === 0) return left;
    if (node.operator === "/" && right.kind === IRKind.Literal && right.value === 1) return left;

    return { kind: IRKind.BinaryExpr, operator: node.operator, left, right };
  }

  private foldBinary(op: string, l: unknown, r: unknown): unknown {
    if (typeof l === "number" && typeof r === "number") {
      switch (op) {
        case "+": return l + r;
        case "-": return l - r;
        case "*": return l * r;
        case "/": return r !== 0 ? l / r : undefined;
        case "%": return r !== 0 ? l % r : undefined;
        case "**": return l ** r;
        case "&": return (l | 0) & (r | 0);
        case "|": return (l | 0) | (r | 0);
        case "^": return (l | 0) ^ (r | 0);
        case "<<": return l << r;
        case ">>": return l >> r;
        case ">>>": return l >>> r;
        case "<": return l < r;
        case ">": return l > r;
        case "<=": return l <= r;
        case ">=": return l >= r;
        case "===": return l === r;
        case "!==": return l !== r;
        case "==": return l == r;   // eslint-disable-line eqeqeq
        case "!=": return l != r;   // eslint-disable-line eqeqeq
      }
    }
    if (typeof l === "string" && typeof r === "string" && op === "+") return l + r;
    if (op === "===") return l === r;
    if (op === "!==") return l !== r;
    if (op === "&&") return l ? r : l;
    if (op === "||") return l ? l : r;
    if (op === "??") return (l === null || l === undefined) ? r : l;
    return undefined;
  }

  private optimizeUnaryExpr(node: IRUnaryExpr, constants: ConstantMap): IRExpression {
    const operand = this.optimizeExpression(node.operand, constants);
    if (operand.kind === IRKind.Literal) {
      const val = operand.value;
      switch (node.operator) {
        case "!":     return { kind: IRKind.Literal, value: !val, raw: String(!val) };
        case "-":     return typeof val === "number" ? { kind: IRKind.Literal, value: -val, raw: String(-val) } : node;
        case "+":     return typeof val === "number" ? { kind: IRKind.Literal, value: +val, raw: String(+val) } : node;
        case "~":     return typeof val === "number" ? { kind: IRKind.Literal, value: ~(val | 0), raw: String(~(val | 0)) } : node;
        case "typeof": return { kind: IRKind.Literal, value: typeof val, raw: `"${typeof val}"` };
        case "void":  return { kind: IRKind.Literal, value: undefined, raw: "undefined" };
      }
    }
    return { ...node, operand };
  }

  private optimizeConditionalExpr(node: IRConditionalExpr, constants: ConstantMap): IRExpression {
    const test = this.optimizeExpression(node.test, constants);
    if (test.kind === IRKind.Literal) {
      const isTruthy = test.value !== false && test.value !== null && test.value !== undefined && test.value !== 0 && test.value !== "";
      return isTruthy
        ? this.optimizeExpression(node.consequent, constants)
        : this.optimizeExpression(node.alternate, constants);
    }
    return {
      kind: IRKind.ConditionalExpr,
      test,
      consequent: this.optimizeExpression(node.consequent, constants),
      alternate: this.optimizeExpression(node.alternate, constants),
    };
  }

  private optimizeFunctionExpr(node: IRFunctionExpr): IRFunctionExpr {
    return { ...node, body: { kind: IRKind.Block, body: this.optimizeStatements(node.body.body, new Map()) } };
  }

  private optimizeArrowFunctionExpr(node: IRArrowFunctionExpr): IRArrowFunctionExpr {
    const localConsts: ConstantMap = new Map();
    const body = node.body.kind === IRKind.Block
      ? { kind: IRKind.Block as const, body: this.optimizeStatements(node.body.body, localConsts) }
      : this.optimizeExpression(node.body as IRExpression, localConsts);
    return { ...node, body };
  }
}
