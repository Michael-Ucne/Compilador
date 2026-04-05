import type { Position, Span } from "../errors/Diagnostic.ts";
import type { TokenType } from "./TokenType.ts";

export type { Position, Span };

export interface Token {
  readonly type: TokenType;
  readonly value: string; // texto raw del source
  readonly span: Span;
}

/** Token especial EOF con posición sintética */
export function makeEOF(pos: Position): Token {
  // Importamos TokenType en runtime para evitar importación circular con const enum
  return {
    type: 1 as TokenType, // TokenType.EOF = 1
    value: "",
    span: { start: pos, end: pos },
  };
}
