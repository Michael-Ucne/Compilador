import type { Node, NodeKind } from "./Node.ts";
import type { Expression, Identifier } from "./Expressions.ts";
import type { Declaration, VariableStatement } from "./Declarations.ts";

// ── Bloque ────────────────────────────────────────────────────────────────────

export interface Block extends Node {
  readonly kind: NodeKind.Block;
  readonly statements: ReadonlyArray<Statement>;
}

// ── Sentencias simples ────────────────────────────────────────────────────────

export interface ExpressionStatement extends Node {
  readonly kind: NodeKind.ExpressionStatement;
  readonly expression: Expression;
}

export interface EmptyStatement extends Node {
  readonly kind: NodeKind.EmptyStatement;
}

// ── Control de flujo ─────────────────────────────────────────────────────────

export interface IfStatement extends Node {
  readonly kind: NodeKind.IfStatement;
  readonly condition: Expression;
  readonly thenBranch: Statement;
  readonly elseBranch?: Statement;
}

export interface WhileStatement extends Node {
  readonly kind: NodeKind.WhileStatement;
  readonly condition: Expression;
  readonly body: Statement;
}

export interface DoStatement extends Node {
  readonly kind: NodeKind.DoStatement;
  readonly body: Statement;
  readonly condition: Expression;
}

export interface ForStatement extends Node {
  readonly kind: NodeKind.ForStatement;
  readonly init?: VariableStatement | Expression;
  readonly condition?: Expression;
  readonly update?: Expression;
  readonly body: Statement;
}

export interface ForInStatement extends Node {
  readonly kind: NodeKind.ForInStatement;
  readonly initializer: VariableStatement | Expression;
  readonly expression: Expression;
  readonly body: Statement;
}

export interface ForOfStatement extends Node {
  readonly kind: NodeKind.ForOfStatement;
  readonly isAwait: boolean;
  readonly initializer: VariableStatement | Expression;
  readonly expression: Expression;
  readonly body: Statement;
}

// ── Salto ─────────────────────────────────────────────────────────────────────

export interface ReturnStatement extends Node {
  readonly kind: NodeKind.ReturnStatement;
  readonly expression?: Expression;
}

export interface BreakStatement extends Node {
  readonly kind: NodeKind.BreakStatement;
  readonly label?: Identifier;
}

export interface ContinueStatement extends Node {
  readonly kind: NodeKind.ContinueStatement;
  readonly label?: Identifier;
}

export interface ThrowStatement extends Node {
  readonly kind: NodeKind.ThrowStatement;
  readonly expression: Expression;
}

// ── Manejo de errores ─────────────────────────────────────────────────────────

export interface TryStatement extends Node {
  readonly kind: NodeKind.TryStatement;
  readonly tryBlock: Block;
  readonly catchClause?: CatchClause;
  readonly finallyBlock?: Block;
}

export interface CatchClause extends Node {
  readonly kind: NodeKind.CatchClause;
  readonly binding?: Expression;       // el parámetro del catch
  readonly bindingType?: import("./Types.ts").TypeNode;
  readonly body: Block;
}

// ── Switch ────────────────────────────────────────────────────────────────────

export interface SwitchStatement extends Node {
  readonly kind: NodeKind.SwitchStatement;
  readonly expression: Expression;
  readonly cases: ReadonlyArray<CaseClause | DefaultClause>;
}

export interface CaseClause extends Node {
  readonly kind: NodeKind.CaseClause;
  readonly expression: Expression;
  readonly statements: ReadonlyArray<Statement>;
}

export interface DefaultClause extends Node {
  readonly kind: NodeKind.DefaultClause;
  readonly statements: ReadonlyArray<Statement>;
}

// ── Labeled ───────────────────────────────────────────────────────────────────

export interface LabeledStatement extends Node {
  readonly kind: NodeKind.LabeledStatement;
  readonly label: Identifier;
  readonly body: Statement;
}

// ── Unión de todas las sentencias ────────────────────────────────────────────

export type Statement =
  | Block
  | ExpressionStatement
  | EmptyStatement
  | IfStatement
  | WhileStatement
  | DoStatement
  | ForStatement
  | ForInStatement
  | ForOfStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | ThrowStatement
  | TryStatement
  | SwitchStatement
  | LabeledStatement
  | Declaration;
