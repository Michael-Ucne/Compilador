import type { TokenType } from "../lexer/TokenType.ts";

/** Rango de posición en el source (offsets byte, no líneas) */
export interface TextRange {
  readonly start: number;
  readonly end: number;
}

/** Todos los tipos de nodo del AST */
export const enum NodeKind {
  // ── Raíz ────────────────────────────────────────────────────────────────────
  SourceFile,

  // ── Declaraciones ───────────────────────────────────────────────────────────
  FunctionDeclaration,
  ClassDeclaration,
  InterfaceDeclaration,
  EnumDeclaration,
  EnumMember,
  TypeAliasDeclaration,
  VariableStatement,
  VariableDeclaration,
  Parameter,
  TypeParameter,
  HeritageClause,
  // Miembros de clase
  PropertyDeclaration,
  MethodDeclaration,
  Constructor,
  GetAccessor,
  SetAccessor,
  IndexSignature,
  // Miembros de interfaz
  PropertySignature,
  MethodSignature,
  ConstructSignature,
  CallSignature,
  // Módulos
  ModuleDeclaration,
  ModuleBlock,
  ImportDeclaration,
  ImportClause,
  NamedImports,
  ImportSpecifier,
  NamespaceImport,
  ExportDeclaration,
  NamedExports,
  ExportSpecifier,
  ExportAssignment,
  // Decoradores
  Decorator,

  // ── Sentencias ───────────────────────────────────────────────────────────────
  Block,
  ExpressionStatement,
  IfStatement,
  WhileStatement,
  DoStatement,
  ForStatement,
  ForInStatement,
  ForOfStatement,
  ReturnStatement,
  BreakStatement,
  ContinueStatement,
  ThrowStatement,
  TryStatement,
  CatchClause,
  SwitchStatement,
  CaseClause,
  DefaultClause,
  LabeledStatement,
  EmptyStatement,

  // ── Expresiones ─────────────────────────────────────────────────────────────
  Identifier,
  StringLiteral,
  NumericLiteral,
  BigIntLiteral,
  BooleanLiteral,
  NullLiteral,
  UndefinedLiteral,
  RegexLiteral,
  TemplateLiteral,
  TemplateSpan,
  TaggedTemplateExpression,
  BinaryExpression,
  UnaryExpression,
  PostfixUnaryExpression,
  ConditionalExpression,
  CallExpression,
  NewExpression,
  PropertyAccessExpression,
  ElementAccessExpression,
  ArrowFunctionExpression,
  FunctionExpression,
  ClassExpression,
  ObjectLiteralExpression,
  PropertyAssignment,
  ShorthandPropertyAssignment,
  SpreadAssignment,
  ComputedPropertyName,
  ArrayLiteralExpression,
  SpreadElement,
  AsExpression,
  SatisfiesExpression,
  NonNullExpression,
  TypeAssertionExpression,
  AwaitExpression,
  YieldExpression,
  DeleteExpression,
  TypeofExpression,
  VoidExpression,
  ParenthesizedExpression,
  // Destructuring
  ObjectBindingPattern,
  ArrayBindingPattern,
  BindingElement,
  // Asignación con destructuring
  AssignmentPattern,

  // ── Nodos de tipo ────────────────────────────────────────────────────────────
  TypeReference,
  QualifiedName,
  ArrayType,
  TupleType,
  NamedTupleMember,
  OptionalType,
  RestType,
  UnionType,
  IntersectionType,
  FunctionType,
  ConstructorType,
  TypeLiteral,
  ParenthesizedType,
  ThisType,
  TypePredicate,
  LiteralType,
  TemplateLiteralType,
  TemplateLiteralTypeSpan,
  KeyofType,
  UniqueType,
  ReadonlyType,
  ConditionalType,
  InferType,
  MappedType,
  IndexedAccessType,
  TypeQuery,

  // ── Modificadores (como nodos independientes) ─────────────────────────────
  PublicModifier,
  PrivateModifier,
  ProtectedModifier,
  StaticModifier,
  ReadonlyModifier,
  AbstractModifier,
  OverrideModifier,
  AsyncModifier,
  DeclareModifier,
  ExportModifier,
  DefaultModifier,
}

export type ModifierKind =
  | NodeKind.PublicModifier
  | NodeKind.PrivateModifier
  | NodeKind.ProtectedModifier
  | NodeKind.StaticModifier
  | NodeKind.ReadonlyModifier
  | NodeKind.AbstractModifier
  | NodeKind.OverrideModifier
  | NodeKind.AsyncModifier
  | NodeKind.DeclareModifier
  | NodeKind.ExportModifier
  | NodeKind.DefaultModifier;

/** Nodo base del que derivan todos los nodos del AST */
export interface Node extends TextRange {
  readonly kind: NodeKind;
  parent?: Node;
}

/** Nodo con lista de modificadores */
export interface NodeWithModifiers extends Node {
  readonly modifiers?: ReadonlyArray<Modifier>;
}

export interface Modifier extends Node {
  readonly kind: ModifierKind;
}

/** Ayuda a construir un modificador desde un TokenType de modificador */
export function modifierKindFromToken(tt: TokenType): ModifierKind | undefined {
  // Los TokenType se resuelven en el parser; aquí solo definimos la forma
  return undefined;
}

/** Información de herencia: extends / implements */
export const enum HeritageLinkKind {
  Extends,
  Implements,
}
