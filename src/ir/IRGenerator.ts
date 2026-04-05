import { NodeKind } from "../ast/Node.ts";
import type { SourceFile } from "../ast/Declarations.ts";
import type {
  FunctionDeclaration, ClassDeclaration, VariableStatement,
  Parameter, MethodDeclaration, GetAccessor, SetAccessor, Constructor,
  BindingName, BindingElement, ObjectBindingPattern, ArrayBindingPattern,
} from "../ast/Declarations.ts";
import type { Statement } from "../ast/Statements.ts";
import type { Expression } from "../ast/Expressions.ts";
import {
  IRKind,
  type IRProgram, type IRStatement, type IRExpression,
  type IRBlock, type IRFunctionDecl, type IRVariableDecl, type IRClassDecl,
  type IRMethodDecl, type IRParam, type IRBinding,
  type IRBindingName, type IRBindingElement,
  type IRExprStatement, type IRIfStatement, type IRWhileStatement,
  type IRDoWhileStatement, type IRForStatement,
  type IRReturnStatement, type IRBreakStatement, type IRContinueStatement,
  type IRThrowStatement, type IRTryStatement, type IRCatchClause,
  type IRSwitchStatement, type IRSwitchCase, type IRLabeledStatement,
  type IRLiteral, type IRIdentifier, type IRBinaryExpr, type IRUnaryExpr,
  type IRAssignExpr, type IRCallExpr, type IRNewExpr, type IRMemberExpr,
  type IRArrayExpr, type IRProperty,
  type IRFunctionExpr, type IRArrowFunctionExpr,
  type IRSequenceExpr, type IRConditionalExpr, type IRSpreadExpr,
  type IRTemplateLiteral,
  type IRAwaît, type IRYield,
} from "./IRNode.ts";

export class IRGenerator {
  generate(sourceFile: SourceFile): IRProgram {
    const body: IRStatement[] = [];
    for (const stmt of sourceFile.statements) {
      const ir = this.lowerStatement(stmt);
      if (ir) body.push(ir);
    }
    return { kind: IRKind.Program, body };
  }

  private lowerStatement(node: Statement): IRStatement | null {
    switch (node.kind) {
      case NodeKind.FunctionDeclaration:
        return this.lowerFunctionDecl(node as FunctionDeclaration);

      case NodeKind.ClassDeclaration:
        return this.lowerClassDecl(node as ClassDeclaration);

      case NodeKind.VariableStatement:
        return this.lowerVariableStatement(node as VariableStatement);

      case NodeKind.Block: {
        const stmts: IRStatement[] = [];
        for (const s of node.statements) {
          const ir = this.lowerStatement(s);
          if (ir) stmts.push(ir);
        }
        return { kind: IRKind.Block, body: stmts };
      }

      case NodeKind.ExpressionStatement:
        return {
          kind: IRKind.ExprStatement,
          expression: this.lowerExpression(node.expression),
        };

      case NodeKind.IfStatement:
        return {
          kind: IRKind.IfStatement,
          test: this.lowerExpression(node.condition),
          consequent: this.lowerStatement(node.thenBranch)!,
          alternate: node.elseBranch ? this.lowerStatement(node.elseBranch) : null,
        };

      case NodeKind.WhileStatement:
        return {
          kind: IRKind.WhileStatement,
          test: this.lowerExpression(node.condition),
          body: this.lowerStatement(node.body)!,
        };

      case NodeKind.DoStatement:
        return {
          kind: IRKind.DoWhileStatement,
          body: this.lowerStatement(node.body)!,
          test: this.lowerExpression(node.condition),
        };

      case NodeKind.ForStatement: {
        let init: IRVariableDecl | IRExpression | null = null;
        if (node.init) {
          if (node.init.kind === NodeKind.VariableStatement) {
            init = this.lowerVariableStatement(node.init as VariableStatement);
          } else {
            init = this.lowerExpression(node.init as Expression);
          }
        }
        return {
          kind: IRKind.ForStatement,
          init,
          test: node.condition ? this.lowerExpression(node.condition) : null,
          update: node.update ? this.lowerExpression(node.update) : null,
          body: this.lowerStatement(node.body)!,
        };
      }

      case NodeKind.ForInStatement:
        return this.lowerForIn(node);

      case NodeKind.ForOfStatement:
        return this.lowerForOf(node);

      case NodeKind.ReturnStatement:
        return {
          kind: IRKind.ReturnStatement,
          argument: node.expression ? this.lowerExpression(node.expression) : null,
        };

      case NodeKind.BreakStatement:
        return {
          kind: IRKind.BreakStatement,
          label: node.label?.name ?? null,
        };

      case NodeKind.ContinueStatement:
        return {
          kind: IRKind.ContinueStatement,
          label: node.label?.name ?? null,
        };

      case NodeKind.ThrowStatement:
        return {
          kind: IRKind.ThrowStatement,
          argument: this.lowerExpression(node.expression),
        };

      case NodeKind.TryStatement: {
        const tryBlock = this.lowerBlock(node.tryBlock);
        let handler: IRCatchClause | null = null;
        if (node.catchClause) {
          const param = node.catchClause.binding?.kind === NodeKind.Identifier
            ? node.catchClause.binding.name
            : null;
          handler = {
            param,
            body: this.lowerBlock(node.catchClause.body),
          };
        }
        const finalizer = node.finallyBlock ? this.lowerBlock(node.finallyBlock) : null;
        return { kind: IRKind.TryStatement, block: tryBlock, handler, finalizer };
      }

      case NodeKind.SwitchStatement: {
        const cases: IRSwitchCase[] = node.cases.map(c => ({
          kind: IRKind.SwitchCase as const,
          test: c.kind === NodeKind.CaseClause ? this.lowerExpression(c.expression) : null,
          consequent: c.statements.flatMap(s => {
            const ir = this.lowerStatement(s);
            return ir ? [ir] : [];
          }),
        }));
        return {
          kind: IRKind.SwitchStatement,
          discriminant: this.lowerExpression(node.expression),
          cases,
        };
      }

      case NodeKind.LabeledStatement:
        return {
          kind: IRKind.LabeledStatement,
          label: node.label.name,
          body: this.lowerStatement(node.body)!,
        };

      case NodeKind.EmptyStatement:
        return { kind: IRKind.Block, body: [] };

      case NodeKind.InterfaceDeclaration:
      case NodeKind.TypeAliasDeclaration:
      case NodeKind.ImportDeclaration:
      case NodeKind.ExportDeclaration:
      case NodeKind.ExportAssignment:
      case NodeKind.ModuleDeclaration:
        return null;

      case NodeKind.EnumDeclaration:
        return this.lowerEnum(node);

      default:
        return null;
    }
  }

  private lowerBlock(block: import("../ast/Statements.ts").Block): IRBlock {
    const body: IRStatement[] = [];
    for (const s of block.statements) {
      const ir = this.lowerStatement(s);
      if (ir) body.push(ir);
    }
    return { kind: IRKind.Block, body };
  }

  private lowerFunctionDecl(node: FunctionDeclaration): IRFunctionDecl {
    const params = this.lowerParams(node.parameters);
    const body = node.body ? this.lowerBlock(node.body) : { kind: IRKind.Block as const, body: [] };
    return {
      kind: IRKind.FunctionDecl,
      name: node.name?.name ?? null,
      params,
      body,
      isGenerator: node.isGenerator,
      isAsync: node.isAsync,
    };
  }

  private lowerParams(params: ReadonlyArray<Parameter>): IRParam[] {
    return params.map(p => ({
      name: this.lowerBindingName(p.name),
      rest: p.dotDotDot,
      defaultValue: p.initializer ? this.lowerExpression(p.initializer) : null,
    }));
  }

  private lowerVariableStatement(node: VariableStatement): IRVariableDecl {
    const bindings: IRBinding[] = node.declarations.map(d => ({
      name: this.lowerBindingName(d.name),
      init: d.initializer ? this.lowerExpression(d.initializer) : null,
    }));
    return { kind: IRKind.VariableDecl, declKind: node.declarationKind, bindings };
  }

  private lowerBindingName(name: BindingName): IRBindingName {
    switch (name.kind) {
      case NodeKind.Identifier:
        return { kind: IRKind.Identifier, name: name.name };
      case NodeKind.ObjectBindingPattern:
        return this.lowerObjectBindingPattern(name as ObjectBindingPattern);
      case NodeKind.ArrayBindingPattern:
        return this.lowerArrayBindingPattern(name as ArrayBindingPattern);
    }
  }

  private lowerObjectBindingPattern(node: ObjectBindingPattern): IRBindingName {
    return {
      kind: IRKind.ObjectBindingPattern,
      elements: node.elements.map(elem => this.lowerBindingElement(elem)),
    };
  }

  private lowerArrayBindingPattern(node: ArrayBindingPattern): IRBindingName {
    return {
      kind: IRKind.ArrayBindingPattern,
      elements: node.elements.map(elem => elem ? this.lowerBindingElement(elem) : undefined),
    };
  }

  private lowerBindingElement(node: BindingElement): IRBindingElement {
    return {
      kind: IRKind.BindingElement,
      propertyName: node.propertyName ? this.lowerExpression(node.propertyName) : undefined,
      name: this.lowerBindingName(node.name),
      rest: node.dotDotDot,
      optional: node.optional,
      initializer: node.initializer ? this.lowerExpression(node.initializer) : null,
    };
  }

  private lowerClassDecl(node: ClassDeclaration): IRClassDecl {
    let superClass: IRExpression | null = null;
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.linkKind === 0 && clause.types.length > 0) {
          superClass = this.lowerExpression(clause.types[0]!.expression);
          break;
        }
      }
    }

    const methods: IRMethodDecl[] = [];
    for (const member of node.members) {
      if (member.kind === NodeKind.MethodDeclaration) {
        const m = member as MethodDeclaration;
        if (!m.body) continue;
        methods.push({
          kind: IRKind.MethodDecl,
          name: m.name.kind === NodeKind.Identifier ? m.name.name : "[computed]",
          params: this.lowerParams(m.parameters),
          body: this.lowerBlock(m.body),
          isStatic: m.modifiers?.some(mod => mod.kind === NodeKind.StaticModifier) ?? false,
          isAsync: m.modifiers?.some(mod => mod.kind === NodeKind.AsyncModifier) ?? false,
          isGenerator: m.isGenerator ?? false,
          methodKind: "method",
        });
      } else if (member.kind === NodeKind.Constructor) {
        const c = member as Constructor;
        if (!c.body) continue;
        methods.push({
          kind: IRKind.MethodDecl,
          name: "constructor",
          params: this.lowerParams(c.parameters),
          body: this.lowerBlock(c.body),
          isStatic: false,
          isAsync: false,
          isGenerator: false,
          methodKind: "constructor",
        });
      } else if (member.kind === NodeKind.GetAccessor) {
        const g = member as GetAccessor;
        if (!g.body) continue;
        methods.push({
          kind: IRKind.MethodDecl,
          name: g.name.kind === NodeKind.Identifier ? g.name.name : "[computed]",
          params: [],
          body: this.lowerBlock(g.body),
          isStatic: g.modifiers?.some(m => m.kind === NodeKind.StaticModifier) ?? false,
          isAsync: false,
          isGenerator: false,
          methodKind: "get",
        });
      } else if (member.kind === NodeKind.SetAccessor) {
        const s = member as SetAccessor;
        if (!s.body) continue;
        methods.push({
          kind: IRKind.MethodDecl,
          name: s.name.kind === NodeKind.Identifier ? s.name.name : "[computed]",
          params: this.lowerParams(s.parameters),
          body: this.lowerBlock(s.body),
          isStatic: s.modifiers?.some(m => m.kind === NodeKind.StaticModifier) ?? false,
          isAsync: false,
          isGenerator: false,
          methodKind: "set",
        });
      }
    }

    return {
      kind: IRKind.ClassDecl,
      name: node.name?.name ?? null,
      superClass,
      body: methods,
    };
  }

  private lowerEnum(node: import("../ast/Declarations.ts").EnumDeclaration): IRVariableDecl {
    let counter = 0;
    const props: IRProperty[] = node.members.map(member => {
      const key: IRExpression = {
        kind: IRKind.Literal,
        value: member.name.kind === NodeKind.Identifier ? member.name.name : "",
        raw: member.name.kind === NodeKind.Identifier ? `"${member.name.name}"` : '""',
      };
      let value: IRExpression;
      if (member.initializer) {
        value = this.lowerExpression(member.initializer);
      } else {
        value = { kind: IRKind.Literal, value: counter, raw: String(counter) };
      }
      counter++;
      return { kind: IRKind.Property, key, value, computed: false, shorthand: false, spread: false };
    });

    const objExpr = { kind: IRKind.ObjectExpr as const, properties: props };
    return {
      kind: IRKind.VariableDecl,
      declKind: "const",
      bindings: [{ name: { kind: IRKind.Identifier, name: node.name.name }, init: objExpr }],
    };
  }

  private lowerForIn(node: import("../ast/Statements.ts").ForInStatement): IRStatement {
    const body = this.lowerStatement(node.body);
    return body ?? { kind: IRKind.Block, body: [] };
  }

  private lowerForOf(node: import("../ast/Statements.ts").ForOfStatement): IRStatement {
    const body = this.lowerStatement(node.body);
    return body ?? { kind: IRKind.Block, body: [] };
  }

  private lowerExpression(node: Expression): IRExpression {
    switch (node.kind) {
      case NodeKind.NumericLiteral:
        return { kind: IRKind.Literal, value: node.value, raw: node.raw };

      case NodeKind.BigIntLiteral:
        return { kind: IRKind.Literal, value: node.value, raw: node.value };

      case NodeKind.StringLiteral:
        return { kind: IRKind.Literal, value: node.value, raw: JSON.stringify(node.value) };

      case NodeKind.BooleanLiteral:
        return { kind: IRKind.Literal, value: node.value, raw: String(node.value) };

      case NodeKind.NullLiteral:
        return { kind: IRKind.Literal, value: null, raw: "null" };

      case NodeKind.UndefinedLiteral:
        return { kind: IRKind.Literal, value: undefined, raw: "undefined" };

      case NodeKind.RegexLiteral: {
        const raw = `/${node.pattern}/${node.flags}`;
        return { kind: IRKind.Literal, value: raw, raw };
      }

      case NodeKind.Identifier:
        return { kind: IRKind.Identifier, name: node.name };

      case NodeKind.BinaryExpression: {
        const assignOps = new Set(["=", "+=", "-=", "*=", "/=", "%=", "**=", "&&=", "||=", "??=", "<<=", ">>=", ">>>=", "&=", "|=", "^="]);
        if (assignOps.has(node.operator)) {
          return {
            kind: IRKind.AssignExpr,
            operator: node.operator,
            left: this.lowerExpression(node.left),
            right: this.lowerExpression(node.right),
          };
        }
        return {
          kind: IRKind.BinaryExpr,
          operator: node.operator,
          left: this.lowerExpression(node.left),
          right: this.lowerExpression(node.right),
        };
      }

      case NodeKind.UnaryExpression:
        return {
          kind: IRKind.UnaryExpr,
          operator: node.operator,
          operand: this.lowerExpression(node.operand),
          prefix: true,
        };

      case NodeKind.PostfixUnaryExpression:
        return {
          kind: IRKind.UnaryExpr,
          operator: node.operator,
          operand: this.lowerExpression(node.operand),
          prefix: false,
        };

      case NodeKind.CallExpression:
        return {
          kind: IRKind.CallExpr,
          callee: this.lowerExpression(node.callee),
          args: node.args.map(a => this.lowerExpression(a)),
          optional: node.isOptional ?? false,
        };

      case NodeKind.NewExpression:
        return {
          kind: IRKind.NewExpr,
          callee: this.lowerExpression(node.callee),
          args: (node.args ?? []).map(a => this.lowerExpression(a)),
        };

      case NodeKind.PropertyAccessExpression:
        return {
          kind: IRKind.MemberExpr,
          object: this.lowerExpression(node.object),
          property: { kind: IRKind.Identifier, name: node.property.name },
          computed: false,
          optional: node.isOptional ?? false,
        };

      case NodeKind.ElementAccessExpression:
        return {
          kind: IRKind.MemberExpr,
          object: this.lowerExpression(node.object),
          property: this.lowerExpression(node.index),
          computed: true,
          optional: node.isOptional ?? false,
        };

      case NodeKind.ConditionalExpression:
        return {
          kind: IRKind.ConditionalExpr,
          test: this.lowerExpression(node.condition),
          consequent: this.lowerExpression(node.whenTrue),
          alternate: this.lowerExpression(node.whenFalse),
        };

      case NodeKind.ArrayLiteralExpression:
        return {
          kind: IRKind.ArrayExpr,
          elements: node.elements.map(e => e ? this.lowerExpression(e as Expression) : null),
        };

      case NodeKind.ObjectLiteralExpression: {
        const props: IRProperty[] = node.properties.map(p => {
          if (p.kind === NodeKind.PropertyAssignment) {
            const key = p.name.kind === NodeKind.Identifier
              ? { kind: IRKind.Identifier as const, name: p.name.name }
              : this.lowerExpression(p.name as Expression);
            return {
              kind: IRKind.Property as const,
              key,
              value: this.lowerExpression(p.initializer),
              computed: p.name.kind === NodeKind.ComputedPropertyName,
              shorthand: false,
              spread: false,
            };
          } else if (p.kind === NodeKind.ShorthandPropertyAssignment) {
            const name = p.name.name;
            return {
              kind: IRKind.Property as const,
              key: { kind: IRKind.Identifier as const, name },
              value: { kind: IRKind.Identifier as const, name },
              computed: false,
              shorthand: true,
              spread: false,
            };
          } else {
            return {
              kind: IRKind.Property as const,
              key: { kind: IRKind.Identifier as const, name: "__spread" },
              value: this.lowerExpression((p as any).expression),
              computed: false,
              shorthand: false,
              spread: true,
            };
          }
        });
        return { kind: IRKind.ObjectExpr, properties: props };
      }

      case NodeKind.FunctionExpression:
        return {
          kind: IRKind.FunctionExpr,
          name: node.name?.name ?? null,
          params: this.lowerParams(node.parameters),
          body: node.body ? this.lowerBlock(node.body) : { kind: IRKind.Block, body: [] },
          isGenerator: node.isGenerator ?? false,
          isAsync: node.isAsync ?? false,
        };

      case NodeKind.ArrowFunctionExpression: {
        const body = node.body.kind === NodeKind.Block
          ? this.lowerBlock(node.body)
          : this.lowerExpression(node.body as Expression);
        return {
          kind: IRKind.ArrowFunctionExpr,
          params: this.lowerParams(node.parameters),
          body,
          isAsync: node.isAsync ?? false,
        };
      }

      case NodeKind.TemplateLiteral: {
        const quasis: string[] = [node.head ?? ""];
        const expressions: IRExpression[] = [];
        for (const span of node.spans ?? []) {
          expressions.push(this.lowerExpression(span.expression));
          quasis.push(span.tail ?? "");
        }
        return { kind: IRKind.TemplateLiteral, quasis, expressions };
      }

      case NodeKind.TaggedTemplateExpression: {
        const tag = this.lowerExpression(node.tag);
        const quasi: IRTemplateLiteral = {
          kind: IRKind.TemplateLiteral,
          quasis: [node.template.head ?? ""],
          expressions: (node.template.spans ?? []).map(s => this.lowerExpression(s.expression)),
        };
        return { kind: IRKind.TaggedTemplate, tag, quasi };
      }

      case NodeKind.ParenthesizedExpression:
        return this.lowerExpression(node.expression);

      case NodeKind.AsExpression:
      case NodeKind.SatisfiesExpression:
      case NodeKind.NonNullExpression:
      case NodeKind.TypeAssertionExpression:
        return this.lowerExpression(node.expression);

      case NodeKind.AwaitExpression:
        return { kind: IRKind.Await, argument: this.lowerExpression(node.expression) };

      case NodeKind.YieldExpression:
        return {
          kind: IRKind.Yield,
          argument: node.expression ? this.lowerExpression(node.expression) : null,
          delegate: node.delegate ?? false,
        };

      case NodeKind.DeleteExpression:
        return {
          kind: IRKind.UnaryExpr,
          operator: "delete",
          operand: this.lowerExpression(node.expression),
          prefix: true,
        };

      case NodeKind.TypeofExpression:
        return {
          kind: IRKind.UnaryExpr,
          operator: "typeof",
          operand: this.lowerExpression(node.expression),
          prefix: true,
        };

      case NodeKind.VoidExpression:
        return {
          kind: IRKind.UnaryExpr,
          operator: "void",
          operand: this.lowerExpression(node.expression),
          prefix: true,
        };

      case NodeKind.SpreadElement:
        return {
          kind: IRKind.SpreadExpr,
          argument: this.lowerExpression((node as any).expression),
        };

      default:
        return { kind: IRKind.Literal, value: undefined, raw: "undefined" };
    }
  }
}
