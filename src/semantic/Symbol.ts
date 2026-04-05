import type { Node } from "../ast/Node.ts";

export const enum SymbolFlags {
  None        = 0,
  Variable    = 1 << 0,
  Function    = 1 << 1,
  Class       = 1 << 2,
  Interface   = 1 << 3,
  Enum        = 1 << 4,
  EnumMember  = 1 << 5,
  TypeAlias   = 1 << 6,
  TypeParameter = 1 << 7,
  Parameter   = 1 << 8,
  Property    = 1 << 9,
  Method      = 1 << 10,
  Accessor    = 1 << 11,
  Constructor = 1 << 12,
  Module      = 1 << 13,
  Import      = 1 << 14,

  Value = Variable | Function | Class | Enum | Parameter | Property | Method,
  Type  = Interface | Class | Enum | TypeAlias | TypeParameter,
}

export const enum SymbolModifierFlags {
  None      = 0,
  Public    = 1 << 0,
  Private   = 1 << 1,
  Protected = 1 << 2,
  Static    = 1 << 3,
  Readonly  = 1 << 4,
  Abstract  = 1 << 5,
  Const     = 1 << 6,
}

export interface TSSymbol {
  name: string;
  flags: SymbolFlags;
  modifierFlags: SymbolModifierFlags;
  declarations: Node[];
  valueDeclaration?: Node;
  resolvedType?: TSType;
  members?: SymbolTable;    // miembros de clase/interfaz
  exports?: SymbolTable;    // exports de módulo
}

export type SymbolTable = Map<string, TSSymbol>;

export function createSymbol(name: string, flags: SymbolFlags): TSSymbol {
  return {
    name,
    flags,
    modifierFlags: SymbolModifierFlags.None,
    declarations: [],
  };
}

// ── Tipos del sistema de tipos ────────────────────────────────────────────────

export const enum TypeFlags {
  Unknown     = 1 << 0,
  Any         = 1 << 1,
  Never       = 1 << 2,
  Void        = 1 << 3,
  Undefined   = 1 << 4,
  Null        = 1 << 5,
  Boolean     = 1 << 6,
  Number      = 1 << 7,
  String      = 1 << 8,
  BigInt      = 1 << 9,
  Symbol      = 1 << 10,
  Object      = 1 << 11,
  Function    = 1 << 12,
  Union       = 1 << 13,
  Intersection = 1 << 14,
  Literal     = 1 << 15,
  TypeParameter = 1 << 16,
}

export interface TSType {
  flags: TypeFlags;
  symbol?: TSSymbol;
  types?: TSType[];       // para Union/Intersection
  literalValue?: string | number | boolean | null;
}

// Singletons de tipos intrínsecos
export const anyType: TSType     = { flags: TypeFlags.Any };
export const unknownType: TSType = { flags: TypeFlags.Unknown };
export const neverType: TSType   = { flags: TypeFlags.Never };
export const voidType: TSType    = { flags: TypeFlags.Void };
export const undefinedType: TSType = { flags: TypeFlags.Undefined };
export const nullType: TSType    = { flags: TypeFlags.Null };
export const booleanType: TSType = { flags: TypeFlags.Boolean };
export const numberType: TSType  = { flags: TypeFlags.Number };
export const stringType: TSType  = { flags: TypeFlags.String };
export const bigintType: TSType  = { flags: TypeFlags.BigInt };
export const symbolType: TSType  = { flags: TypeFlags.Symbol };
export const objectType: TSType  = { flags: TypeFlags.Object };

export function getLiteralType(value: string | number | boolean | null): TSType {
  return { flags: TypeFlags.Literal, literalValue: value };
}

export function getUnionType(types: TSType[]): TSType {
  // Descartar never, aplanar unions anidadas
  const flat = types.flatMap(t =>
    t.flags === TypeFlags.Never ? [] :
    t.flags & TypeFlags.Union ? (t.types ?? []) : [t]
  );
  if (flat.length === 0) return neverType;
  if (flat.length === 1) return flat[0]!;
  return { flags: TypeFlags.Union, types: flat };
}

export function typeToString(t: TSType): string {
  if (t.flags & TypeFlags.Any) return "any";
  if (t.flags & TypeFlags.Unknown) return "unknown";
  if (t.flags & TypeFlags.Never) return "never";
  if (t.flags & TypeFlags.Void) return "void";
  if (t.flags & TypeFlags.Undefined) return "undefined";
  if (t.flags & TypeFlags.Null) return "null";
  if (t.flags & TypeFlags.Boolean) return "boolean";
  if (t.flags & TypeFlags.Number) return "number";
  if (t.flags & TypeFlags.String) return "string";
  if (t.flags & TypeFlags.BigInt) return "bigint";
  if (t.flags & TypeFlags.Symbol) return "symbol";
  if (t.flags & TypeFlags.Object) return t.symbol?.name ?? "object";
  if (t.flags & TypeFlags.Function) return "Function";
  if (t.flags & TypeFlags.Union) return t.types?.map(typeToString).join(" | ") ?? "never";
  if (t.flags & TypeFlags.Intersection) return t.types?.map(typeToString).join(" & ") ?? "never";
  if (t.flags & TypeFlags.Literal) return JSON.stringify(t.literalValue);
  if (t.flags & TypeFlags.TypeParameter) return t.symbol?.name ?? "T";
  return "unknown";
}
