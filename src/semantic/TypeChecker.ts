import { NodeKind } from "../ast/Node.ts";
import type { TypeNode } from "../ast/Types.ts";
import type { Expression } from "../ast/Expressions.ts";
import {
  type TSType, type TSSymbol, type SymbolTable,
  TypeFlags, SymbolFlags,
  anyType, unknownType, neverType, voidType, undefinedType, nullType,
  booleanType, numberType, stringType, bigintType, symbolType, objectType,
  getLiteralType, getUnionType, typeToString,
} from "./Symbol.ts";
import type { ScopeChain } from "./Scope.ts";

export class TypeChecker {
  private readonly nodeTypeCache = new WeakMap<object, TSType>();

  /**
   * Resuelve un nodo de tipo TypeScript a un objeto TSType.
   */
  resolveTypeNode(node: TypeNode, scopes: ScopeChain): TSType {
    const cached = this.nodeTypeCache.get(node);
    if (cached) return cached;
    const result = this.resolveTypeNodeImpl(node, scopes);
    this.nodeTypeCache.set(node, result);
    return result;
  }

  private resolveTypeNodeImpl(node: TypeNode, scopes: ScopeChain): TSType {
    switch (node.kind) {
      case NodeKind.TypeReference: {
        const name = node.typeName.kind === NodeKind.Identifier
          ? node.typeName.name
          : node.typeName.right.name;

        // Tipos primitivos representados como TypeReference
        switch (name) {
          case "any": return anyType;
          case "unknown": return unknownType;
          case "never": return neverType;
          case "void": return voidType;
          case "undefined": return undefinedType;
          case "null": return nullType;
          case "boolean": return booleanType;
          case "number": return numberType;
          case "string": return stringType;
          case "bigint": return bigintType;
          case "symbol": return symbolType;
          case "object": return objectType;
        }

        // Buscar en scopes
        const sym = scopes.resolve(name);
        if (sym) {
          if (sym.resolvedType) return sym.resolvedType;
          return { flags: TypeFlags.Object, symbol: sym };
        }

        return unknownType;
      }

      case NodeKind.UnionType: {
        const types = node.types.map(t => this.resolveTypeNode(t, scopes));
        return getUnionType(types);
      }

      case NodeKind.IntersectionType: {
        return { flags: TypeFlags.Intersection, types: node.types.map(t => this.resolveTypeNode(t, scopes)) };
      }

      case NodeKind.ArrayType: {
        const elemType = this.resolveTypeNode(node.elementType, scopes);
        return { flags: TypeFlags.Object, symbol: { name: "Array", flags: SymbolFlags.Class, modifierFlags: 0, declarations: [], resolvedType: elemType } as any };
      }

      case NodeKind.LiteralType: {
        const lit = node.literal;
        if (lit.kind === "null") return nullType;
        if (lit.kind === "undefined") return undefinedType;
        return getLiteralType(lit.value);
      }

      case NodeKind.FunctionType:
      case NodeKind.ConstructorType:
        return { flags: TypeFlags.Function };

      case NodeKind.TypeLiteral:
        return { flags: TypeFlags.Object };

      case NodeKind.ThisType:
        return objectType; // simplificado

      case NodeKind.KeyofType:
        return stringType; // simplificado

      case NodeKind.ConditionalType:
        return unknownType; // simplificado

      case NodeKind.MappedType:
        return { flags: TypeFlags.Object };

      case NodeKind.IndexedAccessType:
        return unknownType;

      case NodeKind.TypeQuery:
        return unknownType;

      case NodeKind.InferType:
        return { flags: TypeFlags.TypeParameter };

      case NodeKind.TupleType:
        return { flags: TypeFlags.Object };

      case NodeKind.ParenthesizedType:
        return this.resolveTypeNode(node.type, scopes);

      case NodeKind.ReadonlyType:
        return this.resolveTypeNode(node.type, scopes);

      case NodeKind.UniqueType:
        return symbolType;

      case NodeKind.TemplateLiteralType:
        return stringType;

      default:
        return unknownType;
    }
  }

  /**
   * Infiere el tipo de una expresión.
   */
  checkExpression(expr: Expression, scopes: ScopeChain): TSType {
    switch (expr.kind) {
      case NodeKind.NumericLiteral:
        return numberType;
      case NodeKind.BigIntLiteral:
        return bigintType;
      case NodeKind.StringLiteral:
        return stringType;
      case NodeKind.BooleanLiteral:
        return booleanType;
      case NodeKind.NullLiteral:
        return nullType;
      case NodeKind.UndefinedLiteral:
        return undefinedType;
      case NodeKind.RegexLiteral:
        return objectType;
      case NodeKind.TemplateLiteral:
        return stringType;

      case NodeKind.Identifier: {
        const sym = scopes.resolve(expr.name);
        if (sym?.resolvedType) return sym.resolvedType;
        if (sym) {
          // Inferir tipo de la bandera
          if (sym.flags & SymbolFlags.Function) return { flags: TypeFlags.Function };
          if (sym.flags & SymbolFlags.Class) return { flags: TypeFlags.Object, symbol: sym };
          return unknownType;
        }
        return unknownType;
      }

      case NodeKind.BinaryExpression: {
        const leftType = this.checkExpression(expr.left, scopes);
        const rightType = this.checkExpression(expr.right, scopes);
        return this.checkBinaryOp(expr.operator, leftType, rightType);
      }

      case NodeKind.UnaryExpression: {
        const op = expr.operator;
        if (op === "!" || op === "delete") return booleanType;
        if (op === "typeof") return stringType;
        if (op === "void") return undefinedType;
        if (op === "++" || op === "--" || op === "+" || op === "-" || op === "~") return numberType;
        return unknownType;
      }

      case NodeKind.PostfixUnaryExpression:
        return numberType;

      case NodeKind.ConditionalExpression: {
        const t = this.checkExpression(expr.whenTrue, scopes);
        const f = this.checkExpression(expr.whenFalse, scopes);
        return getUnionType([t, f]);
      }

      case NodeKind.CallExpression:
        return unknownType; // simplificado: retorno de función no se resuelve

      case NodeKind.NewExpression:
        return objectType;

      case NodeKind.PropertyAccessExpression:
        return unknownType;

      case NodeKind.ElementAccessExpression:
        return unknownType;

      case NodeKind.ArrowFunctionExpression:
      case NodeKind.FunctionExpression:
        return { flags: TypeFlags.Function };

      case NodeKind.ObjectLiteralExpression:
        return { flags: TypeFlags.Object };

      case NodeKind.ArrayLiteralExpression:
        return { flags: TypeFlags.Object };

      case NodeKind.AsExpression:
        return this.resolveTypeNode(expr.type, scopes);

      case NodeKind.SatisfiesExpression:
        return this.checkExpression(expr.expression, scopes);

      case NodeKind.NonNullExpression:
        return this.checkExpression(expr.expression, scopes);

      case NodeKind.TypeAssertionExpression:
        return this.resolveTypeNode(expr.type, scopes);

      case NodeKind.AwaitExpression:
        return unknownType;

      case NodeKind.YieldExpression:
        return unknownType;

      case NodeKind.ParenthesizedExpression:
        return this.checkExpression(expr.expression, scopes);

      case NodeKind.TypeofExpression:
        return stringType;

      case NodeKind.VoidExpression:
        return undefinedType;

      case NodeKind.DeleteExpression:
        return booleanType;

      case NodeKind.TaggedTemplateExpression:
        return unknownType;

      default:
        return unknownType;
    }
  }

  private checkBinaryOp(op: string, left: TSType, right: TSType): TSType {
    switch (op) {
      case "+":
        if ((left.flags & TypeFlags.String) || (right.flags & TypeFlags.String)) return stringType;
        return numberType;
      case "-": case "*": case "/": case "%":
      case "**": case "&": case "|": case "^":
      case "<<": case ">>": case ">>>":
        return numberType;
      case "==": case "!=": case "===": case "!==":
      case "<": case ">": case "<=": case ">=":
      case "instanceof": case "in":
        return booleanType;
      case "&&": case "||":
        return getUnionType([left, right]);
      case "??":
        return getUnionType([left, right]);
      default:
        return unknownType;
    }
  }

  /**
   * Verifica si el tipo `source` es asignable a `target`.
   */
  isAssignableTo(source: TSType, target: TSType): boolean {
    // any y unknown aceptan todo
    if (target.flags & TypeFlags.Any) return true;
    if (source.flags & TypeFlags.Any) return true;
    if (target.flags & TypeFlags.Unknown) return true;

    // never no es asignable a nada (excepto never)
    if (source.flags & TypeFlags.Never) return true;
    if (target.flags & TypeFlags.Never) return false;

    // Mismos flags primitivos → asignable
    if (source.flags === target.flags) return true;

    // Literal → widened type
    if (source.flags & TypeFlags.Literal) {
      const val = source.literalValue;
      if (typeof val === "string" && target.flags & TypeFlags.String) return true;
      if (typeof val === "number" && target.flags & TypeFlags.Number) return true;
      if (typeof val === "boolean" && target.flags & TypeFlags.Boolean) return true;
      if (val === null && target.flags & TypeFlags.Null) return true;
    }

    // Union target: source asignable a al menos uno
    if (target.flags & TypeFlags.Union) {
      return target.types?.some(t => this.isAssignableTo(source, t)) ?? false;
    }

    // Union source: todos asignables al target
    if (source.flags & TypeFlags.Union) {
      return source.types?.every(t => this.isAssignableTo(t, target)) ?? false;
    }

    // Mismo símbolo (misma clase/interfaz)
    if (source.symbol && target.symbol && source.symbol === target.symbol) return true;

    // void ↔ undefined en contextos de retorno
    if ((source.flags & TypeFlags.Void) && (target.flags & TypeFlags.Void)) return true;

    return false;
  }

  /** Widening: 42 → number, "hi" → string */
  widenType(t: TSType): TSType {
    if (!(t.flags & TypeFlags.Literal)) return t;
    const val = t.literalValue;
    if (typeof val === "string") return stringType;
    if (typeof val === "number") return numberType;
    if (typeof val === "boolean") return booleanType;
    return t;
  }
}
