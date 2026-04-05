import { ParseContext } from "./ParseContext.ts";
import { Lexer } from "../lexer/Lexer.ts";
import { TokenType, isModifier } from "../lexer/TokenType.ts";
import type { DiagnosticBag } from "../errors/DiagnosticBag.ts";
import { Diagnostics } from "../errors/Diagnostic.ts";
import { NodeKind, HeritageLinkKind } from "../ast/Node.ts";
import type { Modifier } from "../ast/Node.ts";
import type { SourceFile, Statement, Declaration, Block } from "../ast/index.ts";
import type {
  FunctionDeclaration, ClassDeclaration, InterfaceDeclaration,
  EnumDeclaration, EnumMember, TypeAliasDeclaration,
  VariableStatement, VariableDeclaration, Parameter, TypeParameter,
  HeritageClause, ExpressionWithTypeArguments,
  ClassElement, TypeElement,
  PropertyDeclaration, MethodDeclaration, Constructor, GetAccessor, SetAccessor,
  IndexSignature, PropertySignature, MethodSignature, ConstructSignature, CallSignature,
  ModuleDeclaration, ModuleBlock,
  ImportDeclaration, ImportClause, NamedImports, ImportSpecifier, NamespaceImport,
  ExportDeclaration, NamedExports, ExportSpecifier, ExportAssignment,
  Decorator, BindingName, BindingElement, ObjectBindingPattern, ArrayBindingPattern,
} from "../ast/Declarations.ts";
import type {
  Expression, Identifier, StringLiteral, NumericLiteral, BigIntLiteral,
  BooleanLiteral, NullLiteral, RegexLiteral, TemplateLiteral, TemplateSpan,
  TaggedTemplateExpression, BinaryExpression, UnaryExpression, PostfixUnaryExpression,
  ConditionalExpression, CallExpression, NewExpression,
  PropertyAccessExpression, ElementAccessExpression,
  ArrowFunctionExpression, FunctionExpression,
  ObjectLiteralExpression, ObjectLiteralElement, PropertyAssignment,
  ShorthandPropertyAssignment, SpreadAssignment, ComputedPropertyName,
  ArrayLiteralExpression, SpreadElement,
  AsExpression, SatisfiesExpression, NonNullExpression, TypeAssertionExpression,
  AwaitExpression, YieldExpression, DeleteExpression, TypeofExpression,
  VoidExpression, ParenthesizedExpression,
} from "../ast/Expressions.ts";
import type {
  IfStatement, WhileStatement, DoStatement, ForStatement,
  ForInStatement, ForOfStatement, ReturnStatement, BreakStatement,
  ContinueStatement, ThrowStatement, TryStatement, CatchClause,
  SwitchStatement, CaseClause, DefaultClause, LabeledStatement,
  ExpressionStatement, EmptyStatement,
} from "../ast/Statements.ts";
import type {
  TypeNode, TypeReference, QualifiedName, EntityName, ArrayType, TupleType,
  NamedTupleMember, UnionType, IntersectionType, FunctionType, ConstructorType,
  TypeLiteral, ParenthesizedType, ThisType, TypePredicate, LiteralType,
  TemplateLiteralType, TemplateLiteralTypeSpan, KeyofType, UniqueType, ReadonlyType,
  ConditionalType, InferType, MappedType, IndexedAccessType, TypeQuery,
} from "../ast/Types.ts";
import type { Token } from "../lexer/Token.ts";

// Tabla de precedencias para operadores binarios (Pratt climbing)
const BINARY_PRECEDENCE: Partial<Record<TokenType, number>> = {
  [TokenType.BarBar]: 4,
  [TokenType.QuestionQuestion]: 4,
  [TokenType.AmpersandAmpersand]: 5,
  [TokenType.Bar]: 6,
  [TokenType.Caret]: 7,
  [TokenType.Ampersand]: 8,
  [TokenType.EqualsEquals]: 9,
  [TokenType.ExclamationEquals]: 9,
  [TokenType.EqualsEqualsEquals]: 9,
  [TokenType.ExclamationEqualsEquals]: 9,
  [TokenType.LessThan]: 10,
  [TokenType.GreaterThan]: 10,
  [TokenType.LessThanEquals]: 10,
  [TokenType.GreaterThanEquals]: 10,
  [TokenType.InKeyword]: 10,
  [TokenType.InstanceofKeyword]: 10,
  [TokenType.LessThanLessThan]: 11,
  [TokenType.GreaterThanGreaterThan]: 11,
  [TokenType.GreaterThanGreaterThanGreaterThan]: 11,
  [TokenType.Plus]: 12,
  [TokenType.Minus]: 12,
  [TokenType.Asterisk]: 13,
  [TokenType.Slash]: 13,
  [TokenType.Percent]: 13,
  [TokenType.AsteriskAsterisk]: 14, // right-associative
};

const ASSIGNMENT_OPERATORS = new Set<TokenType>([
  TokenType.Equals, TokenType.PlusEquals, TokenType.MinusEquals,
  TokenType.AsteriskEquals, TokenType.SlashEquals, TokenType.PercentEquals,
  TokenType.AsteriskAsteriskEquals, TokenType.LessThanLessThanEquals,
  TokenType.GreaterThanGreaterThanEquals, TokenType.GreaterThanGreaterThanGreaterThanEquals,
  TokenType.AmpersandEquals, TokenType.BarEquals, TokenType.CaretEquals,
  TokenType.AmpersandAmpersandEquals, TokenType.BarBarEquals,
  TokenType.QuestionQuestionEquals,
]);

export class Parser {
  private readonly ctx: ParseContext;
  private readonly diagnostics: DiagnosticBag;
  private fileName: string = "<source>";
  private source: string = "";

  constructor(lexer: Lexer, diagnostics: DiagnosticBag) {
    this.ctx = new ParseContext(lexer, diagnostics);
    this.diagnostics = diagnostics;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PUNTO DE ENTRADA
  // ────────────────────────────────────────────────────────────────────────────

  parseSourceFile(fileName: string, source: string): SourceFile {
    this.fileName = fileName;
    this.source = source;
    const start = 0;
    const statements: Statement[] = [];

    while (!this.ctx.isEOF()) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }

    return {
      kind: NodeKind.SourceFile,
      fileName,
      statements,
      start,
      end: source.length,
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SENTENCIAS
  // ────────────────────────────────────────────────────────────────────────────

  private parseStatement(): Statement | undefined {
    const decorators = this.parseDecorators();
    const modifiers = this.parseModifiers();

    switch (this.ctx.currentType()) {
      case TokenType.FunctionKeyword:
        return this.parseFunctionDeclaration(modifiers, decorators);
      case TokenType.ClassKeyword:
        return this.parseClassDeclaration(modifiers, decorators);
      case TokenType.InterfaceKeyword:
        return this.parseInterfaceDeclaration(modifiers);
      case TokenType.TypeKeyword:
        if (this.isTypeAliasDeclaration()) return this.parseTypeAliasDeclaration(modifiers);
        break;
      case TokenType.EnumKeyword:
        return this.parseEnumDeclaration(modifiers);
      case TokenType.ConstKeyword:
      case TokenType.LetKeyword:
      case TokenType.VarKeyword:
        return this.parseVariableStatement(modifiers);
      case TokenType.ImportKeyword:
        if (modifiers.length === 0) return this.parseImportDeclaration();
        break;
      case TokenType.ExportKeyword:
        return this.parseExportDeclaration(modifiers);
      case TokenType.NamespaceKeyword:
      case TokenType.ModuleKeyword:
        return this.parseModuleDeclaration(modifiers);
      case TokenType.DeclareKeyword:
        if (modifiers.length === 0) {
          const declMods = this.parseModifiers();
          return this.parseStatement(); // reparse con declare
        }
        break;
      case TokenType.OpenBrace:
        if (modifiers.length === 0 && decorators.length === 0) return this.parseBlock();
        break;
      case TokenType.IfKeyword:
        return this.parseIfStatement();
      case TokenType.WhileKeyword:
        return this.parseWhileStatement();
      case TokenType.DoKeyword:
        return this.parseDoStatement();
      case TokenType.ForKeyword:
        return this.parseForStatement();
      case TokenType.ReturnKeyword:
        return this.parseReturnStatement();
      case TokenType.BreakKeyword:
        return this.parseBreakStatement();
      case TokenType.ContinueKeyword:
        return this.parseContinueStatement();
      case TokenType.ThrowKeyword:
        return this.parseThrowStatement();
      case TokenType.TryKeyword:
        return this.parseTryStatement();
      case TokenType.SwitchKeyword:
        return this.parseSwitchStatement();
      case TokenType.Semicolon: {
        const start = this.ctx.getNodeStart();
        this.ctx.consume();
        return { kind: NodeKind.EmptyStatement, start, end: this.lastEnd() } as EmptyStatement;
      }
    }

    // Labeled statement o expression statement
    if (this.ctx.currentType() === TokenType.Identifier && this.ctx.peek(1).type === TokenType.Colon) {
      return this.parseLabeledStatement();
    }

    return this.parseExpressionStatement(modifiers);
  }

  private parseBlock(): Block {
    const start = this.ctx.getNodeStart();
    this.ctx.expect(TokenType.OpenBrace);
    const statements: Statement[] = [];
    while (!this.ctx.match(TokenType.CloseBrace, TokenType.EOF)) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }
    this.ctx.expect(TokenType.CloseBrace);
    return { kind: NodeKind.Block, statements, start, end: this.lastEnd() };
  }

  private parseExpressionStatement(modifiers: Modifier[]): ExpressionStatement {
    const start = this.ctx.getNodeStart();
    const expr = this.parseExpression();
    this.consumeSemicolon();
    return { kind: NodeKind.ExpressionStatement, expression: expr, start, end: this.lastEnd() };
  }

  private parseIfStatement(): IfStatement {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'if'
    this.ctx.expect(TokenType.OpenParen);
    const condition = this.parseExpression();
    this.ctx.expect(TokenType.CloseParen);
    const thenBranch = this.parseStatement()!;
    let elseBranch: Statement | undefined;
    if (this.ctx.tryConsume(TokenType.ElseKeyword)) {
      elseBranch = this.parseStatement() ?? undefined;
    }
    return { kind: NodeKind.IfStatement, condition, thenBranch, elseBranch, start, end: this.lastEnd() };
  }

  private parseWhileStatement(): WhileStatement {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'while'
    this.ctx.expect(TokenType.OpenParen);
    const condition = this.parseExpression();
    this.ctx.expect(TokenType.CloseParen);
    const body = this.parseStatement()!;
    return { kind: NodeKind.WhileStatement, condition, body, start, end: this.lastEnd() };
  }

  private parseDoStatement(): DoStatement {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'do'
    const body = this.parseStatement()!;
    this.ctx.expect(TokenType.WhileKeyword);
    this.ctx.expect(TokenType.OpenParen);
    const condition = this.parseExpression();
    this.ctx.expect(TokenType.CloseParen);
    this.consumeSemicolon();
    return { kind: NodeKind.DoStatement, body, condition, start, end: this.lastEnd() };
  }

  private parseForStatement(): ForStatement | ForInStatement | ForOfStatement {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'for'
    const isAwait = this.ctx.tryConsume(TokenType.AwaitKeyword);
    this.ctx.expect(TokenType.OpenParen);

    // Parsear el inicializador
    let init: VariableStatement | Expression | undefined;
    if (this.ctx.match(TokenType.ConstKeyword, TokenType.LetKeyword, TokenType.VarKeyword)) {
      init = this.parseVariableStatement([]);
    } else if (!this.ctx.match(TokenType.Semicolon)) {
      init = this.parseExpression();
    }

    // Determinar si es for-in, for-of o for clásico
    if (this.ctx.tryConsume(TokenType.InKeyword)) {
      const expression = this.parseExpression();
      this.ctx.expect(TokenType.CloseParen);
      const body = this.parseStatement()!;
      return { kind: NodeKind.ForInStatement, initializer: init!, expression, body, start, end: this.lastEnd() };
    }

    if (this.ctx.peek(0).value === "of" || this.ctx.currentType() === TokenType.OfKeyword) {
      this.ctx.consume();
      const expression = this.parseExpression();
      this.ctx.expect(TokenType.CloseParen);
      const body = this.parseStatement()!;
      return { kind: NodeKind.ForOfStatement, isAwait, initializer: init!, expression, body, start, end: this.lastEnd() };
    }

    // for clásico
    this.consumeSemicolon();
    const condition = this.ctx.match(TokenType.Semicolon) ? undefined : this.parseExpression();
    this.consumeSemicolon();
    const update = this.ctx.match(TokenType.CloseParen) ? undefined : this.parseExpression();
    this.ctx.expect(TokenType.CloseParen);
    const body = this.parseStatement()!;
    return { kind: NodeKind.ForStatement, init, condition, update, body, start, end: this.lastEnd() };
  }

  private parseReturnStatement(): ReturnStatement {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'return'
    let expression: Expression | undefined;
    if (!this.ctx.match(TokenType.Semicolon, TokenType.CloseBrace, TokenType.EOF)) {
      expression = this.parseExpression();
    }
    this.consumeSemicolon();
    return { kind: NodeKind.ReturnStatement, expression, start, end: this.lastEnd() };
  }

  private parseBreakStatement(): BreakStatement {
    const start = this.ctx.getNodeStart();
    this.ctx.consume();
    const label = this.ctx.currentType() === TokenType.Identifier ? this.parseIdentifier() : undefined;
    this.consumeSemicolon();
    return { kind: NodeKind.BreakStatement, label, start, end: this.lastEnd() };
  }

  private parseContinueStatement(): ContinueStatement {
    const start = this.ctx.getNodeStart();
    this.ctx.consume();
    const label = this.ctx.currentType() === TokenType.Identifier ? this.parseIdentifier() : undefined;
    this.consumeSemicolon();
    return { kind: NodeKind.ContinueStatement, label, start, end: this.lastEnd() };
  }

  private parseThrowStatement(): ThrowStatement {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'throw'
    const expression = this.parseExpression();
    this.consumeSemicolon();
    return { kind: NodeKind.ThrowStatement, expression, start, end: this.lastEnd() };
  }

  private parseTryStatement(): TryStatement {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'try'
    const tryBlock = this.parseBlock();
    let catchClause: CatchClause | undefined;
    let finallyBlock: Block | undefined;

    if (this.ctx.tryConsume(TokenType.CatchKeyword)) {
      const catchStart = this.lastEnd() - 5;
      let binding: Expression | undefined;
      if (this.ctx.tryConsume(TokenType.OpenParen)) {
        binding = this.parseExpression();
        this.ctx.expect(TokenType.CloseParen);
      }
      const body = this.parseBlock();
      catchClause = { kind: NodeKind.CatchClause, binding, body, start: catchStart, end: this.lastEnd() };
    }

    if (this.ctx.tryConsume(TokenType.FinallyKeyword)) {
      finallyBlock = this.parseBlock();
    }

    return { kind: NodeKind.TryStatement, tryBlock, catchClause, finallyBlock, start, end: this.lastEnd() };
  }

  private parseSwitchStatement(): SwitchStatement {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'switch'
    this.ctx.expect(TokenType.OpenParen);
    const expression = this.parseExpression();
    this.ctx.expect(TokenType.CloseParen);
    this.ctx.expect(TokenType.OpenBrace);

    const cases: (CaseClause | DefaultClause)[] = [];
    while (!this.ctx.match(TokenType.CloseBrace, TokenType.EOF)) {
      const caseStart = this.ctx.getNodeStart();
      if (this.ctx.tryConsume(TokenType.CaseKeyword)) {
        const expr = this.parseExpression();
        this.ctx.expect(TokenType.Colon);
        const stmts: Statement[] = [];
        while (!this.ctx.match(TokenType.CaseKeyword, TokenType.DefaultKeyword, TokenType.CloseBrace, TokenType.EOF)) {
          const s = this.parseStatement();
          if (s) stmts.push(s);
        }
        cases.push({ kind: NodeKind.CaseClause, expression: expr, statements: stmts, start: caseStart, end: this.lastEnd() });
      } else if (this.ctx.tryConsume(TokenType.DefaultKeyword)) {
        this.ctx.expect(TokenType.Colon);
        const stmts: Statement[] = [];
        while (!this.ctx.match(TokenType.CaseKeyword, TokenType.DefaultKeyword, TokenType.CloseBrace, TokenType.EOF)) {
          const s = this.parseStatement();
          if (s) stmts.push(s);
        }
        cases.push({ kind: NodeKind.DefaultClause, statements: stmts, start: caseStart, end: this.lastEnd() });
      } else {
        this.synchronize();
      }
    }
    this.ctx.expect(TokenType.CloseBrace);
    return { kind: NodeKind.SwitchStatement, expression, cases, start, end: this.lastEnd() };
  }

  private parseLabeledStatement(): LabeledStatement {
    const start = this.ctx.getNodeStart();
    const label = this.parseIdentifier();
    this.ctx.consume(); // ':'
    const body = this.parseStatement()!;
    return { kind: NodeKind.LabeledStatement, label, body, start, end: this.lastEnd() };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DECLARACIONES
  // ────────────────────────────────────────────────────────────────────────────

  private parseDecorators(): Decorator[] {
    const decorators: Decorator[] = [];
    while (this.ctx.currentType() === TokenType.At) {
      const start = this.ctx.getNodeStart();
      this.ctx.consume(); // '@'
      const expression = this.parseLeftHandSideExpression();
      decorators.push({ kind: NodeKind.Decorator, expression, start, end: this.lastEnd() });
    }
    return decorators;
  }

  private parseModifiers(): Modifier[] {
    const mods: Modifier[] = [];
    while (isModifier(this.ctx.currentType())) {
      const start = this.ctx.getNodeStart();
      const tok = this.ctx.consume();
      mods.push({ kind: tokenToModifierKind(tok.type), start, end: this.lastEnd() } as Modifier);
    }
    return mods;
  }

  private parseTypeParameters(): TypeParameter[] | undefined {
    if (this.ctx.currentType() !== TokenType.LessThan) return undefined;
    this.ctx.consume(); // '<'
    const params: TypeParameter[] = [];
    while (!this.ctx.match(TokenType.GreaterThan, TokenType.EOF)) {
      params.push(this.parseTypeParameter());
      if (!this.ctx.tryConsume(TokenType.Comma)) break;
    }
    this.ctx.expect(TokenType.GreaterThan);
    return params;
  }

  private parseTypeParameter(): TypeParameter {
    const start = this.ctx.getNodeStart();
    const name = this.parseIdentifier();
    let constraint: TypeNode | undefined;
    let defaultType: TypeNode | undefined;
    if (this.ctx.tryConsume(TokenType.ExtendsKeyword)) {
      constraint = this.parseTypeNode();
    }
    if (this.ctx.tryConsume(TokenType.Equals)) {
      defaultType = this.parseTypeNode();
    }
    return { kind: NodeKind.TypeParameter, name, constraint, defaultType, start, end: this.lastEnd() };
  }

  private parseParameters(): Parameter[] {
    this.ctx.expect(TokenType.OpenParen);
    const params: Parameter[] = [];
    while (!this.ctx.match(TokenType.CloseParen, TokenType.EOF)) {
      params.push(this.parseParameter());
      if (!this.ctx.tryConsume(TokenType.Comma)) break;
    }
    this.ctx.expect(TokenType.CloseParen);
    return params;
  }

  private parseParameter(): Parameter {
    const start = this.ctx.getNodeStart();
    const modifiers = this.parseModifiers();
    const dotDotDot = this.ctx.tryConsume(TokenType.DotDotDot);
    const name = this.parseBindingName();
    const optional = this.ctx.tryConsume(TokenType.Question);
    let type: TypeNode | undefined;
    if (this.ctx.tryConsume(TokenType.Colon)) {
      type = this.parseTypeNode();
    }
    let initializer: Expression | undefined;
    if (this.ctx.tryConsume(TokenType.Equals)) {
      initializer = this.parseAssignmentExpression();
    }
    return { kind: NodeKind.Parameter, modifiers: modifiers.length ? modifiers : undefined, dotDotDot, name, optional, type, initializer, start, end: this.lastEnd() };
  }

  private parseBindingName(): BindingName {
    if (this.ctx.currentType() === TokenType.OpenBrace) return this.parseObjectBindingPattern();
    if (this.ctx.currentType() === TokenType.OpenBracket) return this.parseArrayBindingPattern();
    return this.parseIdentifier();
  }

  private parseObjectBindingPattern(): ObjectBindingPattern {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // '{'
    const elements: BindingElement[] = [];
    while (!this.ctx.match(TokenType.CloseBrace, TokenType.EOF)) {
      elements.push(this.parseBindingElement());
      if (!this.ctx.tryConsume(TokenType.Comma)) break;
    }
    this.ctx.expect(TokenType.CloseBrace);
    return { kind: NodeKind.ObjectBindingPattern, elements, start, end: this.lastEnd() };
  }

  private parseArrayBindingPattern(): ArrayBindingPattern {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // '['
    const elements: (BindingElement | undefined)[] = [];
    while (!this.ctx.match(TokenType.CloseBracket, TokenType.EOF)) {
      if (this.ctx.currentType() === TokenType.Comma) {
        elements.push(undefined); // elision
        this.ctx.consume();
        continue;
      }
      elements.push(this.parseBindingElement());
      if (!this.ctx.tryConsume(TokenType.Comma)) break;
    }
    this.ctx.expect(TokenType.CloseBracket);
    return { kind: NodeKind.ArrayBindingPattern, elements, start, end: this.lastEnd() };
  }

  private parseBindingElement(): BindingElement {
    const start = this.ctx.getNodeStart();
    const dotDotDot = this.ctx.tryConsume(TokenType.DotDotDot);

    // Puede ser `key: binding` o solo `binding`
    let propertyName: Identifier | Expression | undefined;
    let name: BindingName;

    // Intento lookahead: identifier seguido de ':' → propertyName : name
    if (
      this.ctx.currentType() === TokenType.Identifier &&
      this.ctx.peek(1).type === TokenType.Colon
    ) {
      propertyName = this.parseIdentifier();
      this.ctx.consume(); // ':'
      name = this.parseBindingName();
    } else {
      name = this.parseBindingName();
    }

    const optional = this.ctx.tryConsume(TokenType.Question);
    let initializer: Expression | undefined;
    if (this.ctx.tryConsume(TokenType.Equals)) {
      initializer = this.parseAssignmentExpression();
    }

    return { kind: NodeKind.BindingElement, propertyName, name, dotDotDot, optional, initializer, start, end: this.lastEnd() };
  }

  // ── Funciones ─────────────────────────────────────────────────────────────

  private parseFunctionDeclaration(modifiers: Modifier[], decorators: Decorator[] = []): FunctionDeclaration {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'function'
    const isGenerator = this.ctx.tryConsume(TokenType.Asterisk);
    const isAsync = modifiers.some(m => m.kind === NodeKind.AsyncModifier);
    const name = this.ctx.currentType() === TokenType.Identifier ? this.parseIdentifier() : undefined;
    const typeParameters = this.parseTypeParameters();
    const parameters = this.parseParameters();
    let returnType: TypeNode | undefined;
    if (this.ctx.tryConsume(TokenType.Colon)) returnType = this.parseTypeNode();
    const body = this.ctx.currentType() === TokenType.OpenBrace ? this.parseBlock() : undefined;
    if (!body) this.consumeSemicolon();
    return {
      kind: NodeKind.FunctionDeclaration,
      modifiers: modifiers.length ? modifiers : undefined,
      name, isGenerator, isAsync, typeParameters, parameters, returnType, body,
      start, end: this.lastEnd(),
    };
  }

  // ── Variables ─────────────────────────────────────────────────────────────

  private parseVariableStatement(modifiers: Modifier[]): VariableStatement {
    const start = this.ctx.getNodeStart();
    const kwTok = this.ctx.consume();
    const declarationKind = kwTok.value as "const" | "let" | "var";
    const declarations: VariableDeclaration[] = [];
    do {
      declarations.push(this.parseVariableDeclaration());
    } while (this.ctx.tryConsume(TokenType.Comma));
    this.consumeSemicolon();
    return { kind: NodeKind.VariableStatement, modifiers: modifiers.length ? modifiers : undefined, declarationKind, declarations, start, end: this.lastEnd() };
  }

  private parseVariableDeclaration(): VariableDeclaration {
    const start = this.ctx.getNodeStart();
    const name = this.parseBindingName();
    let type: TypeNode | undefined;
    if (this.ctx.tryConsume(TokenType.Colon)) type = this.parseTypeNode();
    let initializer: Expression | undefined;
    if (this.ctx.tryConsume(TokenType.Equals)) initializer = this.parseAssignmentExpression();
    return { kind: NodeKind.VariableDeclaration, name, type, initializer, start, end: this.lastEnd() };
  }

  // ── Clases ────────────────────────────────────────────────────────────────

  private parseClassDeclaration(modifiers: Modifier[], decorators: Decorator[] = []): ClassDeclaration {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'class'
    const name = this.ctx.currentType() === TokenType.Identifier ? this.parseIdentifier() : undefined;
    const typeParameters = this.parseTypeParameters();
    const heritageClauses = this.parseHeritageClauses();
    this.ctx.expect(TokenType.OpenBrace);
    const members = this.parseClassBody();
    this.ctx.expect(TokenType.CloseBrace);
    return {
      kind: NodeKind.ClassDeclaration,
      modifiers: modifiers.length ? modifiers : undefined,
      name, typeParameters, heritageClauses, members,
      start, end: this.lastEnd(),
    };
  }

  private parseHeritageClauses(): HeritageClause[] | undefined {
    const clauses: HeritageClause[] = [];
    while (this.ctx.match(TokenType.ExtendsKeyword, TokenType.ImplementsKeyword)) {
      const start = this.ctx.getNodeStart();
      const linkTok = this.ctx.consume();
      const linkKind = linkTok.type === TokenType.ExtendsKeyword
        ? HeritageLinkKind.Extends
        : HeritageLinkKind.Implements;
      const types: ExpressionWithTypeArguments[] = [];
      do {
        const exStart = this.ctx.getNodeStart();
        const expression = this.parseLeftHandSideExpression();
        const typeArguments = this.tryParseTypeArguments();
        types.push({ expression, typeArguments, start: exStart, end: this.lastEnd() } as ExpressionWithTypeArguments);
      } while (this.ctx.tryConsume(TokenType.Comma));
      clauses.push({ kind: NodeKind.HeritageClause, linkKind, types, start, end: this.lastEnd() });
    }
    return clauses.length ? clauses : undefined;
  }

  private parseClassBody(): ClassElement[] {
    const members: ClassElement[] = [];
    while (!this.ctx.match(TokenType.CloseBrace, TokenType.EOF)) {
      const member = this.parseClassMember();
      if (member) members.push(member);
    }
    return members;
  }

  private parseClassMember(): ClassElement | undefined {
    const start = this.ctx.getNodeStart();
    const modifiers = this.parseModifiers();

    // Constructor
    if (this.ctx.currentType() === TokenType.Identifier && this.ctx.current().value === "constructor") {
      this.ctx.consume();
      const parameters = this.parseParameters();
      const body = this.parseBlock();
      return { kind: NodeKind.Constructor, modifiers: modifiers.length ? modifiers : undefined, parameters, body, start, end: this.lastEnd() } as Constructor;
    }

    // Get / Set accessor
    if (this.ctx.currentType() === TokenType.GetKeyword && this.ctx.peek(1).type === TokenType.Identifier) {
      this.ctx.consume(); // 'get'
      const name = this.parsePropertyName();
      const parameters = this.parseParameters();
      let returnType: TypeNode | undefined;
      if (this.ctx.tryConsume(TokenType.Colon)) returnType = this.parseTypeNode();
      const body = this.parseBlock();
      return { kind: NodeKind.GetAccessor, modifiers: modifiers.length ? modifiers : undefined, name, parameters, returnType, body, start, end: this.lastEnd() } as GetAccessor;
    }

    if (this.ctx.currentType() === TokenType.SetKeyword && this.ctx.peek(1).type === TokenType.Identifier) {
      this.ctx.consume(); // 'set'
      const name = this.parsePropertyName();
      const parameters = this.parseParameters();
      const body = this.parseBlock();
      return { kind: NodeKind.SetAccessor, modifiers: modifiers.length ? modifiers : undefined, name, parameters, body, start, end: this.lastEnd() } as SetAccessor;
    }

    // Index signature: [key: Type]: Type
    if (this.ctx.currentType() === TokenType.OpenBracket) {
      const lookahead = this.tryParseIndexSignature(start, modifiers);
      if (lookahead) return lookahead;
    }

    // Método o propiedad
    const name = this.parsePropertyName();
    const optional = this.ctx.tryConsume(TokenType.Question);

    // Método
    if (this.ctx.match(TokenType.OpenParen, TokenType.LessThan)) {
      const isGenerator = this.ctx.tryConsume(TokenType.Asterisk);
      const isAsync = modifiers.some(m => m.kind === NodeKind.AsyncModifier);
      const typeParameters = this.parseTypeParameters();
      const parameters = this.parseParameters();
      let returnType: TypeNode | undefined;
      if (this.ctx.tryConsume(TokenType.Colon)) returnType = this.parseTypeNode();
      const body = this.ctx.currentType() === TokenType.OpenBrace ? this.parseBlock() : undefined;
      if (!body) this.consumeSemicolon();
      return { kind: NodeKind.MethodDeclaration, modifiers: modifiers.length ? modifiers : undefined, name, isGenerator, isAsync, optional, typeParameters, parameters, returnType, body, start, end: this.lastEnd() } as MethodDeclaration;
    }

    // Propiedad
    let type: TypeNode | undefined;
    if (this.ctx.tryConsume(TokenType.Colon)) type = this.parseTypeNode();
    let initializer: Expression | undefined;
    if (this.ctx.tryConsume(TokenType.Equals)) initializer = this.parseAssignmentExpression();
    this.consumeSemicolon();
    return { kind: NodeKind.PropertyDeclaration, modifiers: modifiers.length ? modifiers : undefined, name, optional, type, initializer, start, end: this.lastEnd() } as PropertyDeclaration;
  }

  private tryParseIndexSignature(start: number, modifiers: Modifier[]): IndexSignature | undefined {
    return this.ctx.tryParse(() => {
      this.ctx.consume(); // '['
      if (this.ctx.currentType() !== TokenType.Identifier) return undefined;
      const paramStart = this.ctx.getNodeStart();
      const paramName = this.parseIdentifier();
      if (!this.ctx.tryConsume(TokenType.Colon)) return undefined;
      const paramType = this.parseTypeNode();
      if (!this.ctx.tryConsume(TokenType.CloseBracket)) return undefined;
      if (!this.ctx.tryConsume(TokenType.Colon)) return undefined;
      const returnType = this.parseTypeNode();
      this.consumeSemicolon();
      const param: Parameter = { kind: NodeKind.Parameter, dotDotDot: false, name: paramName, optional: false, type: paramType, start: paramStart, end: this.lastEnd() };
      return { kind: NodeKind.IndexSignature, modifiers: modifiers.length ? modifiers : undefined, parameters: [param], type: returnType, start, end: this.lastEnd() } as IndexSignature;
    });
  }

  private parsePropertyName(): Identifier | Expression {
    if (this.ctx.currentType() === TokenType.OpenBracket) {
      const start = this.ctx.getNodeStart();
      this.ctx.consume();
      const expr = this.parseExpression();
      this.ctx.expect(TokenType.CloseBracket);
      return { kind: NodeKind.ComputedPropertyName, expression: expr, start, end: this.lastEnd() } as any;
    }
    if (this.ctx.currentType() === TokenType.StringLiteral) return this.parseStringLiteral();
    if (this.ctx.currentType() === TokenType.NumericLiteral) return this.parseNumericLiteral();
    return this.parseIdentifier();
  }

  // ── Interfaces ────────────────────────────────────────────────────────────

  private parseInterfaceDeclaration(modifiers: Modifier[]): InterfaceDeclaration {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'interface'
    const name = this.parseIdentifier();
    const typeParameters = this.parseTypeParameters();
    const heritageClauses = this.parseHeritageClauses();
    this.ctx.expect(TokenType.OpenBrace);
    const members: TypeElement[] = [];
    while (!this.ctx.match(TokenType.CloseBrace, TokenType.EOF)) {
      const m = this.parseTypeElement();
      if (m) members.push(m);
    }
    this.ctx.expect(TokenType.CloseBrace);
    return { kind: NodeKind.InterfaceDeclaration, modifiers: modifiers.length ? modifiers : undefined, name, typeParameters, heritageClauses, members, start, end: this.lastEnd() };
  }

  private parseTypeElement(): TypeElement | undefined {
    const start = this.ctx.getNodeStart();

    // construct signature
    if (this.ctx.currentType() === TokenType.NewKeyword) {
      this.ctx.consume();
      const typeParameters = this.parseTypeParameters();
      const parameters = this.parseParameters();
      let returnType: TypeNode | undefined;
      if (this.ctx.tryConsume(TokenType.Colon)) returnType = this.parseTypeNode();
      this.consumeSemicolon();
      return { kind: NodeKind.ConstructSignature, typeParameters, parameters, returnType, start, end: this.lastEnd() } as ConstructSignature;
    }

    // call signature
    if (this.ctx.currentType() === TokenType.OpenParen || this.ctx.currentType() === TokenType.LessThan) {
      const typeParameters = this.parseTypeParameters();
      const parameters = this.parseParameters();
      let returnType: TypeNode | undefined;
      if (this.ctx.tryConsume(TokenType.Colon)) returnType = this.parseTypeNode();
      this.consumeSemicolon();
      return { kind: NodeKind.CallSignature, typeParameters, parameters, returnType, start, end: this.lastEnd() } as CallSignature;
    }

    // index signature
    if (this.ctx.currentType() === TokenType.OpenBracket) {
      const sig = this.tryParseIndexSignature(start, []);
      if (sig) return sig;
    }

    // propiedad o método
    const mods = this.parseModifiers();
    const name = this.parsePropertyName();
    const optional = this.ctx.tryConsume(TokenType.Question);

    if (this.ctx.match(TokenType.OpenParen, TokenType.LessThan)) {
      const typeParameters = this.parseTypeParameters();
      const parameters = this.parseParameters();
      let returnType: TypeNode | undefined;
      if (this.ctx.tryConsume(TokenType.Colon)) returnType = this.parseTypeNode();
      this.consumeSemicolon();
      return { kind: NodeKind.MethodSignature, name, optional, typeParameters, parameters, returnType, start, end: this.lastEnd() } as MethodSignature;
    }

    let type: TypeNode | undefined;
    if (this.ctx.tryConsume(TokenType.Colon)) type = this.parseTypeNode();
    this.consumeSemicolon();
    return { kind: NodeKind.PropertySignature, modifiers: mods.length ? mods : undefined, name, optional, type, start, end: this.lastEnd() } as PropertySignature;
  }

  // ── Enums ─────────────────────────────────────────────────────────────────

  private parseEnumDeclaration(modifiers: Modifier[]): EnumDeclaration {
    const start = this.ctx.getNodeStart();
    const isConst = modifiers.some(m => m.kind === NodeKind.ReadonlyModifier); // 'const' se da como modifier
    this.ctx.consume(); // 'enum'
    const name = this.parseIdentifier();
    this.ctx.expect(TokenType.OpenBrace);
    const members: EnumMember[] = [];
    while (!this.ctx.match(TokenType.CloseBrace, TokenType.EOF)) {
      const mStart = this.ctx.getNodeStart();
      const mName = this.parsePropertyName();
      let initializer: Expression | undefined;
      if (this.ctx.tryConsume(TokenType.Equals)) initializer = this.parseAssignmentExpression();
      members.push({ kind: NodeKind.EnumMember, name: mName, initializer, start: mStart, end: this.lastEnd() });
      if (!this.ctx.tryConsume(TokenType.Comma)) break;
    }
    this.ctx.expect(TokenType.CloseBrace);
    return { kind: NodeKind.EnumDeclaration, modifiers: modifiers.length ? modifiers : undefined, isConst, name, members, start, end: this.lastEnd() };
  }

  // ── Type alias ────────────────────────────────────────────────────────────

  private isTypeAliasDeclaration(): boolean {
    // 'type' Identifier ... '=' no es 'type as' ni 'type from'
    return this.ctx.peek(1).type === TokenType.Identifier ||
      this.ctx.peek(1).type === TokenType.LessThan;
  }

  private parseTypeAliasDeclaration(modifiers: Modifier[]): TypeAliasDeclaration {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'type'
    const name = this.parseIdentifier();
    const typeParameters = this.parseTypeParameters();
    this.ctx.expect(TokenType.Equals);
    const type = this.parseTypeNode();
    this.consumeSemicolon();
    return { kind: NodeKind.TypeAliasDeclaration, modifiers: modifiers.length ? modifiers : undefined, name, typeParameters, type, start, end: this.lastEnd() };
  }

  // ── Módulos ───────────────────────────────────────────────────────────────

  private parseModuleDeclaration(modifiers: Modifier[]): ModuleDeclaration {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'namespace' | 'module'
    const name = this.ctx.currentType() === TokenType.StringLiteral
      ? this.parseStringLiteral()
      : this.parseIdentifier();
    let body: ModuleBlock | ModuleDeclaration | undefined;
    if (this.ctx.currentType() === TokenType.OpenBrace) {
      const bStart = this.ctx.getNodeStart();
      this.ctx.consume();
      const stmts: Statement[] = [];
      while (!this.ctx.match(TokenType.CloseBrace, TokenType.EOF)) {
        const s = this.parseStatement();
        if (s) stmts.push(s);
      }
      this.ctx.expect(TokenType.CloseBrace);
      body = { kind: NodeKind.ModuleBlock, statements: stmts, start: bStart, end: this.lastEnd() };
    } else if (this.ctx.currentType() === TokenType.Dot) {
      this.ctx.consume();
      body = this.parseModuleDeclaration([]);
    }
    return { kind: NodeKind.ModuleDeclaration, modifiers: modifiers.length ? modifiers : undefined, name: name as any, body, start, end: this.lastEnd() };
  }

  // ── Import/Export ─────────────────────────────────────────────────────────

  private parseImportDeclaration(): ImportDeclaration {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'import'
    const isTypeOnly = this.ctx.currentType() === TokenType.TypeKeyword && this.ctx.peek(1).type !== TokenType.Comma && this.ctx.peek(1).type !== TokenType.OpenBrace;
    if (isTypeOnly) this.ctx.consume();

    let importClause: ImportClause | undefined;
    const cStart = this.ctx.getNodeStart();

    // import 'module'  → side effect only
    if (this.ctx.currentType() !== TokenType.StringLiteral) {
      let defaultName: Identifier | undefined;
      let namedBindings: NamedImports | NamespaceImport | undefined;

      if (this.ctx.currentType() === TokenType.Identifier) {
        defaultName = this.parseIdentifier();
        if (!this.ctx.tryConsume(TokenType.Comma)) {
          importClause = { kind: NodeKind.ImportClause, name: defaultName, start: cStart, end: this.lastEnd() };
        }
      }

      if (this.ctx.currentType() === TokenType.Asterisk) {
        this.ctx.consume(); // '*'
        this.ctx.expect(TokenType.AsKeyword);
        const alias = this.parseIdentifier();
        namedBindings = { kind: NodeKind.NamespaceImport, name: alias, start: cStart, end: this.lastEnd() };
      } else if (this.ctx.currentType() === TokenType.OpenBrace) {
        namedBindings = this.parseNamedImports();
      }

      if (defaultName || namedBindings) {
        importClause = { kind: NodeKind.ImportClause, name: defaultName, namedBindings, start: cStart, end: this.lastEnd() };
      }
      this.ctx.expect(TokenType.FromKeyword);
    }

    const moduleSpecifier = this.parseStringLiteral();
    this.consumeSemicolon();
    return { kind: NodeKind.ImportDeclaration, importClause, moduleSpecifier, isTypeOnly, start, end: this.lastEnd() };
  }

  private parseNamedImports(): NamedImports {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // '{'
    const elements: ImportSpecifier[] = [];
    while (!this.ctx.match(TokenType.CloseBrace, TokenType.EOF)) {
      const sStart = this.ctx.getNodeStart();
      const isTypeOnly = this.ctx.tryConsume(TokenType.TypeKeyword);
      const first = this.parseIdentifier();
      let propertyName: Identifier | undefined;
      let name = first;
      if (this.ctx.tryConsume(TokenType.AsKeyword)) {
        propertyName = first;
        name = this.parseIdentifier();
      }
      elements.push({ kind: NodeKind.ImportSpecifier, propertyName, name, isTypeOnly, start: sStart, end: this.lastEnd() });
      if (!this.ctx.tryConsume(TokenType.Comma)) break;
    }
    this.ctx.expect(TokenType.CloseBrace);
    return { kind: NodeKind.NamedImports, elements, start, end: this.lastEnd() };
  }

  private parseExportDeclaration(modifiers: Modifier[]): ExportDeclaration | ExportAssignment | FunctionDeclaration | ClassDeclaration | VariableStatement {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'export'

    // export default
    if (this.ctx.tryConsume(TokenType.DefaultKeyword)) {
      if (this.ctx.currentType() === TokenType.FunctionKeyword) return this.parseFunctionDeclaration(modifiers);
      if (this.ctx.currentType() === TokenType.ClassKeyword) return this.parseClassDeclaration(modifiers);
      const expression = this.parseAssignmentExpression();
      this.consumeSemicolon();
      return { kind: NodeKind.ExportAssignment, isExportEquals: false, expression, modifiers: modifiers.length ? modifiers : undefined, start, end: this.lastEnd() } as ExportAssignment;
    }

    // export = value
    if (this.ctx.tryConsume(TokenType.Equals)) {
      const expression = this.parseExpression();
      this.consumeSemicolon();
      return { kind: NodeKind.ExportAssignment, isExportEquals: true, expression, modifiers: modifiers.length ? modifiers : undefined, start, end: this.lastEnd() } as ExportAssignment;
    }

    // export type
    const isTypeOnly = this.ctx.currentType() === TokenType.TypeKeyword && this.ctx.peek(1).type === TokenType.OpenBrace;
    if (isTypeOnly) this.ctx.consume();

    // export { ... }
    if (this.ctx.currentType() === TokenType.OpenBrace) {
      const namedExports = this.parseNamedExports();
      let moduleSpecifier: Expression | undefined;
      if (this.ctx.peek(0).value === "from" || this.ctx.currentType() === TokenType.FromKeyword) {
        this.ctx.consume();
        moduleSpecifier = this.parseStringLiteral();
      }
      this.consumeSemicolon();
      return { kind: NodeKind.ExportDeclaration, isTypeOnly, exportClause: namedExports, moduleSpecifier, modifiers: modifiers.length ? modifiers : undefined, start, end: this.lastEnd() } as ExportDeclaration;
    }

    // export * from '...'
    if (this.ctx.currentType() === TokenType.Asterisk) {
      this.ctx.consume();
      let alias: any;
      if (this.ctx.tryConsume(TokenType.AsKeyword)) {
        alias = this.parseIdentifier();
      }
      this.ctx.expect(TokenType.FromKeyword);
      const moduleSpecifier = this.parseStringLiteral();
      this.consumeSemicolon();
      return { kind: NodeKind.ExportDeclaration, isTypeOnly, exportClause: alias ? { name: alias } : undefined, moduleSpecifier, modifiers: modifiers.length ? modifiers : undefined, start, end: this.lastEnd() } as ExportDeclaration;
    }

    // export class/function/const/let/var/interface/type/enum
    const newMods = [...modifiers, { kind: NodeKind.ExportModifier, start, end: this.lastEnd() } as Modifier];
    return this.parseStatement() as any;
  }

  private parseNamedExports(): NamedExports {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // '{'
    const elements: ExportSpecifier[] = [];
    while (!this.ctx.match(TokenType.CloseBrace, TokenType.EOF)) {
      const sStart = this.ctx.getNodeStart();
      const isTypeOnly = this.ctx.tryConsume(TokenType.TypeKeyword);
      const first = this.parseIdentifier();
      let propertyName: Identifier | undefined;
      let name = first;
      if (this.ctx.tryConsume(TokenType.AsKeyword)) {
        propertyName = first;
        name = this.parseIdentifier();
      }
      elements.push({ kind: NodeKind.ExportSpecifier, propertyName, name, isTypeOnly, start: sStart, end: this.lastEnd() });
      if (!this.ctx.tryConsume(TokenType.Comma)) break;
    }
    this.ctx.expect(TokenType.CloseBrace);
    return { kind: NodeKind.NamedExports, elements, start, end: this.lastEnd() };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // EXPRESIONES
  // ────────────────────────────────────────────────────────────────────────────

  private parseExpression(): Expression {
    let left = this.parseAssignmentExpression();
    while (this.ctx.currentType() === TokenType.Comma) {
      const op = this.ctx.consume().value;
      const right = this.parseAssignmentExpression();
      left = { kind: NodeKind.BinaryExpression, left, operator: op, right, start: left.start, end: this.lastEnd() } as BinaryExpression;
    }
    return left;
  }

  private parseAssignmentExpression(): Expression {
    // Detectar arrow function: (params) => ... o identifier => ...
    const arrow = this.tryParseArrowFunction();
    if (arrow) return arrow;

    let left = this.parseConditionalExpression();

    // Postfix de tipo: as, satisfies, !
    left = this.parseExpressionWithOptionalAs(left);

    if (ASSIGNMENT_OPERATORS.has(this.ctx.currentType())) {
      const op = this.ctx.consume().value;
      const right = this.parseAssignmentExpression();
      return { kind: NodeKind.BinaryExpression, left, operator: op, right, start: left.start, end: this.lastEnd() } as BinaryExpression;
    }

    return left;
  }

  private tryParseArrowFunction(): ArrowFunctionExpression | undefined {
    const isAsync = this.ctx.currentType() === TokenType.AsyncKeyword &&
      this.ctx.peek(1).type !== TokenType.Dot &&
      this.ctx.peek(1).type !== TokenType.OpenParen; // async(... → llamada, no arrow
    // El caso async(params)=> lo maneja el path normal después
    // Detectamos: identifier => o (params) =>
    if (isAsync && this.ctx.peek(1).type === TokenType.Identifier) {
      const start = this.ctx.getNodeStart();
      this.ctx.consume(); // 'async'
      const paramId = this.parseIdentifier();
      if (this.ctx.currentType() === TokenType.EqualsGreaterThan) {
        this.ctx.consume(); // '=>'
        const body = this.ctx.currentType() === TokenType.OpenBrace
          ? this.parseBlock()
          : this.parseAssignmentExpression();
        const param: Parameter = { kind: NodeKind.Parameter, dotDotDot: false, name: paramId, optional: false, start: paramId.start, end: paramId.end };
        return { kind: NodeKind.ArrowFunctionExpression, isAsync: true, parameters: [param], body, start, end: this.lastEnd() } as ArrowFunctionExpression;
      }
      return undefined;
    }

    if (this.ctx.currentType() === TokenType.Identifier && this.ctx.peek(1).type === TokenType.EqualsGreaterThan) {
      const start = this.ctx.getNodeStart();
      const paramId = this.parseIdentifier();
      this.ctx.consume(); // '=>'
      const body = this.ctx.currentType() === TokenType.OpenBrace
        ? this.parseBlock()
        : this.parseAssignmentExpression();
      const param: Parameter = { kind: NodeKind.Parameter, dotDotDot: false, name: paramId, optional: false, start: paramId.start, end: paramId.end };
      return { kind: NodeKind.ArrowFunctionExpression, isAsync: false, parameters: [param], body, start, end: this.lastEnd() } as ArrowFunctionExpression;
    }

    // (params) => ...  o  <T>(params) => ...
    if (this.ctx.currentType() === TokenType.OpenParen || (this.ctx.currentType() === TokenType.LessThan && !isAsync)) {
      return this.ctx.tryParse(() => {
        const start = this.ctx.getNodeStart();
        const typeParameters = this.parseTypeParameters();
        if (!this.ctx.match(TokenType.OpenParen)) return undefined;
        const parameters = this.parseParameters();
        let returnType: TypeNode | undefined;
        if (this.ctx.tryConsume(TokenType.Colon)) returnType = this.parseTypeNode();
        if (!this.ctx.match(TokenType.EqualsGreaterThan)) return undefined;
        this.ctx.consume();
        const body = this.ctx.currentType() === TokenType.OpenBrace
          ? this.parseBlock()
          : this.parseAssignmentExpression();
        return { kind: NodeKind.ArrowFunctionExpression, isAsync: false, typeParameters, parameters, returnType, body, start, end: this.lastEnd() } as ArrowFunctionExpression;
      });
    }

    return undefined;
  }

  private parseConditionalExpression(): Expression {
    let expr = this.parseBinaryExpression(0);
    if (this.ctx.tryConsume(TokenType.Question)) {
      const whenTrue = this.parseAssignmentExpression();
      this.ctx.expect(TokenType.Colon);
      const whenFalse = this.parseAssignmentExpression();
      return { kind: NodeKind.ConditionalExpression, condition: expr, whenTrue, whenFalse, start: expr.start, end: this.lastEnd() } as ConditionalExpression;
    }
    return expr;
  }

  private parseBinaryExpression(minPrec: number): Expression {
    let left = this.parseUnaryExpression();

    while (true) {
      const prec = BINARY_PRECEDENCE[this.ctx.currentType()];
      if (prec === undefined || prec <= minPrec) break;

      const op = this.ctx.consume().value;
      // ** es right-associative → usa misma prec
      const rightPrec = op === "**" ? prec - 1 : prec;
      const right = this.parseBinaryExpression(rightPrec);
      left = { kind: NodeKind.BinaryExpression, left, operator: op, right, start: left.start, end: this.lastEnd() } as BinaryExpression;
    }

    return left;
  }

  private parseUnaryExpression(): Expression {
    const start = this.ctx.getNodeStart();

    switch (this.ctx.currentType()) {
      case TokenType.Exclamation:
      case TokenType.Tilde:
      case TokenType.Plus:
      case TokenType.Minus: {
        const op = this.ctx.consume().value;
        const operand = this.parseUnaryExpression();
        return { kind: NodeKind.UnaryExpression, operator: op, operand, start, end: this.lastEnd() } as UnaryExpression;
      }
      case TokenType.PlusPlus:
      case TokenType.MinusMinus: {
        const op = this.ctx.consume().value;
        const operand = this.parseUnaryExpression();
        return { kind: NodeKind.UnaryExpression, operator: op, operand, start, end: this.lastEnd() } as UnaryExpression;
      }
      case TokenType.TypeofKeyword: {
        this.ctx.consume();
        const operand = this.parseUnaryExpression();
        return { kind: NodeKind.TypeofExpression, expression: operand, start, end: this.lastEnd() } as TypeofExpression;
      }
      case TokenType.VoidKeyword: {
        this.ctx.consume();
        const operand = this.parseUnaryExpression();
        return { kind: NodeKind.VoidExpression, expression: operand, start, end: this.lastEnd() } as VoidExpression;
      }
      case TokenType.DeleteKeyword: {
        this.ctx.consume();
        const operand = this.parseUnaryExpression();
        return { kind: NodeKind.DeleteExpression, expression: operand, start, end: this.lastEnd() } as DeleteExpression;
      }
      case TokenType.AwaitKeyword: {
        this.ctx.consume();
        const operand = this.parseUnaryExpression();
        return { kind: NodeKind.AwaitExpression, expression: operand, start, end: this.lastEnd() } as AwaitExpression;
      }
      case TokenType.LessThan: {
        // <Type>expression (legacy type assertion)
        return this.ctx.tryParse(() => {
          this.ctx.consume(); // '<'
          const type = this.parseTypeNode();
          if (!this.ctx.tryConsume(TokenType.GreaterThan)) return undefined;
          const expression = this.parseUnaryExpression();
          return { kind: NodeKind.TypeAssertionExpression, type, expression, start, end: this.lastEnd() } as TypeAssertionExpression;
        }) ?? this.parseUpdateExpression();
      }
    }

    return this.parseUpdateExpression();
  }

  private parseUpdateExpression(): Expression {
    const start = this.ctx.getNodeStart();
    let expr = this.parseLeftHandSideExpression();

    if (this.ctx.match(TokenType.PlusPlus, TokenType.MinusMinus)) {
      const op = this.ctx.consume().value as "++" | "--";
      return { kind: NodeKind.PostfixUnaryExpression, operand: expr, operator: op, start, end: this.lastEnd() } as PostfixUnaryExpression;
    }

    return expr;
  }

  private parseLeftHandSideExpression(): Expression {
    let expr = this.parseMemberExpression();

    // Parsear calls, accesos opcionales
    while (true) {
      if (this.ctx.currentType() === TokenType.OpenParen) {
        expr = this.parseCallTail(expr, false);
      } else if (this.ctx.currentType() === TokenType.QuestionDot) {
        expr = this.parseOptionalChain(expr);
      } else if (this.ctx.currentType() === TokenType.LessThan) {
        // posible llamada genérica: f<T>(...)
        const generic = this.ctx.tryParse(() => {
          const typeArgs = this.tryParseTypeArgumentsInExpression();
          if (!typeArgs) return undefined;
          if (!this.ctx.match(TokenType.OpenParen)) return undefined;
          return this.parseCallTail(expr, false, typeArgs);
        });
        if (generic) { expr = generic; continue; }
        break;
      } else {
        break;
      }
    }

    return expr;
  }

  private parseMemberExpression(): Expression {
    let expr = this.parsePrimaryExpression();

    while (true) {
      if (this.ctx.currentType() === TokenType.Dot) {
        this.ctx.consume();
        const property = this.parseIdentifier();
        expr = { kind: NodeKind.PropertyAccessExpression, object: expr, property, isOptional: false, start: expr.start, end: this.lastEnd() } as PropertyAccessExpression;
      } else if (this.ctx.currentType() === TokenType.OpenBracket) {
        this.ctx.consume();
        const index = this.parseExpression();
        this.ctx.expect(TokenType.CloseBracket);
        expr = { kind: NodeKind.ElementAccessExpression, object: expr, index, isOptional: false, start: expr.start, end: this.lastEnd() } as ElementAccessExpression;
      } else if (this.ctx.currentType() === TokenType.NoSubstitutionTemplate || this.ctx.currentType() === TokenType.TemplateHead) {
        expr = this.parseTaggedTemplate(expr);
      } else {
        break;
      }
    }

    return expr;
  }

  private parseCallTail(callee: Expression, isOptional: boolean, typeArguments?: TypeNode[]): CallExpression {
    this.ctx.consume(); // '('
    const args: Expression[] = [];
    while (!this.ctx.match(TokenType.CloseParen, TokenType.EOF)) {
      if (this.ctx.currentType() === TokenType.DotDotDot) {
        const sStart = this.ctx.getNodeStart();
        this.ctx.consume();
        const expr = this.parseAssignmentExpression();
        args.push({ kind: NodeKind.SpreadElement, expression: expr, start: sStart, end: this.lastEnd() } as SpreadElement);
      } else {
        args.push(this.parseAssignmentExpression());
      }
      if (!this.ctx.tryConsume(TokenType.Comma)) break;
    }
    this.ctx.expect(TokenType.CloseParen);
    return { kind: NodeKind.CallExpression, callee, typeArguments, args, isOptional, start: callee.start, end: this.lastEnd() } as CallExpression;
  }

  private parseOptionalChain(expr: Expression): Expression {
    this.ctx.consume(); // '?.'
    if (this.ctx.currentType() === TokenType.OpenParen) {
      return this.parseCallTail(expr, true);
    }
    if (this.ctx.currentType() === TokenType.OpenBracket) {
      this.ctx.consume();
      const index = this.parseExpression();
      this.ctx.expect(TokenType.CloseBracket);
      return { kind: NodeKind.ElementAccessExpression, object: expr, index, isOptional: true, start: expr.start, end: this.lastEnd() } as ElementAccessExpression;
    }
    const property = this.parseIdentifier();
    return { kind: NodeKind.PropertyAccessExpression, object: expr, property, isOptional: true, start: expr.start, end: this.lastEnd() } as PropertyAccessExpression;
  }

  private parseTaggedTemplate(tag: Expression): TaggedTemplateExpression {
    const template = this.ctx.currentType() === TokenType.NoSubstitutionTemplate
      ? this.parseStringLiteral() // lo tratamos como string por ahora
      : this.parseTemplateLiteral();
    return { kind: NodeKind.TaggedTemplateExpression, tag, template, start: tag.start, end: this.lastEnd() } as TaggedTemplateExpression;
  }

  private parsePrimaryExpression(): Expression {
    const start = this.ctx.getNodeStart();

    switch (this.ctx.currentType()) {
      case TokenType.Identifier: return this.parseIdentifier();
      case TokenType.NumericLiteral: return this.parseNumericLiteral();
      case TokenType.BigIntLiteral: return this.parseBigIntLiteral();
      case TokenType.StringLiteral: return this.parseStringLiteral();
      case TokenType.TrueKeyword: { this.ctx.consume(); return { kind: NodeKind.BooleanLiteral, value: true, start, end: this.lastEnd() } as BooleanLiteral; }
      case TokenType.FalseKeyword: { this.ctx.consume(); return { kind: NodeKind.BooleanLiteral, value: false, start, end: this.lastEnd() } as BooleanLiteral; }
      case TokenType.NullKeyword: { this.ctx.consume(); return { kind: NodeKind.NullLiteral, start, end: this.lastEnd() } as NullLiteral; }
      case TokenType.UndefinedKeyword: { this.ctx.consume(); return { kind: NodeKind.UndefinedLiteral, start, end: this.lastEnd() } as any; }
      case TokenType.ThisKeyword: { this.ctx.consume(); return { kind: NodeKind.Identifier, name: "this", start, end: this.lastEnd() } as Identifier; }
      case TokenType.SuperKeyword: { this.ctx.consume(); return { kind: NodeKind.Identifier, name: "super", start, end: this.lastEnd() } as Identifier; }
      case TokenType.TemplateHead:
      case TokenType.NoSubstitutionTemplate:
        return this.parseTemplateLiteral();
      case TokenType.RegexLiteral: {
        const tok = this.ctx.consume();
        const slashEnd = tok.value.lastIndexOf("/");
        return { kind: NodeKind.RegexLiteral, pattern: tok.value.slice(1, slashEnd), flags: tok.value.slice(slashEnd + 1), start, end: this.lastEnd() } as RegexLiteral;
      }
      case TokenType.OpenBracket:
        return this.parseArrayLiteralExpression();
      case TokenType.OpenBrace:
        return this.parseObjectLiteralExpression();
      case TokenType.OpenParen: {
        this.ctx.consume();
        // Dentro de '(' siempre parseamos como expresión (nunca como statement)
        // Esto garantiza que ({ ... }) se trata como object literal
        let inner: Expression;
        if (this.ctx.currentType() === TokenType.OpenBrace) {
          inner = this.parseObjectLiteralExpression();
        } else {
          inner = this.parseExpression();
        }
        this.ctx.expect(TokenType.CloseParen);
        return { kind: NodeKind.ParenthesizedExpression, expression: inner, start, end: this.lastEnd() } as ParenthesizedExpression;
      }
      case TokenType.FunctionKeyword: {
        const funcMods = this.parseModifiers();
        return this.parseFunctionExpression(start);
      }
      case TokenType.ClassKeyword:
        return this.parseClassExpression(start);
      case TokenType.NewKeyword:
        return this.parseNewExpression();
      case TokenType.YieldKeyword:
        return this.parseYieldExpression();
      case TokenType.AsyncKeyword: {
        // async function expression
        const next = this.ctx.peek(1).type;
        if (next === TokenType.FunctionKeyword) {
          this.ctx.consume(); // 'async'
          this.ctx.consume(); // 'function'
          return this.parseFunctionExpression(start, true);
        }
        // async arrow (manejado en parseAssignmentExpression)
        return this.parseIdentifier();
      }
      default: {
        // Intentar como identificador contextual
        if (this.isContextualKeyword()) {
          return this.parseIdentifier();
        }
        this.diagnostics.add(Diagnostics.ExpressionExpected, this.ctx.current().span, this.fileName);
        this.ctx.consume();
        return { kind: NodeKind.Identifier, name: "", start, end: this.lastEnd() } as Identifier;
      }
    }
  }

  private parseFunctionExpression(start: number, isAsync = false): FunctionExpression {
    if (!isAsync) this.ctx.consume(); // 'function'
    const isGenerator = this.ctx.tryConsume(TokenType.Asterisk);
    const name = this.ctx.currentType() === TokenType.Identifier ? this.parseIdentifier() : undefined;
    const typeParameters = this.parseTypeParameters();
    const parameters = this.parseParameters();
    let returnType: TypeNode | undefined;
    if (this.ctx.tryConsume(TokenType.Colon)) returnType = this.parseTypeNode();
    const body = this.parseBlock();
    return { kind: NodeKind.FunctionExpression, name, isGenerator, isAsync, typeParameters, parameters, returnType, body, start, end: this.lastEnd() } as FunctionExpression;
  }

  private parseClassExpression(start: number): any {
    this.ctx.consume(); // 'class'
    const name = this.ctx.currentType() === TokenType.Identifier ? this.parseIdentifier() : undefined;
    const typeParameters = this.parseTypeParameters();
    const heritageClauses = this.parseHeritageClauses();
    this.ctx.expect(TokenType.OpenBrace);
    const members = this.parseClassBody();
    this.ctx.expect(TokenType.CloseBrace);
    return { kind: NodeKind.ClassExpression, name, typeParameters, heritageClauses, members, start, end: this.lastEnd() };
  }

  private parseNewExpression(): NewExpression {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'new'
    const callee = this.parseMemberExpression();
    const typeArguments = this.tryParseTypeArguments();
    let args: Expression[] | undefined;
    if (this.ctx.currentType() === TokenType.OpenParen) {
      this.ctx.consume();
      args = [];
      while (!this.ctx.match(TokenType.CloseParen, TokenType.EOF)) {
        if (this.ctx.currentType() === TokenType.DotDotDot) {
          const sStart = this.ctx.getNodeStart();
          this.ctx.consume();
          const expr = this.parseAssignmentExpression();
          args.push({ kind: NodeKind.SpreadElement, expression: expr, start: sStart, end: this.lastEnd() } as SpreadElement);
        } else {
          args.push(this.parseAssignmentExpression());
        }
        if (!this.ctx.tryConsume(TokenType.Comma)) break;
      }
      this.ctx.expect(TokenType.CloseParen);
    }
    return { kind: NodeKind.NewExpression, callee, typeArguments, args, start, end: this.lastEnd() } as NewExpression;
  }

  private parseYieldExpression(): YieldExpression {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // 'yield'
    const delegate = this.ctx.tryConsume(TokenType.Asterisk);
    let expression: Expression | undefined;
    if (!this.ctx.match(TokenType.Semicolon, TokenType.CloseBrace, TokenType.EOF)) {
      expression = this.parseAssignmentExpression();
    }
    return { kind: NodeKind.YieldExpression, delegate, expression, start, end: this.lastEnd() } as YieldExpression;
  }

  private parseObjectLiteralExpression(): ObjectLiteralExpression {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // '{'
    const properties: ObjectLiteralElement[] = [];
    while (!this.ctx.match(TokenType.CloseBrace, TokenType.EOF)) {
      properties.push(this.parseObjectLiteralElement());
      if (!this.ctx.tryConsume(TokenType.Comma)) break;
    }
    this.ctx.expect(TokenType.CloseBrace);
    return { kind: NodeKind.ObjectLiteralExpression, properties, start, end: this.lastEnd() } as ObjectLiteralExpression;
  }

  private parseObjectLiteralElement(): ObjectLiteralElement {
    const start = this.ctx.getNodeStart();

    if (this.ctx.currentType() === TokenType.DotDotDot) {
      this.ctx.consume();
      const expression = this.parseAssignmentExpression();
      return { kind: NodeKind.SpreadAssignment, expression, start, end: this.lastEnd() } as SpreadAssignment;
    }

    // get/set accessor en objeto
    if (this.ctx.currentType() === TokenType.GetKeyword && this.ctx.peek(1).type !== TokenType.OpenParen && this.ctx.peek(1).type !== TokenType.Colon) {
      this.ctx.consume();
      const name = this.parsePropertyName();
      const parameters = this.parseParameters();
      let returnType: TypeNode | undefined;
      if (this.ctx.tryConsume(TokenType.Colon)) returnType = this.parseTypeNode();
      const body = this.parseBlock();
      return { kind: NodeKind.GetAccessor, name, parameters, returnType, body, start, end: this.lastEnd() } as any;
    }
    if (this.ctx.currentType() === TokenType.SetKeyword && this.ctx.peek(1).type !== TokenType.OpenParen && this.ctx.peek(1).type !== TokenType.Colon) {
      this.ctx.consume();
      const name = this.parsePropertyName();
      const parameters = this.parseParameters();
      const body = this.parseBlock();
      return { kind: NodeKind.SetAccessor, name, parameters, body, start, end: this.lastEnd() } as any;
    }

    const isAsync = this.ctx.currentType() === TokenType.AsyncKeyword && this.ctx.peek(1).type !== TokenType.Colon;
    if (isAsync) this.ctx.consume();
    const isGenerator = this.ctx.tryConsume(TokenType.Asterisk);

    const name = this.parsePropertyName();

    // shorthand: { x } o { x = default }
    if (name.kind === NodeKind.Identifier && !this.ctx.match(TokenType.Colon, TokenType.OpenParen, TokenType.LessThan, TokenType.Question)) {
      let objectAssignmentInitializer: Expression | undefined;
      if (this.ctx.tryConsume(TokenType.Equals)) {
        objectAssignmentInitializer = this.parseAssignmentExpression();
      }
      return { kind: NodeKind.ShorthandPropertyAssignment, name: name as Identifier, objectAssignmentInitializer, start, end: this.lastEnd() } as ShorthandPropertyAssignment;
    }

    // método
    if (isGenerator || isAsync || this.ctx.match(TokenType.OpenParen, TokenType.LessThan)) {
      const typeParameters = this.parseTypeParameters();
      const parameters = this.parseParameters();
      let returnType: TypeNode | undefined;
      if (this.ctx.tryConsume(TokenType.Colon)) returnType = this.parseTypeNode();
      const body = this.parseBlock();
      return { kind: NodeKind.MethodDeclaration, name, isGenerator, isAsync, typeParameters, parameters, returnType, body, start, end: this.lastEnd() } as any;
    }

    // propiedad con valor
    this.ctx.expect(TokenType.Colon);
    const initializer = this.parseAssignmentExpression();
    return { kind: NodeKind.PropertyAssignment, name, initializer, start, end: this.lastEnd() } as PropertyAssignment;
  }

  private parseArrayLiteralExpression(): ArrayLiteralExpression {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // '['
    const elements: (Expression | SpreadElement | undefined)[] = [];
    while (!this.ctx.match(TokenType.CloseBracket, TokenType.EOF)) {
      if (this.ctx.currentType() === TokenType.Comma) {
        elements.push(undefined); // elision
        this.ctx.consume();
        continue;
      }
      if (this.ctx.currentType() === TokenType.DotDotDot) {
        const sStart = this.ctx.getNodeStart();
        this.ctx.consume();
        const expr = this.parseAssignmentExpression();
        elements.push({ kind: NodeKind.SpreadElement, expression: expr, start: sStart, end: this.lastEnd() } as SpreadElement);
      } else {
        elements.push(this.parseAssignmentExpression());
      }
      if (!this.ctx.tryConsume(TokenType.Comma)) break;
    }
    this.ctx.expect(TokenType.CloseBracket);
    return { kind: NodeKind.ArrayLiteralExpression, elements, start, end: this.lastEnd() } as ArrayLiteralExpression;
  }

  private parseTemplateLiteral(): TemplateLiteral {
    const start = this.ctx.getNodeStart();
    const tok = this.ctx.current();

    if (tok.type === TokenType.NoSubstitutionTemplate) {
      this.ctx.consume();
      const raw = tok.value;
      const head = raw.slice(1, -1); // quitar backticks
      return { kind: NodeKind.TemplateLiteral, head, spans: [], start, end: this.lastEnd() } as TemplateLiteral;
    }

    // TemplateHead
    this.ctx.consume();
    const head = tok.value.slice(1, -2); // quitar ` y ${
    const spans: TemplateSpan[] = [];

    while (true) {
      const spanStart = this.ctx.getNodeStart();
      const expression = this.parseExpression();
      // El lexer debe producir TemplateMiddle o TemplateTail
      const continuationTok = this.ctx.current();
      if (continuationTok.type === TokenType.CloseBrace) {
        // Pedir al lexer el siguiente fragmento de template
        this.ctx.consume();
      }
      const tailTok = this.ctx.current();
      if (tailTok.type === TokenType.TemplateTail || tailTok.type === TokenType.TemplateMiddle) {
        this.ctx.consume();
        const tail = tailTok.value.slice(1, tailTok.type === TokenType.TemplateTail ? -1 : -2);
        const isTail = tailTok.type === TokenType.TemplateTail;
        spans.push({ kind: NodeKind.TemplateSpan, expression, tail, isTail, start: spanStart, end: this.lastEnd() } as TemplateSpan);
        if (isTail) break;
      } else {
        spans.push({ kind: NodeKind.TemplateSpan, expression, tail: "", isTail: true, start: spanStart, end: this.lastEnd() } as TemplateSpan);
        break;
      }
    }

    return { kind: NodeKind.TemplateLiteral, head, spans, start, end: this.lastEnd() } as TemplateLiteral;
  }

  // ── Expresiones post-fix de tipo ────────────────────────────────────────────

  private parseExpressionWithOptionalAs(expr: Expression): Expression {
    while (true) {
      if (this.ctx.currentType() === TokenType.AsKeyword) {
        const start = expr.start;
        this.ctx.consume();
        const type = this.parseTypeNode();
        expr = { kind: NodeKind.AsExpression, expression: expr, type, start, end: this.lastEnd() } as AsExpression;
      } else if (this.ctx.peek(0).value === "satisfies" || this.ctx.currentType() === TokenType.SatisfiesKeyword) {
        const start = expr.start;
        this.ctx.consume();
        const type = this.parseTypeNode();
        expr = { kind: NodeKind.SatisfiesExpression, expression: expr, type, start, end: this.lastEnd() } as SatisfiesExpression;
      } else if (this.ctx.currentType() === TokenType.Exclamation) {
        const start = expr.start;
        this.ctx.consume();
        expr = { kind: NodeKind.NonNullExpression, expression: expr, start, end: this.lastEnd() } as NonNullExpression;
      } else {
        break;
      }
    }
    return expr;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TIPOS
  // ────────────────────────────────────────────────────────────────────────────

  private parseTypeNode(): TypeNode {
    return this.parseConditionalType();
  }

  private parseConditionalType(): TypeNode {
    const type = this.parseUnionType();
    if (this.ctx.currentType() === TokenType.ExtendsKeyword) {
      return this.ctx.tryParse(() => {
        this.ctx.consume(); // 'extends'
        const extendsType = this.parseUnionType();
        if (!this.ctx.tryConsume(TokenType.Question)) return undefined;
        const trueType = this.parseTypeNode();
        this.ctx.expect(TokenType.Colon);
        const falseType = this.parseTypeNode();
        return { kind: NodeKind.ConditionalType, checkType: type, extendsType, trueType, falseType, start: type.start, end: this.lastEnd() } as ConditionalType;
      }) ?? type;
    }
    return type;
  }

  private parseUnionType(): TypeNode {
    this.ctx.tryConsume(TokenType.Bar); // leading '|'
    let type = this.parseIntersectionType();
    if (this.ctx.currentType() !== TokenType.Bar) return type;
    const types = [type];
    while (this.ctx.tryConsume(TokenType.Bar)) {
      types.push(this.parseIntersectionType());
    }
    return { kind: NodeKind.UnionType, types, start: types[0]!.start, end: this.lastEnd() } as UnionType;
  }

  private parseIntersectionType(): TypeNode {
    this.ctx.tryConsume(TokenType.Ampersand); // leading '&'
    let type = this.parseTypeOperator();
    if (this.ctx.currentType() !== TokenType.Ampersand) return type;
    const types = [type];
    while (this.ctx.tryConsume(TokenType.Ampersand)) {
      types.push(this.parseTypeOperator());
    }
    return { kind: NodeKind.IntersectionType, types, start: types[0]!.start, end: this.lastEnd() } as IntersectionType;
  }

  private parseTypeOperator(): TypeNode {
    const start = this.ctx.getNodeStart();
    if (this.ctx.currentType() === TokenType.KeyofKeyword) {
      this.ctx.consume();
      const type = this.parseTypeOperator();
      return { kind: NodeKind.KeyofType, type, start, end: this.lastEnd() } as KeyofType;
    }
    if (this.ctx.peek(0).value === "unique") {
      this.ctx.consume();
      const type = this.parseTypeOperator();
      return { kind: NodeKind.UniqueType, type, start, end: this.lastEnd() } as UniqueType;
    }
    if (this.ctx.currentType() === TokenType.ReadonlyKeyword) {
      this.ctx.consume();
      const type = this.parseTypeOperator();
      return { kind: NodeKind.ReadonlyType, type, start, end: this.lastEnd() } as ReadonlyType;
    }
    if (this.ctx.currentType() === TokenType.InferKeyword) {
      this.ctx.consume();
      const tp = this.parseTypeParameter();
      return { kind: NodeKind.InferType, typeParameter: tp, start, end: this.lastEnd() } as InferType;
    }
    return this.parseArrayTypeOrHigher();
  }

  private parseArrayTypeOrHigher(): TypeNode {
    let type = this.parseNonArrayType();
    while (this.ctx.currentType() === TokenType.OpenBracket) {
      this.ctx.consume();
      if (this.ctx.tryConsume(TokenType.CloseBracket)) {
        type = { kind: NodeKind.ArrayType, elementType: type, start: type.start, end: this.lastEnd() } as ArrayType;
      } else {
        const index = this.parseTypeNode();
        this.ctx.expect(TokenType.CloseBracket);
        type = { kind: NodeKind.IndexedAccessType, objectType: type, indexType: index, start: type.start, end: this.lastEnd() } as IndexedAccessType;
      }
    }
    return type;
  }

  private parseNonArrayType(): TypeNode {
    const start = this.ctx.getNodeStart();

    switch (this.ctx.currentType()) {
      case TokenType.AnyKeyword:
      case TokenType.UnknownKeyword:
      case TokenType.NumberKeyword:
      case TokenType.BigintKeyword:
      case TokenType.BooleanKeyword:
      case TokenType.StringKeyword:
      case TokenType.SymbolKeyword:
      case TokenType.VoidKeyword:
      case TokenType.UndefinedKeyword:
      case TokenType.NeverKeyword:
      case TokenType.ObjectKeyword: {
        const name = this.ctx.consume().value;
        return { kind: NodeKind.TypeReference, typeName: { kind: NodeKind.Identifier, name, start, end: this.lastEnd() } as Identifier, start, end: this.lastEnd() } as TypeReference;
      }
      case TokenType.NullKeyword: {
        this.ctx.consume();
        return { kind: NodeKind.LiteralType, literal: { kind: "null" }, start, end: this.lastEnd() } as any;
      }
      case TokenType.TrueKeyword: {
        this.ctx.consume();
        return { kind: NodeKind.LiteralType, literal: { kind: "boolean", value: true }, start, end: this.lastEnd() } as any;
      }
      case TokenType.FalseKeyword: {
        this.ctx.consume();
        return { kind: NodeKind.LiteralType, literal: { kind: "boolean", value: false }, start, end: this.lastEnd() } as any;
      }
      case TokenType.StringLiteral: {
        const tok = this.ctx.consume();
        return { kind: NodeKind.LiteralType, literal: { kind: "string", value: tok.value.slice(1, -1) }, start, end: this.lastEnd() } as any;
      }
      case TokenType.NumericLiteral: {
        const tok = this.ctx.consume();
        return { kind: NodeKind.LiteralType, literal: { kind: "number", value: Number(tok.value) }, start, end: this.lastEnd() } as any;
      }
      case TokenType.Minus: {
        // negative number literal type
        this.ctx.consume();
        const numTok = this.ctx.consume();
        return { kind: NodeKind.LiteralType, literal: { kind: "number", value: -Number(numTok.value) }, start, end: this.lastEnd() } as any;
      }
      case TokenType.ThisKeyword: {
        this.ctx.consume();
        return { kind: NodeKind.ThisType, start, end: this.lastEnd() } as ThisType;
      }
      case TokenType.TypeofKeyword: {
        this.ctx.consume();
        const name = this.parseEntityName();
        return { kind: NodeKind.TypeQuery, exprName: name, start, end: this.lastEnd() } as TypeQuery;
      }
      case TokenType.OpenBrace:
        if (this.isMappedTypeStart()) return this.parseMappedType();
        return this.parseTypeLiteral();
      case TokenType.OpenBracket:
        return this.parseTupleType();
      case TokenType.OpenParen: {
        this.ctx.consume();
        const inner = this.parseTypeNode();
        this.ctx.expect(TokenType.CloseParen);
        return { kind: NodeKind.ParenthesizedType, type: inner, start, end: this.lastEnd() } as ParenthesizedType;
      }
      case TokenType.LessThan:
      case TokenType.FunctionKeyword:
      case TokenType.NewKeyword:
        return this.parseFunctionOrConstructorType();
      case TokenType.TemplateHead:
      case TokenType.NoSubstitutionTemplate:
        return this.parseTemplateLiteralType();
      case TokenType.Identifier:
        return this.parseTypeReferenceOrPredicate();
      default: {
        this.diagnostics.add(Diagnostics.ExpressionExpected, this.ctx.current().span, this.fileName);
        this.ctx.consume();
        return { kind: NodeKind.TypeReference, typeName: { kind: NodeKind.Identifier, name: "", start, end: this.lastEnd() } as Identifier, start, end: this.lastEnd() } as TypeReference;
      }
    }
  }

  private parseTypeReferenceOrPredicate(): TypeNode {
    const start = this.ctx.getNodeStart();
    const name = this.parseEntityName();

    // asserts x is T / x is T
    if (this.ctx.peek(0).value === "is" || this.ctx.currentType() === TokenType.IsKeyword) {
      const asserts = false;
      this.ctx.consume();
      const type = this.parseTypeNode();
      return { kind: NodeKind.TypePredicate, asserts, paramName: name as any, type, start, end: this.lastEnd() } as TypePredicate;
    }

    const typeArguments = this.tryParseTypeArguments();
    return { kind: NodeKind.TypeReference, typeName: name, typeArguments, start, end: this.lastEnd() } as TypeReference;
  }

  private parseFunctionOrConstructorType(): TypeNode {
    const start = this.ctx.getNodeStart();
    const isConstructor = this.ctx.tryConsume(TokenType.NewKeyword);
    const isAbstract = isConstructor ? false : false;
    const typeParameters = this.parseTypeParameters();
    const parameters = this.parseParameters();
    this.ctx.expect(TokenType.EqualsGreaterThan);
    const returnType = this.parseTypeNode();
    if (isConstructor) {
      return { kind: NodeKind.ConstructorType, isAbstract, typeParameters, parameters, returnType, start, end: this.lastEnd() } as ConstructorType;
    }
    return { kind: NodeKind.FunctionType, typeParameters, parameters, returnType, start, end: this.lastEnd() } as FunctionType;
  }

  private parseTypeLiteral(): TypeLiteral {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // '{'
    const members: import("../ast/Declarations.ts").TypeElement[] = [];
    while (!this.ctx.match(TokenType.CloseBrace, TokenType.EOF)) {
      const m = this.parseTypeElement();
      if (m) members.push(m);
    }
    this.ctx.expect(TokenType.CloseBrace);
    return { kind: NodeKind.TypeLiteral, members, start, end: this.lastEnd() } as TypeLiteral;
  }

  private isMappedTypeStart(): boolean {
    // { [K in ...
    return this.ctx.tryParse(() => {
      this.ctx.consume(); // '{'
      if (this.ctx.tryConsume(TokenType.ReadonlyKeyword)) {
        // ok
      } else if (this.ctx.currentType() === TokenType.Plus || this.ctx.currentType() === TokenType.Minus) {
        this.ctx.consume();
        if (!this.ctx.tryConsume(TokenType.ReadonlyKeyword)) return undefined;
      }
      if (!this.ctx.tryConsume(TokenType.OpenBracket)) return undefined;
      if (this.ctx.currentType() !== TokenType.Identifier) return undefined;
      this.ctx.consume();
      if (!this.ctx.tryConsume(TokenType.InKeyword)) return undefined;
      return true as const;
    }) !== undefined;
  }

  private parseMappedType(): MappedType {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // '{'
    let readonlyModifier: MappedType["readonlyModifier"];
    if (this.ctx.currentType() === TokenType.ReadonlyKeyword) {
      this.ctx.consume();
      readonlyModifier = true;
    } else if (this.ctx.currentType() === TokenType.Plus || this.ctx.currentType() === TokenType.Minus) {
      readonlyModifier = this.ctx.consume().value as "+" | "-";
      this.ctx.expect(TokenType.ReadonlyKeyword);
    }

    this.ctx.expect(TokenType.OpenBracket);
    const typeParameter = this.parseTypeParameter();
    this.ctx.expect(TokenType.CloseBracket);

    let nameType: TypeNode | undefined;
    if (this.ctx.peek(0).value === "as") {
      this.ctx.consume();
      nameType = this.parseTypeNode();
    }

    let optionalModifier: MappedType["optionalModifier"];
    if (this.ctx.currentType() === TokenType.Question) {
      this.ctx.consume();
      optionalModifier = true;
    } else if (this.ctx.currentType() === TokenType.Plus || this.ctx.currentType() === TokenType.Minus) {
      optionalModifier = this.ctx.consume().value as "+" | "-";
      this.ctx.expect(TokenType.Question);
    }

    let type: TypeNode | undefined;
    if (this.ctx.tryConsume(TokenType.Colon)) type = this.parseTypeNode();
    this.consumeSemicolon();
    this.ctx.expect(TokenType.CloseBrace);
    return { kind: NodeKind.MappedType, readonlyModifier, typeParameter, nameType, optionalModifier, type, start, end: this.lastEnd() } as MappedType;
  }

  private parseTupleType(): TupleType {
    const start = this.ctx.getNodeStart();
    this.ctx.consume(); // '['
    const elements: (TypeNode | NamedTupleMember)[] = [];
    while (!this.ctx.match(TokenType.CloseBracket, TokenType.EOF)) {
      const elemStart = this.ctx.getNodeStart();
      const dotDotDot = this.ctx.tryConsume(TokenType.DotDotDot);
      // named tuple: name?: Type
      if (this.ctx.currentType() === TokenType.Identifier &&
        (this.ctx.peek(1).type === TokenType.Question || this.ctx.peek(1).type === TokenType.Colon)) {
        const name = this.parseIdentifier();
        const optional = this.ctx.tryConsume(TokenType.Question);
        this.ctx.expect(TokenType.Colon);
        const type = this.parseTypeNode();
        elements.push({ kind: NodeKind.NamedTupleMember, name, optional, rest: dotDotDot, type, start: elemStart, end: this.lastEnd() } as NamedTupleMember);
      } else {
        elements.push(this.parseTypeNode());
      }
      if (!this.ctx.tryConsume(TokenType.Comma)) break;
    }
    this.ctx.expect(TokenType.CloseBracket);
    return { kind: NodeKind.TupleType, elements, start, end: this.lastEnd() } as TupleType;
  }

  private parseTemplateLiteralType(): TemplateLiteralType {
    const start = this.ctx.getNodeStart();
    const tok = this.ctx.consume();
    if (tok.type === TokenType.NoSubstitutionTemplate) {
      return { kind: NodeKind.TemplateLiteralType, head: tok.value.slice(1, -1), spans: [], start, end: this.lastEnd() } as TemplateLiteralType;
    }
    const head = tok.value.slice(1, -2);
    const spans: TemplateLiteralTypeSpan[] = [];
    while (true) {
      const spanStart = this.ctx.getNodeStart();
      const type = this.parseTypeNode();
      const tailTok = this.ctx.current();
      if (tailTok.type === TokenType.TemplateTail || tailTok.type === TokenType.TemplateMiddle) {
        this.ctx.consume();
        const tail = tailTok.value.slice(1, tailTok.type === TokenType.TemplateTail ? -1 : -2);
        spans.push({ kind: NodeKind.TemplateLiteralTypeSpan, type, tail, start: spanStart, end: this.lastEnd() } as TemplateLiteralTypeSpan);
        if (tailTok.type === TokenType.TemplateTail) break;
      } else break;
    }
    return { kind: NodeKind.TemplateLiteralType, head, spans, start, end: this.lastEnd() } as TemplateLiteralType;
  }

  private tryParseTypeArguments(): TypeNode[] | undefined {
    if (this.ctx.currentType() !== TokenType.LessThan) return undefined;
    return this.ctx.tryParse(() => {
      this.ctx.consume(); // '<'
      const args: TypeNode[] = [];
      while (!this.ctx.match(TokenType.GreaterThan, TokenType.EOF)) {
        args.push(this.parseTypeNode());
        if (!this.ctx.tryConsume(TokenType.Comma)) break;
      }
      if (!this.ctx.tryConsume(TokenType.GreaterThan)) return undefined;
      return args;
    });
  }

  /**
   * Versión estricta de tryParseTypeArguments para uso en expresiones.
   * En expresiones, '<T>' solo es genérico si va seguido de '(' o backtick.
   */
  private tryParseTypeArgumentsInExpression(): TypeNode[] | undefined {
    if (this.ctx.currentType() !== TokenType.LessThan) return undefined;
    return this.ctx.tryParse(() => {
      this.ctx.consume(); // '<'
      const args: TypeNode[] = [];
      while (!this.ctx.match(TokenType.GreaterThan, TokenType.EOF)) {
        args.push(this.parseTypeNode());
        if (!this.ctx.tryConsume(TokenType.Comma)) break;
      }
      if (!this.ctx.tryConsume(TokenType.GreaterThan)) return undefined;
      // En expresiones, el siguiente token debe ser ( o ` para ser genérico
      if (!this.ctx.match(TokenType.OpenParen, TokenType.TemplateHead, TokenType.NoSubstitutionTemplate, TokenType.Dot, TokenType.QuestionDot)) {
        return undefined;
      }
      return args;
    });
  }

  private parseEntityName(): EntityName {
    let name: EntityName = this.parseIdentifier();
    while (this.ctx.currentType() === TokenType.Dot) {
      this.ctx.consume();
      const right = this.parseIdentifier();
      name = { kind: NodeKind.QualifiedName, left: name, right, start: name.start, end: this.lastEnd() } as QualifiedName;
    }
    return name;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // LITERALES BÁSICOS
  // ────────────────────────────────────────────────────────────────────────────

  private parseIdentifier(): Identifier {
    const start = this.ctx.getNodeStart();
    const tok = this.ctx.current();

    // Identificadores normales o keywords usados como identificadores contextualmente
    if (tok.type === TokenType.Identifier || this.isContextualKeyword()) {
      this.ctx.consume();
      return { kind: NodeKind.Identifier, name: tok.value, start, end: this.lastEnd() };
    }

    this.diagnostics.add(Diagnostics.IdentifierExpected, tok.span, this.fileName);
    return { kind: NodeKind.Identifier, name: "", start, end: tok.span.end.offset };
  }

  private parseStringLiteral(): StringLiteral {
    const start = this.ctx.getNodeStart();
    const tok = this.ctx.consume();
    const raw = tok.value;
    const value = raw.slice(1, -1); // simple procesamiento; escape handling haría falta
    return { kind: NodeKind.StringLiteral, value, raw, start, end: this.lastEnd() };
  }

  private parseNumericLiteral(): NumericLiteral {
    const start = this.ctx.getNodeStart();
    const tok = this.ctx.consume();
    return { kind: NodeKind.NumericLiteral, value: Number(tok.value), raw: tok.value, start, end: this.lastEnd() };
  }

  private parseBigIntLiteral(): BigIntLiteral {
    const start = this.ctx.getNodeStart();
    const tok = this.ctx.consume();
    return { kind: NodeKind.BigIntLiteral, value: tok.value.slice(0, -1), start, end: this.lastEnd() };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // UTILIDADES
  // ────────────────────────────────────────────────────────────────────────────

  /** Consume un ';' opcional; en modo ASI lo omite silenciosamente */
  private consumeSemicolon(): void {
    this.ctx.tryConsume(TokenType.Semicolon);
  }

  /** Offset del final del último token consumido */
  private lastEnd(): number {
    // approximation: usamos el inicio del token actual como referencia
    return this.ctx.current().span.start.offset;
  }

  /** true si el token actual es un keyword usado como identificador contextual */
  private isContextualKeyword(): boolean {
    switch (this.ctx.currentType()) {
      case TokenType.FromKeyword:
      case TokenType.AsKeyword:
      case TokenType.OfKeyword:
      case TokenType.GetKeyword:
      case TokenType.SetKeyword:
      case TokenType.AsyncKeyword:
      case TokenType.IsKeyword:
      case TokenType.TypeKeyword:
      case TokenType.ReadonlyKeyword:
      case TokenType.OverrideKeyword:
      case TokenType.SatisfiesKeyword:
      case TokenType.UsingKeyword:
        return true;
      default:
        return false;
    }
  }

  /**
   * Recuperación de errores: avanza tokens hasta encontrar
   * un punto de sincronización (inicio de sentencia)
   */
  private synchronize(): void {
    while (!this.ctx.isEOF()) {
      if (this.ctx.currentType() === TokenType.Semicolon) {
        this.ctx.consume();
        return;
      }
      switch (this.ctx.currentType()) {
        case TokenType.FunctionKeyword:
        case TokenType.ClassKeyword:
        case TokenType.ConstKeyword:
        case TokenType.LetKeyword:
        case TokenType.VarKeyword:
        case TokenType.ReturnKeyword:
        case TokenType.IfKeyword:
        case TokenType.ForKeyword:
        case TokenType.WhileKeyword:
        case TokenType.OpenBrace:
        case TokenType.CloseBrace:
          return;
      }
      this.ctx.consume();
    }
  }
}

// ── Helpers fuera de la clase ──────────────────────────────────────────────────

function tokenToModifierKind(t: TokenType): import("../ast/Node.ts").ModifierKind {
  switch (t) {
    case TokenType.PublicKeyword: return NodeKind.PublicModifier;
    case TokenType.PrivateKeyword: return NodeKind.PrivateModifier;
    case TokenType.ProtectedKeyword: return NodeKind.ProtectedModifier;
    case TokenType.StaticKeyword: return NodeKind.StaticModifier;
    case TokenType.ReadonlyKeyword: return NodeKind.ReadonlyModifier;
    case TokenType.AbstractKeyword: return NodeKind.AbstractModifier;
    case TokenType.OverrideKeyword: return NodeKind.OverrideModifier;
    case TokenType.AsyncKeyword: return NodeKind.AsyncModifier;
    case TokenType.DeclareKeyword: return NodeKind.DeclareModifier;
    case TokenType.ExportKeyword: return NodeKind.ExportModifier;
    case TokenType.DefaultKeyword: return NodeKind.DefaultModifier;
    default: return NodeKind.PublicModifier;
  }
}
