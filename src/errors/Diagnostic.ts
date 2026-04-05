export const enum DiagnosticSeverity {
  Error,
  Warning,
  Info,
}

export const enum DiagnosticCategory {
  Lexer,
  Parser,
  Semantic,
}

export interface DiagnosticMessage {
  readonly code: number;
  readonly category: DiagnosticCategory;
  readonly message: string; // plantilla con {0}, {1}, etc.
}

export interface Position {
  readonly line: number;   // 1-based
  readonly column: number; // 0-based
  readonly offset: number; // byte offset desde el inicio del source
}

export interface Span {
  readonly start: Position;
  readonly end: Position;
}

export interface RelatedInformation {
  readonly message: string;
  readonly span: Span;
  readonly fileName: string;
}

export interface Diagnostic {
  readonly message: DiagnosticMessage;
  readonly args: ReadonlyArray<string>;
  readonly severity: DiagnosticSeverity;
  readonly span: Span;
  readonly fileName: string;
  readonly relatedInformation?: ReadonlyArray<RelatedInformation>;
}

// Catálogo de todos los mensajes de diagnóstico
// 1xxx = Léxico, 2xxx = Sintáctico, 3xxx = Semántico
export const Diagnostics = {
  // --- Léxico (1xxx) ---
  UnexpectedCharacter: {
    code: 1001,
    category: DiagnosticCategory.Lexer,
    message: "Carácter inesperado '{0}'",
  },
  UnterminatedStringLiteral: {
    code: 1002,
    category: DiagnosticCategory.Lexer,
    message: "Literal de cadena no terminado",
  },
  UnterminatedTemplateLiteral: {
    code: 1003,
    category: DiagnosticCategory.Lexer,
    message: "Literal de plantilla no terminado",
  },
  UnterminatedMultiLineComment: {
    code: 1004,
    category: DiagnosticCategory.Lexer,
    message: "Comentario multilínea no terminado",
  },
  InvalidEscapeSequence: {
    code: 1005,
    category: DiagnosticCategory.Lexer,
    message: "Secuencia de escape inválida '\\{0}'",
  },
  InvalidNumericLiteral: {
    code: 1006,
    category: DiagnosticCategory.Lexer,
    message: "Literal numérico inválido",
  },
  InvalidBinaryLiteral: {
    code: 1007,
    category: DiagnosticCategory.Lexer,
    message: "Dígito inválido en literal binario",
  },
  InvalidOctalLiteral: {
    code: 1008,
    category: DiagnosticCategory.Lexer,
    message: "Dígito inválido en literal octal",
  },

  // --- Sintáctico (2xxx) ---
  Expected: {
    code: 2001,
    category: DiagnosticCategory.Parser,
    message: "Se esperaba '{0}'",
  },
  UnexpectedToken: {
    code: 2002,
    category: DiagnosticCategory.Parser,
    message: "Token inesperado '{0}'",
  },
  ExpressionExpected: {
    code: 2003,
    category: DiagnosticCategory.Parser,
    message: "Se esperaba una expresión",
  },
  DeclarationExpected: {
    code: 2004,
    category: DiagnosticCategory.Parser,
    message: "Se esperaba una declaración o sentencia",
  },
  IdentifierExpected: {
    code: 2005,
    category: DiagnosticCategory.Parser,
    message: "Se esperaba un identificador",
  },
  SemicolonExpected: {
    code: 2006,
    category: DiagnosticCategory.Parser,
    message: "Se esperaba ';'",
  },
  CommaExpected: {
    code: 2007,
    category: DiagnosticCategory.Parser,
    message: "Se esperaba ','",
  },
  OpenBraceExpected: {
    code: 2008,
    category: DiagnosticCategory.Parser,
    message: "Se esperaba '{'",
  },
  CloseBraceExpected: {
    code: 2009,
    category: DiagnosticCategory.Parser,
    message: "Se esperaba '}'",
  },
  OpenParenExpected: {
    code: 2010,
    category: DiagnosticCategory.Parser,
    message: "Se esperaba '('",
  },
  CloseParenExpected: {
    code: 2011,
    category: DiagnosticCategory.Parser,
    message: "Se esperaba ')'",
  },
  CloseBracketExpected: {
    code: 2012,
    category: DiagnosticCategory.Parser,
    message: "Se esperaba ']'",
  },
  ArrowExpected: {
    code: 2013,
    category: DiagnosticCategory.Parser,
    message: "Se esperaba '=>'",
  },

  // --- Semántico (3xxx) ---
  CannotFindName: {
    code: 3001,
    category: DiagnosticCategory.Semantic,
    message: "No se puede encontrar el nombre '{0}'",
  },
  DuplicateIdentifier: {
    code: 3002,
    category: DiagnosticCategory.Semantic,
    message: "Identificador duplicado '{0}'",
  },
  NotAssignable: {
    code: 3003,
    category: DiagnosticCategory.Semantic,
    message: "El tipo '{0}' no es asignable al tipo '{1}'",
  },
  PropertyIsPrivate: {
    code: 3004,
    category: DiagnosticCategory.Semantic,
    message: "La propiedad '{0}' es privada y solo es accesible dentro de la clase '{1}'",
  },
  NotAllPathsReturn: {
    code: 3005,
    category: DiagnosticCategory.Semantic,
    message: "No todas las rutas de código retornan un valor",
  },
  InterfaceNotImplemented: {
    code: 3006,
    category: DiagnosticCategory.Semantic,
    message: "La clase '{0}' no implementa correctamente la interfaz '{1}': falta '{2}'",
  },
  ConstReassignment: {
    code: 3007,
    category: DiagnosticCategory.Semantic,
    message: "No se puede asignar a '{0}' porque es una constante",
  },
  AbstractInstantiation: {
    code: 3008,
    category: DiagnosticCategory.Semantic,
    message: "No se puede crear una instancia de la clase abstracta '{0}'",
  },
  ArgumentCountMismatch: {
    code: 3009,
    category: DiagnosticCategory.Semantic,
    message: "Se esperaban {0} argumentos, pero se recibieron {1}",
  },
  UseBeforeDeclaration: {
    code: 3010,
    category: DiagnosticCategory.Semantic,
    message: "La variable '{0}' se usa antes de su declaración",
  },
} as const;

export type DiagnosticCode = (typeof Diagnostics)[keyof typeof Diagnostics];

/** Aplica argumentos a una plantilla de mensaje */
export function formatMessage(msg: DiagnosticMessage, args: ReadonlyArray<string>): string {
  return msg.message.replace(/\{(\d+)\}/g, (_, i) => args[Number(i)] ?? `{${i}}`);
}
