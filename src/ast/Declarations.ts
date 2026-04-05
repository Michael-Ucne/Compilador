import type { Node, NodeKind, NodeWithModifiers, Modifier, HeritageLinkKind } from "./Node.ts";
import type { Expression, Identifier } from "./Expressions.ts";
import type { Statement, Block } from "./Statements.ts";
import type { TypeNode } from "./Types.ts";

// ── Fuente ────────────────────────────────────────────────────────────────────

export interface SourceFile extends Node {
  readonly kind: NodeKind.SourceFile;
  readonly fileName: string;
  readonly statements: ReadonlyArray<Statement>;
}

// ── Parámetros y parámetros de tipo ──────────────────────────────────────────

export type BindingName = Identifier | ObjectBindingPattern | ArrayBindingPattern;

export interface ObjectBindingPattern extends Node {
  readonly kind: NodeKind.ObjectBindingPattern;
  readonly elements: ReadonlyArray<BindingElement>;
}

export interface ArrayBindingPattern extends Node {
  readonly kind: NodeKind.ArrayBindingPattern;
  readonly elements: ReadonlyArray<BindingElement | undefined>; // undefined = elision
}

export interface BindingElement extends Node {
  readonly kind: NodeKind.BindingElement;
  readonly propertyName?: Identifier | Expression; // para { key: binding }
  readonly name: BindingName;
  readonly dotDotDot: boolean;
  readonly optional: boolean;
  readonly initializer?: Expression;
}

export interface TypeParameter extends Node {
  readonly kind: NodeKind.TypeParameter;
  readonly name: Identifier;
  readonly constraint?: TypeNode;  // extends T
  readonly defaultType?: TypeNode; // = T
}

export interface Parameter extends NodeWithModifiers {
  readonly kind: NodeKind.Parameter;
  readonly dotDotDot: boolean;
  readonly name: BindingName;
  readonly optional: boolean;
  readonly type?: TypeNode;
  readonly initializer?: Expression;
}

// ── Variables ─────────────────────────────────────────────────────────────────

export interface VariableStatement extends NodeWithModifiers {
  readonly kind: NodeKind.VariableStatement;
  readonly declarationKind: "const" | "let" | "var";
  readonly declarations: ReadonlyArray<VariableDeclaration>;
}

export interface VariableDeclaration extends Node {
  readonly kind: NodeKind.VariableDeclaration;
  readonly name: BindingName;
  readonly type?: TypeNode;
  readonly initializer?: Expression;
}

// ── Funciones ─────────────────────────────────────────────────────────────────

export interface FunctionDeclaration extends NodeWithModifiers {
  readonly kind: NodeKind.FunctionDeclaration;
  readonly name?: Identifier;           // undefined en export default function(){}
  readonly isGenerator: boolean;
  readonly isAsync: boolean;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly returnType?: TypeNode;
  readonly body?: Block;                // undefined en declaraciones ambientes
}

// ── Clases ────────────────────────────────────────────────────────────────────

export interface HeritageClause extends Node {
  readonly kind: NodeKind.HeritageClause;
  readonly linkKind: HeritageLinkKind;
  readonly types: ReadonlyArray<ExpressionWithTypeArguments>;
}

export interface ExpressionWithTypeArguments extends Node {
  readonly expression: Expression;
  readonly typeArguments?: ReadonlyArray<TypeNode>;
}

export type ClassElement =
  | PropertyDeclaration
  | MethodDeclaration
  | Constructor
  | GetAccessor
  | SetAccessor
  | IndexSignature;

export interface ClassDeclaration extends NodeWithModifiers {
  readonly kind: NodeKind.ClassDeclaration;
  readonly name?: Identifier;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly heritageClauses?: ReadonlyArray<HeritageClause>;
  readonly members: ReadonlyArray<ClassElement>;
}

export interface ClassExpression extends NodeWithModifiers {
  readonly kind: NodeKind.ClassExpression;
  readonly name?: Identifier;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly heritageClauses?: ReadonlyArray<HeritageClause>;
  readonly members: ReadonlyArray<ClassElement>;
}

export interface PropertyDeclaration extends NodeWithModifiers {
  readonly kind: NodeKind.PropertyDeclaration;
  readonly name: Identifier | Expression; // computed: [expr]
  readonly optional: boolean;
  readonly type?: TypeNode;
  readonly initializer?: Expression;
}

export interface MethodDeclaration extends NodeWithModifiers {
  readonly kind: NodeKind.MethodDeclaration;
  readonly name: Identifier | Expression;
  readonly isGenerator: boolean;
  readonly isAsync: boolean;
  readonly optional: boolean;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly returnType?: TypeNode;
  readonly body?: Block;
}

export interface Constructor extends NodeWithModifiers {
  readonly kind: NodeKind.Constructor;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly body?: Block;
}

export interface GetAccessor extends NodeWithModifiers {
  readonly kind: NodeKind.GetAccessor;
  readonly name: Identifier | Expression;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly returnType?: TypeNode;
  readonly body?: Block;
}

export interface SetAccessor extends NodeWithModifiers {
  readonly kind: NodeKind.SetAccessor;
  readonly name: Identifier | Expression;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly body?: Block;
}

export interface IndexSignature extends NodeWithModifiers {
  readonly kind: NodeKind.IndexSignature;
  readonly parameters: ReadonlyArray<Parameter>; // el parámetro index
  readonly type: TypeNode;
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export type TypeElement =
  | PropertySignature
  | MethodSignature
  | IndexSignature
  | ConstructSignature
  | CallSignature;

export interface InterfaceDeclaration extends NodeWithModifiers {
  readonly kind: NodeKind.InterfaceDeclaration;
  readonly name: Identifier;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly heritageClauses?: ReadonlyArray<HeritageClause>;
  readonly members: ReadonlyArray<TypeElement>;
}

export interface PropertySignature extends NodeWithModifiers {
  readonly kind: NodeKind.PropertySignature;
  readonly name: Identifier | Expression;
  readonly optional: boolean;
  readonly type?: TypeNode;
}

export interface MethodSignature extends Node {
  readonly kind: NodeKind.MethodSignature;
  readonly name: Identifier | Expression;
  readonly optional: boolean;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly returnType?: TypeNode;
}

export interface ConstructSignature extends Node {
  readonly kind: NodeKind.ConstructSignature;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly returnType?: TypeNode;
}

export interface CallSignature extends Node {
  readonly kind: NodeKind.CallSignature;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly returnType?: TypeNode;
}

// ── Enums ─────────────────────────────────────────────────────────────────────

export interface EnumDeclaration extends NodeWithModifiers {
  readonly kind: NodeKind.EnumDeclaration;
  readonly isConst: boolean;
  readonly name: Identifier;
  readonly members: ReadonlyArray<EnumMember>;
}

export interface EnumMember extends Node {
  readonly kind: NodeKind.EnumMember;
  readonly name: Identifier | Expression;
  readonly initializer?: Expression;
}

// ── Tipos alias ───────────────────────────────────────────────────────────────

export interface TypeAliasDeclaration extends NodeWithModifiers {
  readonly kind: NodeKind.TypeAliasDeclaration;
  readonly name: Identifier;
  readonly typeParameters?: ReadonlyArray<TypeParameter>;
  readonly type: TypeNode;
}

// ── Módulos ───────────────────────────────────────────────────────────────────

export interface ModuleDeclaration extends NodeWithModifiers {
  readonly kind: NodeKind.ModuleDeclaration;
  readonly name: Identifier | StringLiteralNode;
  readonly body?: ModuleBlock | ModuleDeclaration;
}

export interface ModuleBlock extends Node {
  readonly kind: NodeKind.ModuleBlock;
  readonly statements: ReadonlyArray<Statement>;
}

// alias local para no importar circular
export interface StringLiteralNode extends Node {
  readonly kind: NodeKind.StringLiteral;
  readonly value: string;
}

// ── Imports / Exports ─────────────────────────────────────────────────────────

export interface ImportDeclaration extends NodeWithModifiers {
  readonly kind: NodeKind.ImportDeclaration;
  readonly importClause?: ImportClause;
  readonly moduleSpecifier: Expression;
  readonly isTypeOnly: boolean;
}

export interface ImportClause extends Node {
  readonly kind: NodeKind.ImportClause;
  readonly name?: Identifier;              // default import
  readonly namedBindings?: NamedImports | NamespaceImport;
}

export interface NamedImports extends Node {
  readonly kind: NodeKind.NamedImports;
  readonly elements: ReadonlyArray<ImportSpecifier>;
}

export interface ImportSpecifier extends Node {
  readonly kind: NodeKind.ImportSpecifier;
  readonly propertyName?: Identifier; // nombre original (para 'foo as bar')
  readonly name: Identifier;
  readonly isTypeOnly: boolean;
}

export interface NamespaceImport extends Node {
  readonly kind: NodeKind.NamespaceImport;
  readonly name: Identifier;
}

export interface ExportDeclaration extends NodeWithModifiers {
  readonly kind: NodeKind.ExportDeclaration;
  readonly isTypeOnly: boolean;
  readonly exportClause?: NamedExports | NamespaceExport;
  readonly moduleSpecifier?: Expression;
}

export interface NamedExports extends Node {
  readonly kind: NodeKind.NamedExports;
  readonly elements: ReadonlyArray<ExportSpecifier>;
}

export interface ExportSpecifier extends Node {
  readonly kind: NodeKind.ExportSpecifier;
  readonly propertyName?: Identifier;
  readonly name: Identifier;
  readonly isTypeOnly: boolean;
}

export interface NamespaceExport extends Node {
  readonly name: Identifier;
}

export interface ExportAssignment extends NodeWithModifiers {
  readonly kind: NodeKind.ExportAssignment;
  readonly isExportEquals: boolean; // true = `export =`, false = `export default`
  readonly expression: Expression;
}

// ── Decoradores ───────────────────────────────────────────────────────────────

export interface Decorator extends Node {
  readonly kind: NodeKind.Decorator;
  readonly expression: Expression;
}

// ── Tipos de declaración (para el parser) ────────────────────────────────────

export type Declaration =
  | FunctionDeclaration
  | ClassDeclaration
  | InterfaceDeclaration
  | EnumDeclaration
  | TypeAliasDeclaration
  | VariableStatement
  | ModuleDeclaration
  | ImportDeclaration
  | ExportDeclaration
  | ExportAssignment;
