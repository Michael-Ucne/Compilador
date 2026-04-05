import type { Node, NodeKind } from "./Node.ts";
import type { Identifier, Expression } from "./Expressions.ts";
import type { TypeParameter, Parameter } from "./Declarations.ts";

// ── Nombres calificados ───────────────────────────────────────────────────────

export interface QualifiedName extends Node {
  readonly kind: NodeKind.QualifiedName;
  readonly left: Identifier | QualifiedName;
  readonly right: Identifier;
}

export type EntityName = Identifier | QualifiedName;

// ── Tipos básicos ─────────────────────────────────────────────────────────────

export interface TypeReference extends Node {
  readonly kind: NodeKind.TypeReference;
  readonly typeName: EntityName;
  readonly typeArguments?: ReadonlyArray<TypeNode>;
}

export interface TypeQuery extends Node {
  readonly kind: NodeKind.TypeQuery;
  readonly exprName: EntityName;    // typeof Foo
}

export interface ThisType extends Node {
  readonly kind: NodeKind.ThisType;
}

// ── Tipos literales ───────────────────────────────────────────────────────────

export interface LiteralType extends Node {
  readonly kind: NodeKind.LiteralType;
  readonly literal: LiteralTypeValue;
}

export type LiteralTypeValue =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "boolean"; value: boolean }
  | { kind: "bigint"; value: string }
  | { kind: "null" }
  | { kind: "undefined" };

// ── Tipos compuestos ──────────────────────────────────────────────────────────

export interface ArrayType extends Node {
  readonly kind: NodeKind.ArrayType;
  readonly elementType: TypeNode;
}

export interface TupleType extends Node {
  readonly kind: NodeKind.TupleType;
  readonly elements: ReadonlyArray<TypeNode | NamedTupleMember>;
}

export interface NamedTupleMember extends Node {
  readonly kind: NodeKind.NamedTupleMember;
  readonly name: Identifier;
  readonly optional: boolean;
  readonly rest: boolean;
  readonly type: TypeNode;
}

export interface OptionalType extends Node {
  readonly kind: NodeKind.OptionalType;
  readonly type: TypeNode;
}

export interface RestType extends Node {
  readonly kind: NodeKind.RestType;
  readonly type: TypeNode;
}

export interface UnionType extends Node {
  readonly kind: NodeKind.UnionType;
  readonly types: ReadonlyArray<TypeNode>;
}

export interface IntersectionType extends Node {
  readonly kind: NodeKind.IntersectionType;
  readonly types: ReadonlyArray<TypeNode>;
}

export interface ParenthesizedType extends Node {
  readonly kind: NodeKind.ParenthesizedType;
  readonly type: TypeNode;
}

// ── Tipos de función ──────────────────────────────────────────────────────────

export interface FunctionType extends Node {
  readonly kind: NodeKind.FunctionType;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly returnType: TypeNode;
}

export interface ConstructorType extends Node {
  readonly kind: NodeKind.ConstructorType;
  readonly isAbstract: boolean;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly returnType: TypeNode;
}

// ── Tipo literal (objeto) ─────────────────────────────────────────────────────

export interface TypeLiteral extends Node {
  readonly kind: NodeKind.TypeLiteral;
  readonly members: ReadonlyArray<import("./Declarations.ts").TypeElement>;
}

// ── Tipo predicado ────────────────────────────────────────────────────────────

export interface TypePredicate extends Node {
  readonly kind: NodeKind.TypePredicate;
  readonly asserts: boolean;       // asserts x is T
  readonly paramName: Identifier | ThisType;
  readonly type?: TypeNode;
}

// ── Operadores de tipo ────────────────────────────────────────────────────────

export interface KeyofType extends Node {
  readonly kind: NodeKind.KeyofType;
  readonly type: TypeNode;
}

export interface UniqueType extends Node {
  readonly kind: NodeKind.UniqueType;
  readonly type: TypeNode; // unique symbol
}

export interface ReadonlyType extends Node {
  readonly kind: NodeKind.ReadonlyType;
  readonly type: TypeNode;
}

// ── Tipos avanzados ───────────────────────────────────────────────────────────

export interface ConditionalType extends Node {
  readonly kind: NodeKind.ConditionalType;
  readonly checkType: TypeNode;
  readonly extendsType: TypeNode;
  readonly trueType: TypeNode;
  readonly falseType: TypeNode;
}

export interface InferType extends Node {
  readonly kind: NodeKind.InferType;
  readonly typeParameter: TypeParameter;
}

export interface MappedType extends Node {
  readonly kind: NodeKind.MappedType;
  readonly readonlyModifier?: "+" | "-" | true;  // +readonly, -readonly, readonly
  readonly typeParameter: TypeParameter;          // [K in keyof T]
  readonly nameType?: TypeNode;                   // as NewKey
  readonly optionalModifier?: "+" | "-" | true;  // +?, -?, ?
  readonly type?: TypeNode;
}

export interface IndexedAccessType extends Node {
  readonly kind: NodeKind.IndexedAccessType;
  readonly objectType: TypeNode;
  readonly indexType: TypeNode;
}

// ── Template literal types ────────────────────────────────────────────────────

export interface TemplateLiteralType extends Node {
  readonly kind: NodeKind.TemplateLiteralType;
  readonly head: string;
  readonly spans: ReadonlyArray<TemplateLiteralTypeSpan>;
}

export interface TemplateLiteralTypeSpan extends Node {
  readonly kind: NodeKind.TemplateLiteralTypeSpan;
  readonly type: TypeNode;
  readonly tail: string;
}

// ── Unión de todos los nodos de tipo ─────────────────────────────────────────

export type TypeNode =
  | TypeReference
  | TypeQuery
  | ThisType
  | LiteralType
  | ArrayType
  | TupleType
  | OptionalType
  | RestType
  | UnionType
  | IntersectionType
  | ParenthesizedType
  | FunctionType
  | ConstructorType
  | TypeLiteral
  | TypePredicate
  | KeyofType
  | UniqueType
  | ReadonlyType
  | ConditionalType
  | InferType
  | MappedType
  | IndexedAccessType
  | TemplateLiteralType
  | NamedTupleMember;
