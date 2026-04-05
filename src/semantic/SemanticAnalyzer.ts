import { NodeKind } from "../ast/Node.ts";
import type { Node } from "../ast/Node.ts";
import type { SourceFile } from "../ast/Declarations.ts";
import type { Statement } from "../ast/Statements.ts";
import type { Expression, Identifier } from "../ast/Expressions.ts";
import type { Declaration } from "../ast/Declarations.ts";
import type {
  FunctionDeclaration, ClassDeclaration, InterfaceDeclaration,
  EnumDeclaration, TypeAliasDeclaration, VariableStatement, VariableDeclaration,
  Parameter, MethodDeclaration, PropertyDeclaration,
} from "../ast/Declarations.ts";
import { ScopeChain, ScopeKind } from "./Scope.ts";
import {
  SymbolFlags, SymbolModifierFlags,
  type TSType, type TSSymbol,
  anyType, stringType, numberType, booleanType, voidType, undefinedType, nullType,
  typeToString, getUnionType,
} from "./Symbol.ts";
import { TypeChecker } from "./TypeChecker.ts";
import { DiagnosticBag } from "../errors/DiagnosticBag.ts";
import { Diagnostics } from "../errors/Diagnostic.ts";
import type { Span } from "../errors/Diagnostic.ts";

/** Convierte un offset de source a Span sintético para diagnósticos */
function syntheticSpan(start: number, end: number, source: string): Span {
  const text = source.slice(0, start);
  const lines = text.split("\n");
  const line = lines.length;
  const column = (lines[lines.length - 1] ?? "").length;
  const endText = source.slice(0, end);
  const endLines = endText.split("\n");
  const endLine = endLines.length;
  const endCol = (endLines[endLines.length - 1] ?? "").length;
  return {
    start: { line, column, offset: start },
    end: { line: endLine, column: endCol, offset: end },
  };
}

export class SemanticAnalyzer {
  private readonly scopes: ScopeChain;
  private readonly checker: TypeChecker;
  private readonly diagnostics: DiagnosticBag;
  private source: string = "";
  private fileName: string = "<source>";

  constructor(diagnostics: DiagnosticBag) {
    this.scopes = new ScopeChain();
    this.checker = new TypeChecker();
    this.diagnostics = diagnostics;
  }

  analyze(sourceFile: SourceFile, source?: string): void {
    this.source = source ?? "";
    this.fileName = sourceFile.fileName;

    // Pasada 1: Binding (registro de declaraciones)
    this.bindStatements(sourceFile.statements);

    // Pasada 2: Checking (verificación semántica)
    this.checkStatements(sourceFile.statements);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PASADA 1: BINDING
  // ────────────────────────────────────────────────────────────────────────────

  private bindStatements(stmts: ReadonlyArray<Statement>): void {
    for (const stmt of stmts) {
      this.bindStatement(stmt);
    }
  }

  private bindStatement(node: Statement): void {
    switch (node.kind) {
      case NodeKind.FunctionDeclaration:
        this.bindFunctionDeclaration(node as FunctionDeclaration);
        break;
      case NodeKind.ClassDeclaration:
        this.bindClassDeclaration(node as ClassDeclaration);
        break;
      case NodeKind.InterfaceDeclaration:
        this.bindInterfaceDeclaration(node as InterfaceDeclaration);
        break;
      case NodeKind.EnumDeclaration:
        this.bindEnumDeclaration(node as EnumDeclaration);
        break;
      case NodeKind.TypeAliasDeclaration:
        this.bindTypeAliasDeclaration(node as TypeAliasDeclaration);
        break;
      case NodeKind.VariableStatement:
        this.bindVariableStatement(node as VariableStatement);
        break;
      case NodeKind.Block:
        // Los bloques no se pre-registran aquí; se procesan en check
        break;
    }
  }

  private bindFunctionDeclaration(node: FunctionDeclaration): void {
    if (!node.name) return;
    const existing = this.scopes.declare(node.name.name, SymbolFlags.Function, node);
    if (existing) {
      // Función con mismo nombre → posiblemente sobrecarga (válido en TS)
      // Solo marcamos error si ambas tienen cuerpo
      if (existing.declarations.filter(d => (d as FunctionDeclaration).body).length > 1) {
        this.reportDuplicate(node.name.name, node);
      }
    }
  }

  private bindClassDeclaration(node: ClassDeclaration): void {
    if (!node.name) return;
    const existing = this.scopes.declare(node.name.name, SymbolFlags.Class, node);
    if (existing) this.reportDuplicate(node.name.name, node);
  }

  private bindInterfaceDeclaration(node: InterfaceDeclaration): void {
    // Las interfaces se pueden declarar múltiples veces (declaration merging)
    const sym = this.scopes.resolveLocal(node.name.name);
    if (!sym) {
      this.scopes.declare(node.name.name, SymbolFlags.Interface, node);
    } else {
      sym.declarations.push(node);
    }
  }

  private bindEnumDeclaration(node: EnumDeclaration): void {
    const existing = this.scopes.declare(node.name.name, SymbolFlags.Enum, node);
    if (existing && !(existing.flags & SymbolFlags.Enum)) {
      this.reportDuplicate(node.name.name, node);
    }
  }

  private bindTypeAliasDeclaration(node: TypeAliasDeclaration): void {
    const existing = this.scopes.declare(node.name.name, SymbolFlags.TypeAlias, node);
    if (existing) this.reportDuplicate(node.name.name, node);
  }

  private bindVariableStatement(node: VariableStatement): void {
    for (const decl of node.declarations) {
      this.bindBindingName(decl.name, node.declarationKind, decl);
    }
  }

  private bindBindingName(name: import("../ast/Declarations.ts").BindingName, kind: "const" | "let" | "var", decl: Node): void {
    if (name.kind === NodeKind.Identifier) {
      const existing = this.scopes.declare(name.name, SymbolFlags.Variable, decl);
      if (existing) {
        // var re-declaration es válido en el mismo scope en JS (no en TS strict)
        if (kind !== "var") {
          this.reportDuplicate(name.name, decl);
        }
      } else {
        const sym = this.scopes.resolveLocal(name.name);
        if (sym) {
          if (kind === "const") {
            sym.modifierFlags = sym.modifierFlags | SymbolModifierFlags.Readonly;
          }
        }
      }
    } else if (name.kind === NodeKind.ObjectBindingPattern) {
      for (const elem of name.elements) {
        this.bindBindingName(elem.name, kind, decl);
      }
    } else if (name.kind === NodeKind.ArrayBindingPattern) {
      for (const elem of name.elements) {
        if (elem) this.bindBindingName(elem.name, kind, decl);
      }
    }
  }

  private reportDuplicate(name: string, node: Node): void {
    const span = syntheticSpan(node.start, node.end, this.source || "x".repeat(node.end + 1));
    this.diagnostics.add(Diagnostics.DuplicateIdentifier, span, this.fileName, name);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PASADA 2: CHECKING
  // ────────────────────────────────────────────────────────────────────────────

  private checkStatements(stmts: ReadonlyArray<Statement>): void {
    for (const stmt of stmts) {
      this.checkStatement(stmt);
    }
  }

  private checkStatement(node: Statement): void {
    switch (node.kind) {
      case NodeKind.ExpressionStatement:
        this.checker.checkExpression(node.expression, this.scopes);
        this.checkExpressionForErrors(node.expression);
        break;
      case NodeKind.VariableStatement:
        this.checkVariableStatement(node as VariableStatement);
        break;
      case NodeKind.FunctionDeclaration:
        this.checkFunctionDeclaration(node as FunctionDeclaration);
        break;
      case NodeKind.ClassDeclaration:
        this.checkClassDeclaration(node as ClassDeclaration);
        break;
      case NodeKind.InterfaceDeclaration:
        // Las interfaces son solo tipos; no hay mucho que chequear en el body
        break;
      case NodeKind.EnumDeclaration:
        this.checkEnumDeclaration(node as EnumDeclaration);
        break;
      case NodeKind.TypeAliasDeclaration:
        break;
      case NodeKind.Block:
        this.scopes.enter(ScopeKind.Block, node);
        this.checkStatements(node.statements);
        this.scopes.exit();
        break;
      case NodeKind.IfStatement:
        this.checkExpressionForErrors(node.condition);
        this.checkStatement(node.thenBranch);
        if (node.elseBranch) this.checkStatement(node.elseBranch);
        break;
      case NodeKind.WhileStatement:
        this.checkExpressionForErrors(node.condition);
        this.checkStatement(node.body);
        break;
      case NodeKind.DoStatement:
        this.checkStatement(node.body);
        this.checkExpressionForErrors(node.condition);
        break;
      case NodeKind.ForStatement:
        this.scopes.enter(ScopeKind.Block, node);
        if (node.init?.kind === NodeKind.VariableStatement) {
          this.bindVariableStatement(node.init as VariableStatement);
          this.checkVariableStatement(node.init as VariableStatement);
        } else if (node.init) this.checkExpressionForErrors(node.init as Expression);
        if (node.condition) this.checkExpressionForErrors(node.condition);
        if (node.update) this.checkExpressionForErrors(node.update);
        this.checkStatement(node.body);
        this.scopes.exit();
        break;
      case NodeKind.ForInStatement:
      case NodeKind.ForOfStatement:
        this.checkStatement(node.body);
        break;
      case NodeKind.ReturnStatement:
        this.checkReturnStatement(node);
        break;
      case NodeKind.ThrowStatement:
        this.checkExpressionForErrors(node.expression);
        break;
      case NodeKind.TryStatement:
        this.checkStatements(node.tryBlock.statements);
        if (node.catchClause) {
          this.scopes.enter(ScopeKind.Block, node.catchClause);
          if (node.catchClause.binding?.kind === NodeKind.Identifier) {
            this.scopes.declare(node.catchClause.binding.name, SymbolFlags.Variable, node.catchClause);
          }
          this.checkStatements(node.catchClause.body.statements);
          this.scopes.exit();
        }
        if (node.finallyBlock) this.checkStatements(node.finallyBlock.statements);
        break;
      case NodeKind.SwitchStatement:
        this.checkExpressionForErrors(node.expression);
        for (const clause of node.cases) {
          if (clause.kind === NodeKind.CaseClause) this.checkExpressionForErrors(clause.expression);
          this.checkStatements(clause.statements);
        }
        break;
      case NodeKind.ImportDeclaration:
      case NodeKind.ExportDeclaration:
      case NodeKind.ExportAssignment:
      case NodeKind.ModuleDeclaration:
        // Import/export checking: simplificado
        break;
    }
  }

  private checkExpressionForErrors(expr: Expression): void {
    switch (expr.kind) {
      case NodeKind.Identifier:
        this.checkIdentifier(expr);
        break;
      case NodeKind.BinaryExpression:
        this.checkBinaryExpressionForErrors(expr);
        break;
      case NodeKind.CallExpression:
        this.checkExpressionForErrors(expr.callee);
        for (const arg of expr.args) this.checkExpressionForErrors(arg);
        this.checkCallArguments(expr);
        break;
      case NodeKind.NewExpression:
        this.checkNewExpression(expr);
        break;
      case NodeKind.PropertyAccessExpression:
        this.checkExpressionForErrors(expr.object);
        this.checkPropertyAccess(expr);
        break;
      case NodeKind.ElementAccessExpression:
        this.checkExpressionForErrors(expr.object);
        this.checkExpressionForErrors(expr.index);
        break;
      case NodeKind.ConditionalExpression:
        this.checkExpressionForErrors(expr.condition);
        this.checkExpressionForErrors(expr.whenTrue);
        this.checkExpressionForErrors(expr.whenFalse);
        break;
      case NodeKind.ArrowFunctionExpression:
      case NodeKind.FunctionExpression:
        this.checkFunctionBody(expr);
        break;
      case NodeKind.AwaitExpression:
      case NodeKind.UnaryExpression:
      case NodeKind.PostfixUnaryExpression:
      case NodeKind.TypeofExpression:
      case NodeKind.VoidExpression:
      case NodeKind.DeleteExpression:
        if ("expression" in expr) this.checkExpressionForErrors((expr as any).expression);
        if ("operand" in expr) this.checkExpressionForErrors((expr as any).operand);
        break;
      case NodeKind.ObjectLiteralExpression:
        for (const prop of expr.properties) {
          if ("initializer" in prop && prop.initializer) this.checkExpressionForErrors(prop.initializer);
        }
        break;
      case NodeKind.ArrayLiteralExpression:
        for (const el of expr.elements) {
          if (el) this.checkExpressionForErrors(el as Expression);
        }
        break;
      case NodeKind.ParenthesizedExpression:
        this.checkExpressionForErrors(expr.expression);
        break;
      case NodeKind.AsExpression:
      case NodeKind.SatisfiesExpression:
        this.checkExpressionForErrors(expr.expression);
        break;
      case NodeKind.NonNullExpression:
        this.checkExpressionForErrors(expr.expression);
        break;
    }
  }

  private checkIdentifier(node: Identifier): void {
    if (node.name === "this" || node.name === "super" || node.name === "") return;
    const sym = this.scopes.resolve(node.name);
    if (!sym) {
      const span = syntheticSpan(node.start, node.end, this.source || "x".repeat(node.end + 1));
      this.diagnostics.add(Diagnostics.CannotFindName, span, this.fileName, node.name);
    }
  }

  private checkBinaryExpressionForErrors(expr: import("../ast/Expressions.ts").BinaryExpression): void {
    this.checkExpressionForErrors(expr.left);
    this.checkExpressionForErrors(expr.right);

    // Detectar reasignación de const
    const assignOps = new Set(["=", "+=", "-=", "*=", "/=", "%=", "**=", "&&=", "||=", "??="]);
    if (assignOps.has(expr.operator) && expr.left.kind === NodeKind.Identifier) {
      const sym = this.scopes.resolve(expr.left.name);
      if (sym && sym.modifierFlags & SymbolModifierFlags.Readonly) {
        const span = syntheticSpan(expr.left.start, expr.left.end, this.source || "x".repeat(expr.end + 1));
        this.diagnostics.add(Diagnostics.ConstReassignment, span, this.fileName, expr.left.name);
      }
    }
  }

  private checkPropertyAccess(expr: import("../ast/Expressions.ts").PropertyAccessExpression): void {
    // Verificar acceso a miembro privado (solo si el objeto es un identifier de clase)
    if (expr.object.kind === NodeKind.Identifier) {
      const sym = this.scopes.resolve(expr.object.name);
      if (sym?.members) {
        const member = sym.members.get(expr.property.name);
        if (member && member.modifierFlags & SymbolModifierFlags.Private) {
          // Verificar si estamos dentro de la clase
          const classScope = this.scopes.enclosingClass();
          if (!classScope || classScope.node !== sym.valueDeclaration) {
            const span = syntheticSpan(expr.property.start, expr.property.end, this.source || "x".repeat(expr.end + 1));
            this.diagnostics.add(Diagnostics.PropertyIsPrivate, span, this.fileName, expr.property.name, expr.object.name);
          }
        }
      }
    }
  }

  private checkNewExpression(expr: import("../ast/Expressions.ts").NewExpression): void {
    if (expr.callee.kind === NodeKind.Identifier) {
      const sym = this.scopes.resolve(expr.callee.name);
      if (sym && sym.modifierFlags & SymbolModifierFlags.Abstract) {
        const span = syntheticSpan(expr.start, expr.end, this.source || "x".repeat(expr.end + 1));
        this.diagnostics.add(Diagnostics.AbstractInstantiation, span, this.fileName, expr.callee.name);
      }
    }
    this.checkExpressionForErrors(expr.callee);
    for (const arg of (expr.args ?? [])) this.checkExpressionForErrors(arg);
  }

  private checkVariableStatement(node: VariableStatement): void {
    for (const decl of node.declarations) {
      this.checkVariableDeclaration(decl, node.declarationKind);
    }
  }

  private checkVariableDeclaration(decl: VariableDeclaration, kind: "const" | "let" | "var"): void {
    if (decl.initializer) {
      this.checkExpressionForErrors(decl.initializer);

      if (decl.type) {
        const annotatedType = this.checker.resolveTypeNode(decl.type, this.scopes);
        const initType = this.checker.checkExpression(decl.initializer, this.scopes);
        if (!this.checker.isAssignableTo(initType, annotatedType)) {
          const span = syntheticSpan(decl.initializer.start, decl.initializer.end, this.source || "x".repeat(decl.end + 1));
          this.diagnostics.add(
            Diagnostics.NotAssignable,
            span,
            this.fileName,
            typeToString(initType),
            typeToString(annotatedType),
          );
        }

        // Guardar tipo resuelto en el símbolo
        if (decl.name.kind === NodeKind.Identifier) {
          const sym = this.scopes.resolveLocal(decl.name.name) ?? this.scopes.resolve(decl.name.name);
          if (sym) sym.resolvedType = annotatedType;
        }
      } else {
        // Inferir tipo del inicializador
        const initType = this.checker.checkExpression(decl.initializer, this.scopes);
        if (decl.name.kind === NodeKind.Identifier) {
          const sym = this.scopes.resolveLocal(decl.name.name) ?? this.scopes.resolve(decl.name.name);
          if (sym) sym.resolvedType = initType;
        }
      }
    }
  }

  private checkFunctionDeclaration(node: FunctionDeclaration): void {
    this.scopes.enter(ScopeKind.Function, node);

    // Registrar parámetros en el scope de la función
    for (const param of node.parameters) {
      if (param.name.kind === NodeKind.Identifier) {
        const existing = this.scopes.declare(param.name.name, SymbolFlags.Parameter, param);
        if (existing) this.reportDuplicate(param.name.name, param);
        if (param.type) {
          const sym = this.scopes.resolveLocal(param.name.name);
          if (sym) sym.resolvedType = this.checker.resolveTypeNode(param.type, this.scopes);
        }
      }
    }

    if (node.body) {
      // Pre-registrar funciones y vars hoisted dentro del cuerpo
      this.bindStatements(node.body.statements);
      this.checkStatements(node.body.statements);

      // Verificar que todas las rutas retornan si hay tipo de retorno
      if (node.returnType) {
        const retType = this.checker.resolveTypeNode(node.returnType, this.scopes);
        const scope = this.scopes.getCurrent();
        if (!this.hasReturnInAllPaths(node.body.statements) && !this.isVoidOrUndefined(retType)) {
          const span = syntheticSpan(node.start, node.end, this.source || "x".repeat(node.end + 1));
          this.diagnostics.addWarning(Diagnostics.NotAllPathsReturn, span, this.fileName);
        }
      }
    }

    this.scopes.exit();
  }

  private checkFunctionBody(node: import("../ast/Expressions.ts").ArrowFunctionExpression | import("../ast/Expressions.ts").FunctionExpression): void {
    this.scopes.enter(ScopeKind.ArrowFunction, node);
    for (const param of node.parameters) {
      if (param.name.kind === NodeKind.Identifier) {
        this.scopes.declare(param.name.name, SymbolFlags.Parameter, param);
        if (param.type) {
          const sym = this.scopes.resolveLocal(param.name.name);
          if (sym) sym.resolvedType = this.checker.resolveTypeNode(param.type, this.scopes);
        }
      }
    }
    if ("body" in node && node.body) {
      if (node.body.kind === NodeKind.Block) {
        this.bindStatements(node.body.statements);
        this.checkStatements(node.body.statements);
      } else {
        this.checkExpressionForErrors(node.body as Expression);
      }
    }
    this.scopes.exit();
  }

  private checkReturnStatement(node: import("../ast/Statements.ts").ReturnStatement): void {
    if (node.expression) {
      this.checkExpressionForErrors(node.expression);
    }
    const fnScope = this.scopes.enclosingFunction();
    if (fnScope) {
      if (node.expression) fnScope.hasExplicitReturn = true;
      else fnScope.hasBareReturn = true;
    }
  }

  private checkClassDeclaration(node: ClassDeclaration): void {
    const classScope = this.scopes.enter(ScopeKind.Class, node);

    // Registrar miembros de la clase en su tabla de símbolos
    const sym = node.name ? this.scopes.resolve(node.name.name) : undefined;
    if (sym) sym.members = new Map();

    const isAbstract = node.modifiers?.some(m => m.kind === NodeKind.AbstractModifier);
    if (isAbstract && sym) {
      sym.modifierFlags = sym.modifierFlags | SymbolModifierFlags.Abstract;
    }

    for (const member of node.members) {
      if (member.kind === NodeKind.MethodDeclaration || member.kind === NodeKind.PropertyDeclaration) {
        const memberNode = member as MethodDeclaration | PropertyDeclaration;
        if (memberNode.name.kind === NodeKind.Identifier && sym?.members) {
          const memberSym = {
            name: memberNode.name.name,
            flags: member.kind === NodeKind.MethodDeclaration ? SymbolFlags.Method : SymbolFlags.Property,
            modifierFlags: SymbolModifierFlags.None,
            declarations: [member],
          } as TSSymbol;

          // Aplicar modificadores
          if (memberNode.modifiers) {
            for (const mod of memberNode.modifiers) {
              if (mod.kind === NodeKind.PrivateModifier) memberSym.modifierFlags |= SymbolModifierFlags.Private;
              if (mod.kind === NodeKind.ProtectedModifier) memberSym.modifierFlags |= SymbolModifierFlags.Protected;
              if (mod.kind === NodeKind.StaticModifier) memberSym.modifierFlags |= SymbolModifierFlags.Static;
              if (mod.kind === NodeKind.ReadonlyModifier) memberSym.modifierFlags |= SymbolModifierFlags.Readonly;
            }
          }
          sym.members.set(memberNode.name.name, memberSym);
        }
      }
    }

    // Verificar que se implementan todas las interfaces
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.linkKind === 1 /* Implements */) {
          for (const impl of clause.types) {
            if (impl.expression.kind === NodeKind.Identifier) {
              const ifaceSym = this.scopes.resolve(impl.expression.name);
              if (ifaceSym?.flags & SymbolFlags.Interface) {
                this.checkImplementsInterface(node, ifaceSym);
              }
            }
          }
        }
      }
    }

    // Chequear cuerpo de la clase
    for (const member of node.members) {
      if (member.kind === NodeKind.MethodDeclaration && (member as MethodDeclaration).body) {
        this.checkFunctionBody(member as any);
      }
      if (member.kind === NodeKind.PropertyDeclaration && (member as PropertyDeclaration).initializer) {
        this.checkExpressionForErrors((member as PropertyDeclaration).initializer!);
      }
    }

    this.scopes.exit();
  }

  private checkImplementsInterface(cls: ClassDeclaration, ifaceSym: TSSymbol): void {
    if (!ifaceSym.declarations.length) return;
    const ifaceDecl = ifaceSym.declarations[0] as InterfaceDeclaration;
    const className = cls.name?.name ?? "anonymous";

    for (const member of ifaceDecl.members) {
      if (member.kind === NodeKind.PropertySignature || member.kind === NodeKind.MethodSignature) {
        const memberName = member.name.kind === NodeKind.Identifier ? member.name.name : undefined;
        if (!memberName) continue;

        const classMemberSym = cls.members.find(
          m => (m.kind === NodeKind.MethodDeclaration || m.kind === NodeKind.PropertyDeclaration) &&
               (m as MethodDeclaration).name.kind === NodeKind.Identifier &&
               ((m as MethodDeclaration).name as Identifier).name === memberName
        );

        if (!classMemberSym) {
          const span = syntheticSpan(cls.start, cls.end, this.source || "x".repeat(cls.end + 1));
          this.diagnostics.add(
            Diagnostics.InterfaceNotImplemented,
            span,
            this.fileName,
            className,
            ifaceSym.name,
            memberName,
          );
        }
      }
    }
  }

  private checkCallArguments(expr: import("../ast/Expressions.ts").CallExpression): void {
    if (expr.callee.kind !== NodeKind.Identifier) return;
    const sym = this.scopes.resolve(expr.callee.name);
    if (!sym) return;
    const decl = sym.valueDeclaration;
    if (!decl) return;
    if (decl.kind !== NodeKind.FunctionDeclaration && decl.kind !== NodeKind.MethodDeclaration) return;
    const fnDecl = decl as FunctionDeclaration;
    const required = fnDecl.parameters.filter(p => !p.initializer && !p.dotDotDot && !p.optional).length;
    const hasRest = fnDecl.parameters.some(p => p.dotDotDot);
    const total = hasRest ? Infinity : fnDecl.parameters.length;
    const given = expr.args.length;
    if (given < required || given > total) {
      const span = syntheticSpan(expr.start, expr.end, this.source || "x".repeat(expr.end + 1));
      this.diagnostics.add(Diagnostics.ArgumentCountMismatch, span, this.fileName, String(required), String(given));
    }
  }

  private checkEnumDeclaration(node: EnumDeclaration): void {
    const seen = new Set<string>();
    for (const member of node.members) {
      if (member.name.kind === NodeKind.Identifier) {
        if (seen.has(member.name.name)) {
          this.reportDuplicate(member.name.name, member);
        } else {
          seen.add(member.name.name);
        }
      }
      if (member.initializer) this.checkExpressionForErrors(member.initializer);
    }
  }

  // ── Análisis de rutas de retorno (simplificado) ─────────────────────────────

  private hasReturnInAllPaths(stmts: ReadonlyArray<Statement>): boolean {
    for (let i = stmts.length - 1; i >= 0; i--) {
      const stmt = stmts[i]!;
      if (stmt.kind === NodeKind.ReturnStatement) return true;
      if (stmt.kind === NodeKind.IfStatement) {
        if (stmt.elseBranch &&
            this.stmtReturns(stmt.thenBranch) &&
            this.stmtReturns(stmt.elseBranch)) {
          return true;
        }
      }
      if (stmt.kind === NodeKind.ThrowStatement) return true;
    }
    return false;
  }

  private stmtReturns(stmt: Statement): boolean {
    if (stmt.kind === NodeKind.ReturnStatement || stmt.kind === NodeKind.ThrowStatement) return true;
    if (stmt.kind === NodeKind.Block) return this.hasReturnInAllPaths(stmt.statements);
    if (stmt.kind === NodeKind.IfStatement) {
      return !!stmt.elseBranch &&
        this.stmtReturns(stmt.thenBranch) &&
        this.stmtReturns(stmt.elseBranch);
    }
    return false;
  }

  private isVoidOrUndefined(t: TSType): boolean {
    return !!(t.flags & (0x8 | 0x10)); // Void | Undefined
  }
}
