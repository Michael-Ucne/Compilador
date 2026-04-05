import type { Node, NodeKind, NodeWithModifiers } from "./Node.ts";
import type { TypeNode } from "./Types.ts";
import type {
  TypeParameter,
  Parameter,
  BindingName,
  ObjectBindingPattern,
  ArrayBindingPattern,
  BindingElement,
  ClassExpression,
} from "./Declarations.ts";
import type { Block } from "./Statements.ts";

// ── Literales ─────────────────────────────────────────────────────────────────

export interface Identifier extends Node {
  readonly kind: NodeKind.Identifier;
  readonly name: string;
}

export interface StringLiteral extends Node {
  readonly kind: NodeKind.StringLiteral;
  readonly value: string; // valor sin comillas, escapes procesados
  readonly raw: string;   // texto raw del source
}

export interface NumericLiteral extends Node {
  readonly kind: NodeKind.NumericLiteral;
  readonly value: number;
  readonly raw: string;
}

export interface BigIntLiteral extends Node {
  readonly kind: NodeKind.BigIntLiteral;
  readonly value: string; // texto sin 'n'
}

export interface BooleanLiteral extends Node {
  readonly kind: NodeKind.BooleanLiteral;
  readonly value: boolean;
}

export interface NullLiteral extends Node {
  readonly kind: NodeKind.NullLiteral;
}

export interface UndefinedLiteral extends Node {
  readonly kind: NodeKind.UndefinedLiteral;
}

export interface RegexLiteral extends Node {
  readonly kind: NodeKind.RegexLiteral;
  readonly pattern: string;
  readonly flags: string;
}

// ── Template literals ─────────────────────────────────────────────────────────

export interface TemplateLiteral extends Node {
  readonly kind: NodeKind.TemplateLiteral;
  readonly head: string;           // texto antes del primer ${
  readonly spans: ReadonlyArray<TemplateSpan>;
}

export interface TemplateSpan extends Node {
  readonly kind: NodeKind.TemplateSpan;
  readonly expression: Expression;
  readonly tail: string;           // texto después del } (incluye `si es el último)
  readonly isTail: boolean;        // true = este span es el último
}

export interface TaggedTemplateExpression extends Node {
  readonly kind: NodeKind.TaggedTemplateExpression;
  readonly tag: Expression;
  readonly typeArguments?: ReadonlyArray<TypeNode>;
  readonly template: TemplateLiteral | StringLiteral; // NoSubstitutionTemplate
}

// ── Operaciones binarias ──────────────────────────────────────────────────────

export interface BinaryExpression extends Node {
  readonly kind: NodeKind.BinaryExpression;
  readonly left: Expression;
  readonly operator: string; // texto del operador: "+", "===", "&&", etc.
  readonly right: Expression;
}

export interface UnaryExpression extends Node {
  readonly kind: NodeKind.UnaryExpression;
  readonly operator: string; // "!", "~", "+", "-", "typeof", "void", "delete", "await"
  readonly operand: Expression;
}

export interface PostfixUnaryExpression extends Node {
  readonly kind: NodeKind.PostfixUnaryExpression;
  readonly operand: Expression;
  readonly operator: "++" | "--";
}

export interface ConditionalExpression extends Node {
  readonly kind: NodeKind.ConditionalExpression;
  readonly condition: Expression;
  readonly whenTrue: Expression;
  readonly whenFalse: Expression;
}

// ── Acceso y llamadas ─────────────────────────────────────────────────────────

export interface CallExpression extends Node {
  readonly kind: NodeKind.CallExpression;
  readonly callee: Expression;
  readonly typeArguments?: ReadonlyArray<TypeNode>;
  readonly args: ReadonlyArray<Expression>;
  readonly isOptional: boolean; // ?.()
}

export interface NewExpression extends Node {
  readonly kind: NodeKind.NewExpression;
  readonly callee: Expression;
  readonly typeArguments?: ReadonlyArray<TypeNode>;
  readonly args?: ReadonlyArray<Expression>;
}

export interface PropertyAccessExpression extends Node {
  readonly kind: NodeKind.PropertyAccessExpression;
  readonly object: Expression;
  readonly property: Identifier;
  readonly isOptional: boolean; // ?.
}

export interface ElementAccessExpression extends Node {
  readonly kind: NodeKind.ElementAccessExpression;
  readonly object: Expression;
  readonly index: Expression;
  readonly isOptional: boolean; // ?.[
}

// ── Funciones ─────────────────────────────────────────────────────────────────

export interface ArrowFunctionExpression extends NodeWithModifiers {
  readonly kind: NodeKind.ArrowFunctionExpression;
  readonly isAsync: boolean;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly returnType?: TypeNode;
  readonly body: Expression | Block; // expression body o block body
}

export interface FunctionExpression extends NodeWithModifiers {
  readonly kind: NodeKind.FunctionExpression;
  readonly name?: Identifier;
  readonly isGenerator: boolean;
  readonly isAsync: boolean;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly returnType?: TypeNode;
  readonly body: Block;
}

// ── Objetos y arrays ──────────────────────────────────────────────────────────

export interface ObjectLiteralExpression extends Node {
  readonly kind: NodeKind.ObjectLiteralExpression;
  readonly properties: ReadonlyArray<ObjectLiteralElement>;
}

export type ObjectLiteralElement =
  | PropertyAssignment
  | ShorthandPropertyAssignment
  | SpreadAssignment
  | MethodDeclarationInObject
  | GetAccessorInObject
  | SetAccessorInObject;

export interface PropertyAssignment extends Node {
  readonly kind: NodeKind.PropertyAssignment;
  readonly name: Identifier | Expression; // puede ser computed [expr]
  readonly initializer: Expression;
}

export interface ShorthandPropertyAssignment extends Node {
  readonly kind: NodeKind.ShorthandPropertyAssignment;
  readonly name: Identifier;
  readonly objectAssignmentInitializer?: Expression; // { a = 1 }
}

export interface SpreadAssignment extends Node {
  readonly kind: NodeKind.SpreadAssignment;
  readonly expression: Expression;
}

// Accesores dentro de objetos literales comparten estructura
export interface MethodDeclarationInObject extends Node {
  readonly kind: NodeKind.MethodDeclaration;
  readonly name: Identifier | Expression;
  readonly isGenerator: boolean;
  readonly isAsync: boolean;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly returnType?: TypeNode;
  readonly body: Block;
}

export interface GetAccessorInObject extends Node {
  readonly kind: NodeKind.GetAccessor;
  readonly name: Identifier | Expression;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly returnType?: TypeNode;
  readonly body: Block;
}

export interface SetAccessorInObject extends Node {
  readonly kind: NodeKind.SetAccessor;
  readonly name: Identifier | Expression;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly body: Block;
}

export interface ComputedPropertyName extends Node {
  readonly kind: NodeKind.ComputedPropertyName;
  readonly expression: Expression;
}

export interface ArrayLiteralExpression extends Node {
  readonly kind: NodeKind.ArrayLiteralExpression;
  readonly elements: ReadonlyArray<Expression | SpreadElement | undefined>; // undefined = elision
}

export interface SpreadElement extends Node {
  readonly kind: NodeKind.SpreadElement;
  readonly expression: Expression;
}

// ── Conversiones de tipo ──────────────────────────────────────────────────────

export interface AsExpression extends Node {
  readonly kind: NodeKind.AsExpression;
  readonly expression: Expression;
  readonly type: TypeNode;
}

export interface SatisfiesExpression extends Node {
  readonly kind: NodeKind.SatisfiesExpression;
  readonly expression: Expression;
  readonly type: TypeNode;
}

export interface NonNullExpression extends Node {
  readonly kind: NodeKind.NonNullExpression;
  readonly expression: Expression;
}

export interface TypeAssertionExpression extends Node {
  readonly kind: NodeKind.TypeAssertionExpression;
  readonly type: TypeNode;
  readonly expression: Expression;
}

// ── Async / Generator ────────────────────────────────────────────────────────

export interface AwaitExpression extends Node {
  readonly kind: NodeKind.AwaitExpression;
  readonly expression: Expression;
}

export interface YieldExpression extends Node {
  readonly kind: NodeKind.YieldExpression;
  readonly delegate: boolean; // yield*
  readonly expression?: Expression;
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export interface DeleteExpression extends Node {
  readonly kind: NodeKind.DeleteExpression;
  readonly expression: Expression;
}

export interface TypeofExpression extends Node {
  readonly kind: NodeKind.TypeofExpression;
  readonly expression: Expression;
}

export interface VoidExpression extends Node {
  readonly kind: NodeKind.VoidExpression;
  readonly expression: Expression;
}

export interface ParenthesizedExpression extends Node {
  readonly kind: NodeKind.ParenthesizedExpression;
  readonly expression: Expression;
}

// ── Unión de todas las expresiones ───────────────────────────────────────────

export type Expression =
  | Identifier
  | StringLiteral
  | NumericLiteral
  | BigIntLiteral
  | BooleanLiteral
  | NullLiteral
  | UndefinedLiteral
  | RegexLiteral
  | TemplateLiteral
  | TaggedTemplateExpression
  | BinaryExpression
  | UnaryExpression
  | PostfixUnaryExpression
  | ConditionalExpression
  | CallExpression
  | NewExpression
  | PropertyAccessExpression
  | ElementAccessExpression
  | ArrowFunctionExpression
  | FunctionExpression
  | ClassExpression
  | ObjectLiteralExpression
  | ArrayLiteralExpression
  | SpreadElement
  | AsExpression
  | SatisfiesExpression
  | NonNullExpression
  | TypeAssertionExpression
  | AwaitExpression
  | YieldExpression
  | DeleteExpression
  | TypeofExpression
  | VoidExpression
  | ParenthesizedExpression
  | ObjectBindingPattern
  | ArrayBindingPattern;
