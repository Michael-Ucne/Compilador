export const enum IRKind {
  Program,
  FunctionDecl,
  VariableDecl,
  ClassDecl,
  MethodDecl,
  Block,
  ExprStatement,
  IfStatement,
  WhileStatement,
  DoWhileStatement,
  ForStatement,
  ReturnStatement,
  BreakStatement,
  ContinueStatement,
  ThrowStatement,
  TryStatement,
  SwitchStatement,
  SwitchCase,
  LabeledStatement,
  Literal,
  Identifier,
  BinaryExpr,
  UnaryExpr,
  AssignExpr,
  CallExpr,
  NewExpr,
  MemberExpr,
  ArrayExpr,
  ObjectExpr,
  Property,
  FunctionExpr,
  ArrowFunctionExpr,
  SequenceExpr,
  ObjectBindingPattern,
  ArrayBindingPattern,
  BindingElement,
  ConditionalExpr,
  SpreadExpr,
  TemplateLiteral,
  TaggedTemplate,
  Await,
  Yield,
  TypeAssertion,
}

export interface IRNode {
  readonly kind: IRKind;
}

export interface IRProgram extends IRNode {
  readonly kind: IRKind.Program;
  readonly body: IRStatement[];
}

export interface IRFunctionDecl extends IRNode {
  readonly kind: IRKind.FunctionDecl;
  readonly name: string | null;
  readonly params: IRParam[];
  readonly body: IRBlock;
  readonly isGenerator: boolean;
  readonly isAsync: boolean;
}

export type IRBindingName = IRIdentifier | IRObjectBindingPattern | IRArrayBindingPattern;

export interface IRParam {
  readonly name: IRBindingName;
  readonly rest: boolean;
  readonly defaultValue: IRExpression | null;
}

export interface IRVariableDecl extends IRNode {
  readonly kind: IRKind.VariableDecl;
  readonly declKind: "const" | "let" | "var";
  readonly bindings: IRBinding[];
}

export interface IRBinding {
  readonly name: IRBindingName;
  readonly init: IRExpression | null;
}

export interface IRObjectBindingPattern extends IRNode {
  readonly kind: IRKind.ObjectBindingPattern;
  readonly elements: IRBindingElement[];
}

export interface IRArrayBindingPattern extends IRNode {
  readonly kind: IRKind.ArrayBindingPattern;
  readonly elements: (IRBindingElement | undefined)[];
}

export interface IRBindingElement extends IRNode {
  readonly kind: IRKind.BindingElement;
  readonly propertyName?: IRExpression;
  readonly name: IRBindingName;
  readonly rest: boolean;
  readonly optional: boolean;
  readonly initializer: IRExpression | null;
}

export interface IRClassDecl extends IRNode {
  readonly kind: IRKind.ClassDecl;
  readonly name: string | null;
  readonly superClass: IRExpression | null;
  readonly body: IRMethodDecl[];
}

export interface IRMethodDecl extends IRNode {
  readonly kind: IRKind.MethodDecl;
  readonly name: string;
  readonly params: IRParam[];
  readonly body: IRBlock;
  readonly isStatic: boolean;
  readonly isAsync: boolean;
  readonly isGenerator: boolean;
  readonly methodKind: "method" | "get" | "set" | "constructor";
}

export type IRStatement =
  | IRFunctionDecl
  | IRVariableDecl
  | IRClassDecl
  | IRBlock
  | IRExprStatement
  | IRIfStatement
  | IRWhileStatement
  | IRDoWhileStatement
  | IRForStatement
  | IRReturnStatement
  | IRBreakStatement
  | IRContinueStatement
  | IRThrowStatement
  | IRTryStatement
  | IRSwitchStatement
  | IRLabeledStatement;

export interface IRBlock extends IRNode {
  readonly kind: IRKind.Block;
  readonly body: IRStatement[];
}

export interface IRExprStatement extends IRNode {
  readonly kind: IRKind.ExprStatement;
  readonly expression: IRExpression;
}

export interface IRIfStatement extends IRNode {
  readonly kind: IRKind.IfStatement;
  readonly test: IRExpression;
  readonly consequent: IRStatement;
  readonly alternate: IRStatement | null;
}

export interface IRWhileStatement extends IRNode {
  readonly kind: IRKind.WhileStatement;
  readonly test: IRExpression;
  readonly body: IRStatement;
}

export interface IRDoWhileStatement extends IRNode {
  readonly kind: IRKind.DoWhileStatement;
  readonly body: IRStatement;
  readonly test: IRExpression;
}

export interface IRForStatement extends IRNode {
  readonly kind: IRKind.ForStatement;
  readonly init: IRVariableDecl | IRExpression | null;
  readonly test: IRExpression | null;
  readonly update: IRExpression | null;
  readonly body: IRStatement;
}

export interface IRReturnStatement extends IRNode {
  readonly kind: IRKind.ReturnStatement;
  readonly argument: IRExpression | null;
}

export interface IRBreakStatement extends IRNode {
  readonly kind: IRKind.BreakStatement;
  readonly label: string | null;
}

export interface IRContinueStatement extends IRNode {
  readonly kind: IRKind.ContinueStatement;
  readonly label: string | null;
}

export interface IRThrowStatement extends IRNode {
  readonly kind: IRKind.ThrowStatement;
  readonly argument: IRExpression;
}

export interface IRTryStatement extends IRNode {
  readonly kind: IRKind.TryStatement;
  readonly block: IRBlock;
  readonly handler: IRCatchClause | null;
  readonly finalizer: IRBlock | null;
}

export interface IRCatchClause {
  readonly param: string | null;
  readonly body: IRBlock;
}

export interface IRSwitchStatement extends IRNode {
  readonly kind: IRKind.SwitchStatement;
  readonly discriminant: IRExpression;
  readonly cases: IRSwitchCase[];
}

export interface IRSwitchCase extends IRNode {
  readonly kind: IRKind.SwitchCase;
  readonly test: IRExpression | null;
  readonly consequent: IRStatement[];
}

export interface IRLabeledStatement extends IRNode {
  readonly kind: IRKind.LabeledStatement;
  readonly label: string;
  readonly body: IRStatement;
}

export type IRExpression =
  | IRLiteral
  | IRIdentifier
  | IRBinaryExpr
  | IRUnaryExpr
  | IRAssignExpr
  | IRCallExpr
  | IRNewExpr
  | IRMemberExpr
  | IRArrayExpr
  | IRObjectExpr
  | IRFunctionExpr
  | IRArrowFunctionExpr
  | IRSequenceExpr
  | IRConditionalExpr
  | IRSpreadExpr
  | IRTemplateLiteral
  | IRTaggedTemplate
  | IRAwaît
  | IRYield;

export interface IRLiteral extends IRNode {
  readonly kind: IRKind.Literal;
  readonly value: string | number | boolean | null | undefined;
  readonly raw: string;
}

export interface IRIdentifier extends IRNode {
  readonly kind: IRKind.Identifier;
  readonly name: string;
}

export interface IRBinaryExpr extends IRNode {
  readonly kind: IRKind.BinaryExpr;
  readonly operator: string;
  readonly left: IRExpression;
  readonly right: IRExpression;
}

export interface IRUnaryExpr extends IRNode {
  readonly kind: IRKind.UnaryExpr;
  readonly operator: string;
  readonly operand: IRExpression;
  readonly prefix: boolean;
}

export interface IRAssignExpr extends IRNode {
  readonly kind: IRKind.AssignExpr;
  readonly operator: string;
  readonly left: IRExpression;
  readonly right: IRExpression;
}

export interface IRCallExpr extends IRNode {
  readonly kind: IRKind.CallExpr;
  readonly callee: IRExpression;
  readonly args: IRExpression[];
  readonly optional: boolean;
}

export interface IRNewExpr extends IRNode {
  readonly kind: IRKind.NewExpr;
  readonly callee: IRExpression;
  readonly args: IRExpression[];
}

export interface IRMemberExpr extends IRNode {
  readonly kind: IRKind.MemberExpr;
  readonly object: IRExpression;
  readonly property: IRExpression;
  readonly computed: boolean;
  readonly optional: boolean;
}

export interface IRArrayExpr extends IRNode {
  readonly kind: IRKind.ArrayExpr;
  readonly elements: (IRExpression | null)[];
}

export interface IRObjectExpr extends IRNode {
  readonly kind: IRKind.ObjectExpr;
  readonly properties: IRProperty[];
}

export interface IRProperty extends IRNode {
  readonly kind: IRKind.Property;
  readonly key: IRExpression;
  readonly value: IRExpression;
  readonly computed: boolean;
  readonly shorthand: boolean;
  readonly spread: boolean;
}

export interface IRFunctionExpr extends IRNode {
  readonly kind: IRKind.FunctionExpr;
  readonly name: string | null;
  readonly params: IRParam[];
  readonly body: IRBlock;
  readonly isGenerator: boolean;
  readonly isAsync: boolean;
}

export interface IRArrowFunctionExpr extends IRNode {
  readonly kind: IRKind.ArrowFunctionExpr;
  readonly params: IRParam[];
  readonly body: IRBlock | IRExpression;
  readonly isAsync: boolean;
}

export interface IRSequenceExpr extends IRNode {
  readonly kind: IRKind.SequenceExpr;
  readonly expressions: IRExpression[];
}

export interface IRConditionalExpr extends IRNode {
  readonly kind: IRKind.ConditionalExpr;
  readonly test: IRExpression;
  readonly consequent: IRExpression;
  readonly alternate: IRExpression;
}

export interface IRSpreadExpr extends IRNode {
  readonly kind: IRKind.SpreadExpr;
  readonly argument: IRExpression;
}

export interface IRTemplateLiteral extends IRNode {
  readonly kind: IRKind.TemplateLiteral;
  readonly quasis: string[];
  readonly expressions: IRExpression[];
}

export interface IRTaggedTemplate extends IRNode {
  readonly kind: IRKind.TaggedTemplate;
  readonly tag: IRExpression;
  readonly quasi: IRTemplateLiteral;
}

export interface IRAwaît extends IRNode {
  readonly kind: IRKind.Await;
  readonly argument: IRExpression;
}

export interface IRYield extends IRNode {
  readonly kind: IRKind.Yield;
  readonly argument: IRExpression | null;
  readonly delegate: boolean;
}
