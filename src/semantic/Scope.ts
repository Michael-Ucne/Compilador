import type { Node } from "../ast/Node.ts";
import { SymbolFlags, createSymbol, type TSSymbol, type SymbolTable } from "./Symbol.ts";

export const enum ScopeKind {
  Global,
  Module,
  Class,
  Interface,
  Function,
  Block,
  ArrowFunction,
  ConditionalType,
}

export interface Scope {
  readonly kind: ScopeKind;
  readonly parent: Scope | undefined;
  readonly symbols: SymbolTable;
  readonly node: Node | null;
  isStrict: boolean;
  // Para scopes de función
  returnType?: import("./Symbol.ts").TSType;
  hasExplicitReturn: boolean;
  hasBareReturn: boolean;
}

function createScope(kind: ScopeKind, parent: Scope | undefined, node: Node | null): Scope {
  return {
    kind,
    parent,
    symbols: new Map(),
    node,
    isStrict: parent?.isStrict ?? false,
    hasExplicitReturn: false,
    hasBareReturn: false,
  };
}

export class ScopeChain {
  private current: Scope;
  readonly global: Scope;

  constructor() {
    this.global = createScope(ScopeKind.Global, undefined, null);
    this.current = this.global;
    this.initGlobals();
  }

  private initGlobals(): void {
    // Declarar tipos y valores globales comunes de TypeScript/JS
    const globals = [
      ["console", SymbolFlags.Variable],
      ["Math", SymbolFlags.Variable],
      ["Array", SymbolFlags.Class],
      ["Object", SymbolFlags.Class],
      ["String", SymbolFlags.Class],
      ["Number", SymbolFlags.Class],
      ["Boolean", SymbolFlags.Class],
      ["Promise", SymbolFlags.Class],
      ["Error", SymbolFlags.Class],
      ["Map", SymbolFlags.Class],
      ["Set", SymbolFlags.Class],
      ["Symbol", SymbolFlags.Class],
      ["RegExp", SymbolFlags.Class],
      ["Date", SymbolFlags.Class],
      ["JSON", SymbolFlags.Variable],
      ["undefined", SymbolFlags.Variable],
      ["NaN", SymbolFlags.Variable],
      ["Infinity", SymbolFlags.Variable],
      ["globalThis", SymbolFlags.Variable],
      ["setTimeout", SymbolFlags.Function],
      ["clearTimeout", SymbolFlags.Function],
      ["setInterval", SymbolFlags.Function],
      ["clearInterval", SymbolFlags.Function],
      ["parseInt", SymbolFlags.Function],
      ["parseFloat", SymbolFlags.Function],
      ["isNaN", SymbolFlags.Function],
      ["isFinite", SymbolFlags.Function],
      ["encodeURIComponent", SymbolFlags.Function],
      ["decodeURIComponent", SymbolFlags.Function],
      // Tipos globales de TypeScript
      ["Partial", SymbolFlags.TypeAlias],
      ["Required", SymbolFlags.TypeAlias],
      ["Readonly", SymbolFlags.TypeAlias],
      ["Record", SymbolFlags.TypeAlias],
      ["Pick", SymbolFlags.TypeAlias],
      ["Omit", SymbolFlags.TypeAlias],
      ["Exclude", SymbolFlags.TypeAlias],
      ["Extract", SymbolFlags.TypeAlias],
      ["NonNullable", SymbolFlags.TypeAlias],
      ["ReturnType", SymbolFlags.TypeAlias],
      ["InstanceType", SymbolFlags.TypeAlias],
      ["Parameters", SymbolFlags.TypeAlias],
      ["ConstructorParameters", SymbolFlags.TypeAlias],
      ["Awaited", SymbolFlags.TypeAlias],
    ] as const;

    for (const [name, flags] of globals) {
      const sym = createSymbol(name, flags as SymbolFlags);
      this.global.symbols.set(name, sym);
    }
  }

  enter(kind: ScopeKind, node: Node | null): Scope {
    const scope = createScope(kind, this.current, node);
    this.current = scope;
    return scope;
  }

  exit(): Scope {
    const exited = this.current;
    if (this.current.parent) {
      this.current = this.current.parent;
    }
    return exited;
  }

  getCurrent(): Scope {
    return this.current;
  }

  /**
   * Declara un símbolo en el scope actual.
   * Retorna el símbolo existente si ya fue declarado (para detectar duplicados).
   */
  declare(name: string, flags: SymbolFlags, declaration: Node): TSSymbol | undefined {
    const existing = this.current.symbols.get(name);
    if (existing) {
      existing.declarations.push(declaration);
      return existing; // indica duplicado
    }
    const sym = createSymbol(name, flags);
    sym.declarations.push(declaration);
    sym.valueDeclaration = declaration;
    this.current.symbols.set(name, sym);
    return undefined; // nuevo símbolo, sin duplicado
  }

  /**
   * Resuelve un nombre buscando hacia arriba en la cadena de scopes.
   */
  resolve(name: string): TSSymbol | undefined {
    let scope: Scope | undefined = this.current;
    while (scope) {
      const sym = scope.symbols.get(name);
      if (sym) return sym;
      scope = scope.parent;
    }
    return undefined;
  }

  /**
   * Resuelve solo en el scope actual (para detectar redeclaraciones locales).
   */
  resolveLocal(name: string): TSSymbol | undefined {
    return this.current.symbols.get(name);
  }

  /** Encuentra el scope de función más cercano */
  enclosingFunction(): Scope | undefined {
    let scope: Scope | undefined = this.current;
    while (scope) {
      if (scope.kind === ScopeKind.Function || scope.kind === ScopeKind.ArrowFunction) {
        return scope;
      }
      scope = scope.parent;
    }
    return undefined;
  }

  /** Encuentra el scope de clase más cercano */
  enclosingClass(): Scope | undefined {
    let scope: Scope | undefined = this.current;
    while (scope) {
      if (scope.kind === ScopeKind.Class) return scope;
      scope = scope.parent;
    }
    return undefined;
  }
}
