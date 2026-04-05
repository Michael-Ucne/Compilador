import {
  IRKind,
  type IRProgram, type IRStatement, type IRExpression,
  type IRBlock, type IRFunctionDecl, type IRVariableDecl, type IRClassDecl,
  type IRMethodDecl, type IRParam,
  type IRExprStatement, type IRIfStatement, type IRWhileStatement,
  type IRDoWhileStatement, type IRForStatement,
  type IRReturnStatement, type IRBreakStatement, type IRContinueStatement,
  type IRThrowStatement, type IRTryStatement,
  type IRSwitchStatement, type IRLabeledStatement,
  type IRLiteral, type IRIdentifier, type IRBinaryExpr, type IRUnaryExpr,
  type IRAssignExpr, type IRCallExpr, type IRNewExpr, type IRMemberExpr,
  type IRArrayExpr, type IRObjectExpr, type IRProperty,
  type IRFunctionExpr, type IRArrowFunctionExpr,
  type IRConditionalExpr, type IRSpreadExpr,
  type IRTemplateLiteral, type IRTaggedTemplate,
  type IRAwaît, type IRYield,
  type IRBindingName, type IRBindingElement,
} from "../ir/IRNode.ts";

export interface CodeGenOptions {
  indent?: number;
  semicolons?: boolean;
  minify?: boolean;
}

export class CodeGenerator {
  private readonly indentSize: number;
  private readonly semi: string;
  private readonly nl: string;
  private readonly sp: string;
  private level = 0;

  constructor(options: CodeGenOptions = {}) {
    this.indentSize = options.indent ?? 2;
    this.semi = options.semicolons === false ? "" : ";";
    const min = options.minify ?? false;
    this.nl = min ? "" : "\n";
    this.sp = min ? "" : " ";
  }

  private pad(): string {
    return " ".repeat(this.level * this.indentSize);
  }

  private indent(): void { this.level++; }
  private dedent(): void { this.level--; }

  generate(program: IRProgram): string {
    return program.body
      .map(s => this.emitStatement(s))
      .filter(s => s.trim().length > 0)
      .join(this.nl);
  }

  private emitStatement(node: IRStatement): string {
    switch (node.kind) {
      case IRKind.FunctionDecl:      return this.emitFunctionDecl(node);
      case IRKind.ClassDecl:         return this.emitClassDecl(node);
      case IRKind.VariableDecl:      return this.emitVariableDecl(node);
      case IRKind.Block:             return this.emitBlock(node);
      case IRKind.ExprStatement:     return this.emitExprStatement(node);
      case IRKind.IfStatement:       return this.emitIfStatement(node);
      case IRKind.WhileStatement:    return this.emitWhileStatement(node);
      case IRKind.DoWhileStatement:  return this.emitDoWhileStatement(node);
      case IRKind.ForStatement:      return this.emitForStatement(node);
      case IRKind.ReturnStatement:   return this.emitReturnStatement(node);
      case IRKind.BreakStatement:    return this.emitBreakStatement(node);
      case IRKind.ContinueStatement: return this.emitContinueStatement(node);
      case IRKind.ThrowStatement:    return this.emitThrowStatement(node);
      case IRKind.TryStatement:      return this.emitTryStatement(node);
      case IRKind.SwitchStatement:   return this.emitSwitchStatement(node);
      case IRKind.LabeledStatement:  return this.emitLabeledStatement(node);
      default:                       return "";
    }
  }

  private emitBlock(node: IRBlock, forceNewLine = true): string {
    if (node.body.length === 0) return `{${this.sp}}`;
    this.indent();
    const stmts = node.body.map(s => this.pad() + this.emitStatement(s)).join(this.nl);
    this.dedent();
    if (forceNewLine) return `{${this.nl}${stmts}${this.nl}${this.pad()}}`;
    return `{ ${stmts} }`;
  }

  private emitFunctionDecl(node: IRFunctionDecl): string {
    const async_ = node.isAsync ? "async " : "";
    const gen = node.isGenerator ? "*" : "";
    const name = node.name ?? "";
    const params = this.emitParams(node.params);
    const body = this.emitBlock(node.body);
    return `${async_}function${gen ? " " + gen : " "}${name}(${params})${this.sp}${body}`;
  }

  private emitParams(params: IRParam[]): string {
    return params.map(p => {
      const rest = p.rest ? "..." : "";
      const def = p.defaultValue ? `${this.sp}=${this.sp}${this.emitExpression(p.defaultValue)}` : "";
      return `${rest}${this.emitBindingName(p.name)}${def}`;
    }).join(`,${this.sp}`);
  }

  private emitClassDecl(node: IRClassDecl): string {
    const name = node.name ?? "";
    const ext = node.superClass ? ` extends ${this.emitExpression(node.superClass)}` : "";
    this.indent();
    const members = node.body.map(m => this.pad() + this.emitMethodDecl(m)).join(this.nl);
    this.dedent();
    if (node.body.length === 0) return `class ${name}${ext}${this.sp}{}`;
    return `class ${name}${ext}${this.sp}{${this.nl}${members}${this.nl}${this.pad()}}`;
  }

  private emitMethodDecl(node: IRMethodDecl): string {
    const static_ = node.isStatic ? "static " : "";
    const async_ = node.isAsync ? "async " : "";
    const gen = node.isGenerator ? "* " : "";
    const params = this.emitParams(node.params);
    const body = this.emitBlock(node.body);
    switch (node.methodKind) {
      case "constructor": return `constructor(${params})${this.sp}${body}`;
      case "get":         return `${static_}get ${node.name}()${this.sp}${body}`;
      case "set":         return `${static_}set ${node.name}(${params})${this.sp}${body}`;
      default:            return `${static_}${async_}${gen}${node.name}(${params})${this.sp}${body}`;
    }
  }

  private emitVariableDecl(node: IRVariableDecl): string {
    const bindings = node.bindings.map(b => {
      const init = b.init !== null ? `${this.sp}=${this.sp}${this.emitExpression(b.init)}` : "";
      return `${this.emitBindingName(b.name)}${init}`;
    }).join(`,${this.sp}`);
    return `${node.declKind} ${bindings}${this.semi}`;
  }

  private emitExprStatement(node: IRExprStatement): string {
    return `${this.emitExpression(node.expression)}${this.semi}`;
  }

  private emitIfStatement(node: IRIfStatement): string {
    const test = this.emitExpression(node.test);
    const cons = this.emitStatementBody(node.consequent);
    let result = `if${this.sp}(${test})${this.sp}${cons}`;
    if (node.alternate) result += `${this.sp}else${this.sp}${this.emitStatementBody(node.alternate)}`;
    return result;
  }

  private emitStatementBody(node: IRStatement): string {
    if (node.kind === IRKind.Block) return this.emitBlock(node);
    this.indent();
    const s = this.nl + this.pad() + this.emitStatement(node);
    this.dedent();
    return s;
  }

  private emitWhileStatement(node: IRWhileStatement): string {
    return `while${this.sp}(${this.emitExpression(node.test)})${this.sp}${this.emitStatementBody(node.body)}`;
  }

  private emitDoWhileStatement(node: IRDoWhileStatement): string {
    return `do${this.sp}${this.emitStatementBody(node.body)}${this.sp}while${this.sp}(${this.emitExpression(node.test)})${this.semi}`;
  }

  private emitForStatement(node: IRForStatement): string {
    let init = "";
    if (node.init) {
      if (node.init.kind === IRKind.VariableDecl) {
        const b = node.init.bindings.map(b => {
          const iv = b.init !== null ? `${this.sp}=${this.sp}${this.emitExpression(b.init)}` : "";
          return `${this.emitBindingName(b.name)}${iv}`;
        }).join(`,${this.sp}`);
        init = `${node.init.declKind} ${b}`;
      } else {
        init = this.emitExpression(node.init as IRExpression);
      }
    }
    const test = node.test ? this.emitExpression(node.test) : "";
    const update = node.update ? this.emitExpression(node.update) : "";
    return `for${this.sp}(${init};${this.sp}${test};${this.sp}${update})${this.sp}${this.emitStatementBody(node.body)}`;
  }

  private emitReturnStatement(node: IRReturnStatement): string {
    return node.argument ? `return ${this.emitExpression(node.argument)}${this.semi}` : `return${this.semi}`;
  }

  private emitBreakStatement(node: IRBreakStatement): string {
    return node.label ? `break ${node.label}${this.semi}` : `break${this.semi}`;
  }

  private emitContinueStatement(node: IRContinueStatement): string {
    return node.label ? `continue ${node.label}${this.semi}` : `continue${this.semi}`;
  }

  private emitThrowStatement(node: IRThrowStatement): string {
    return `throw ${this.emitExpression(node.argument)}${this.semi}`;
  }

  private emitTryStatement(node: IRTryStatement): string {
    let result = `try${this.sp}${this.emitBlock(node.block)}`;
    if (node.handler) {
      const param = node.handler.param ? `(${node.handler.param})` : "(_e)";
      result += `${this.sp}catch${this.sp}${param}${this.sp}${this.emitBlock(node.handler.body)}`;
    }
    if (node.finalizer) result += `${this.sp}finally${this.sp}${this.emitBlock(node.finalizer)}`;
    return result;
  }

  private emitSwitchStatement(node: IRSwitchStatement): string {
    const disc = this.emitExpression(node.discriminant);
    this.indent();
    const cases = node.cases.map(c => {
      const head = c.test ? `case ${this.emitExpression(c.test)}:` : "default:";
      this.indent();
      const stmts = c.consequent.map(s => this.pad() + this.emitStatement(s)).join(this.nl);
      this.dedent();
      return this.pad() + head + (stmts ? this.nl + stmts : "");
    }).join(this.nl);
    this.dedent();
    return `switch${this.sp}(${disc})${this.sp}{${this.nl}${cases}${this.nl}${this.pad()}}`;
  }

  private emitLabeledStatement(node: IRLabeledStatement): string {
    return `${node.label}:${this.sp}${this.emitStatement(node.body)}`;
  }

  emitExpression(node: IRExpression, parentPrec = 0): string {
    switch (node.kind) {
      case IRKind.Literal:           return this.emitLiteral(node);
      case IRKind.Identifier:        return node.name;
      case IRKind.BinaryExpr:        return this.emitBinaryExpr(node, parentPrec);
      case IRKind.UnaryExpr:         return this.emitUnaryExpr(node, parentPrec);
      case IRKind.AssignExpr:        return this.emitAssignExpr(node, parentPrec);
      case IRKind.CallExpr:          return this.emitCallExpr(node);
      case IRKind.NewExpr:           return this.emitNewExpr(node);
      case IRKind.MemberExpr:        return this.emitMemberExpr(node);
      case IRKind.ArrayExpr:         return this.emitArrayExpr(node);
      case IRKind.ObjectExpr:        return this.emitObjectExpr(node);
      case IRKind.FunctionExpr:      return this.emitFunctionExpr(node);
      case IRKind.ArrowFunctionExpr: return this.emitArrowFunctionExpr(node);
      case IRKind.SequenceExpr:      return node.expressions.map(e => this.emitExpression(e)).join(`,${this.sp}`);
      case IRKind.ConditionalExpr:   return this.emitConditionalExpr(node, parentPrec);
      case IRKind.SpreadExpr:        return `...${this.emitExpression(node.argument)}`;
      case IRKind.TemplateLiteral:   return this.emitTemplateLiteral(node);
      case IRKind.TaggedTemplate:    return this.emitTaggedTemplate(node);
      case IRKind.Await:             return `await ${this.emitExpression(node.argument, 16)}`;
      case IRKind.Yield:             return this.emitYield(node);
      default:                       return "undefined";
    }
  }

  private emitLiteral(node: IRLiteral): string {
    if (node.value === null) return "null";
    if (node.value === undefined) return "undefined";
    if (typeof node.value === "string") return JSON.stringify(node.value);
    if (typeof node.value === "number") return String(node.value);
    if (typeof node.value === "boolean") return String(node.value);
    return node.raw;
  }

  private static readonly PREC: Record<string, number> = {
    "||": 4, "??": 4, "&&": 5,
    "|": 6, "^": 7, "&": 8,
    "==": 9, "!=": 9, "===": 9, "!==": 9,
    "<": 10, ">": 10, "<=": 10, ">=": 10, "in": 10, "instanceof": 10,
    "<<": 11, ">>": 11, ">>>": 11,
    "+": 12, "-": 12,
    "*": 13, "/": 13, "%": 13,
    "**": 14,
  };

  private emitBinaryExpr(node: IRBinaryExpr, parentPrec: number): string {
    const prec = CodeGenerator.PREC[node.operator] ?? 0;
    const left = this.emitExpression(node.left, prec);
    const right = this.emitExpression(node.right, prec + 1);
    const expr = `${left}${this.sp}${node.operator}${this.sp}${right}`;
    return prec < parentPrec ? `(${expr})` : expr;
  }

  private emitUnaryExpr(node: IRUnaryExpr, _parentPrec: number): string {
    const operand = this.emitExpression(node.operand, 16);
    if (node.prefix) {
      const space = /^[a-z]/.test(node.operator) ? " " : "";
      return `${node.operator}${space}${operand}`;
    }
    return `${operand}${node.operator}`;
  }

  private emitAssignExpr(node: IRAssignExpr, parentPrec: number): string {
    const left = this.emitExpression(node.left);
    const right = this.emitExpression(node.right, 3);
    const expr = `${left}${this.sp}${node.operator}${this.sp}${right}`;
    return parentPrec > 3 ? `(${expr})` : expr;
  }

  private emitCallExpr(node: IRCallExpr): string {
    const callee = this.emitExpression(node.callee, 18);
    const args = node.args.map(a => this.emitExpression(a)).join(`,${this.sp}`);
    const opt = node.optional ? "?." : "";
    return `${callee}${opt}(${args})`;
  }

  private emitNewExpr(node: IRNewExpr): string {
    const callee = this.emitExpression(node.callee, 18);
    const args = node.args.map(a => this.emitExpression(a)).join(`,${this.sp}`);
    return `new ${callee}(${args})`;
  }

  private emitMemberExpr(node: IRMemberExpr): string {
    const obj = this.emitExpression(node.object, 18);
    const opt = node.optional ? "?" : "";
    if (node.computed) return `${obj}${opt}[${this.emitExpression(node.property)}]`;
    const prop = (node.property as IRIdentifier).name;
    return `${obj}${opt}.${prop}`;
  }

  private emitArrayExpr(node: IRArrayExpr): string {
    const elems = node.elements.map(e => e ? this.emitExpression(e) : "").join(`,${this.sp}`);
    return `[${elems}]`;
  }

  private emitObjectExpr(node: IRObjectExpr): string {
    if (node.properties.length === 0) return "{}";
    const props = node.properties.map(p => this.emitProperty(p)).join(`,${this.sp}`);
    return `{${this.sp}${props}${this.sp}}`;
  }

  private emitProperty(node: IRProperty): string {
    if (node.spread) return `...${this.emitExpression(node.value)}`;
    if (node.shorthand) return (node.key as IRIdentifier).name;
    const key = node.computed
      ? `[${this.emitExpression(node.key)}]`
      : node.key.kind === IRKind.Identifier
        ? node.key.name
        : this.emitExpression(node.key);
    return `${key}:${this.sp}${this.emitExpression(node.value)}`;
  }

  private emitBindingName(node: IRBindingName): string {
    switch (node.kind) {
      case IRKind.Identifier:
        return node.name;
      case IRKind.ObjectBindingPattern:
        if (node.elements.length === 0) return "{}";
        return `{${this.sp}${node.elements.map(elem => this.emitBindingElement(elem)).join(`,${this.sp}`)}${this.sp}}`;
      case IRKind.ArrayBindingPattern:
        return `[${node.elements.map(elem => elem ? this.emitBindingElement(elem) : "").join(`,${this.sp}`)}]`;
      default:
        return "";
    }
  }

  private emitBindingElement(node: IRBindingElement): string {
    const name = this.emitBindingName(node.name);
    const init = node.initializer ? `${this.sp}=${this.sp}${this.emitExpression(node.initializer)}` : "";
    if (node.rest) return `...${name}`;

    if (!node.propertyName) {
      return `${name}${init}`;
    }

    const key = node.propertyName.kind === IRKind.Identifier
      ? node.propertyName.name
      : `[${this.emitExpression(node.propertyName)}]`;

    if (node.name.kind === IRKind.Identifier && node.name.name === key && !node.initializer) {
      return key;
    }

    return `${key}:${this.sp}${name}${init}`;
  }

  private emitFunctionExpr(node: IRFunctionExpr): string {
    const async_ = node.isAsync ? "async " : "";
    const gen = node.isGenerator ? "*" : "";
    const name = node.name ? ` ${node.name}` : "";
    const params = this.emitParams(node.params);
    return `${async_}function${gen}${name}(${params})${this.sp}${this.emitBlock(node.body)}`;
  }

  private emitArrowFunctionExpr(node: IRArrowFunctionExpr): string {
    const async_ = node.isAsync ? "async " : "";
    const params = node.params.length === 1 && !node.params[0]!.rest && !node.params[0]!.defaultValue
      ? node.params[0]!.name
      : `(${this.emitParams(node.params)})`;
    const body = node.body.kind === IRKind.Block
      ? this.emitBlock(node.body)
      : this.emitExpression(node.body as IRExpression, 3);
    return `${async_}${params}${this.sp}=>${this.sp}${body}`;
  }

  private emitConditionalExpr(node: IRConditionalExpr, parentPrec: number): string {
    const test = this.emitExpression(node.test, 4);
    const cons = this.emitExpression(node.consequent, 3);
    const alt = this.emitExpression(node.alternate, 3);
    const expr = `${test}${this.sp}?${this.sp}${cons}${this.sp}:${this.sp}${alt}`;
    return parentPrec > 3 ? `(${expr})` : expr;
  }

  private emitTemplateLiteral(node: IRTemplateLiteral): string {
    let result = "`" + (node.quasis[0] ?? "");
    for (let i = 0; i < node.expressions.length; i++) {
      result += "${" + this.emitExpression(node.expressions[i]!) + "}";
      result += node.quasis[i + 1] ?? "";
    }
    return result + "`";
  }

  private emitTaggedTemplate(node: IRTaggedTemplate): string {
    return `${this.emitExpression(node.tag)}${this.emitTemplateLiteral(node.quasi)}`;
  }

  private emitYield(node: IRYield): string {
    const del = node.delegate ? "*" : "";
    const arg = node.argument ? ` ${this.emitExpression(node.argument)}` : "";
    return `yield${del}${arg}`;
  }
}
