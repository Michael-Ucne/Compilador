/**
 * Todos los tipos de token del lenguaje TypeScript.
 * El orden dentro de los rangos de keywords y operadores es importante:
 * permite comparaciones de rango eficientes (>= FirstKeyword && <= LastKeyword).
 */
export const enum TokenType {
  // ── Especiales ──────────────────────────────────────────────────────────────
  Unknown,
  EOF,

  // ── Trivia (preservados en el token pero ignorados por el parser) ───────────
  Whitespace,
  NewLine,
  SingleLineComment,
  MultiLineComment,
  JSDocComment,

  // ── Literales ───────────────────────────────────────────────────────────────
  NumericLiteral,         // 0, 123, 1_000, 0xFF, 0o17, 0b1010, 1.5e-3
  BigIntLiteral,          // 42n
  StringLiteral,          // "hello", 'world'
  NoSubstitutionTemplate, // `sin interpolación`
  TemplateHead,           // `inicio ${
  TemplateMiddle,         // } medio ${
  TemplateTail,           // } fin`
  RegexLiteral,           // /pattern/flags
  TrueKeyword,            // true  (tratados como literales en el AST)
  FalseKeyword,           // false
  NullKeyword,            // null

  // ── Identificadores ─────────────────────────────────────────────────────────
  Identifier,

  // ── Puntuación ──────────────────────────────────────────────────────────────
  OpenParen,        // (
  CloseParen,       // )
  OpenBracket,      // [
  CloseBracket,     // ]
  OpenBrace,        // {
  CloseBrace,       // }
  Semicolon,        // ;
  Comma,            // ,
  Dot,              // .
  DotDotDot,        // ...
  At,               // @
  Hash,             // # (private class fields)

  // ── Operadores (orden max-munch: más largos primero) ─────────────────────────
  // Flecha y opcionales
  EqualsGreaterThan,         // =>
  QuestionDot,               // ?.
  QuestionQuestion,          // ??
  QuestionQuestionEquals,    // ??=
  Question,                  // ?

  // Colon
  Colon,                     // :

  // Asignación compuesta con &&/||
  AmpersandAmpersandEquals,  // &&=
  BarBarEquals,               // ||=

  // Igualdad
  EqualsEqualsEquals,        // ===
  ExclamationEqualsEquals,   // !==
  EqualsEquals,              // ==
  ExclamationEquals,         // !=

  // Asignación
  PlusEquals,                // +=
  MinusEquals,               // -=
  AsteriskAsteriskEquals,    // **=
  AsteriskEquals,            // *=
  SlashEquals,               // /=
  PercentEquals,             // %=
  LessThanLessThanEquals,    // <<=
  GreaterThanGreaterThanGreaterThanEquals, // >>>=
  GreaterThanGreaterThanEquals,           // >>=
  AmpersandEquals,           // &=
  BarEquals,                 // |=
  CaretEquals,               // ^=
  Equals,                    // =

  // Incremento/decremento
  PlusPlus,                  // ++
  MinusMinus,                // --

  // Aritméticos
  AsteriskAsterisk,          // **
  Asterisk,                  // *
  Plus,                      // +
  Minus,                     // -
  Slash,                     // /
  Percent,                   // %

  // Bit shift
  LessThanLessThan,          // <<
  GreaterThanGreaterThanGreaterThan, // >>>
  GreaterThanGreaterThan,    // >>

  // Comparación
  LessThanEquals,            // <=
  GreaterThanEquals,         // >=
  LessThan,                  // <
  GreaterThan,               // >

  // Lógicos
  AmpersandAmpersand,        // &&
  BarBar,                    // ||
  Exclamation,               // !

  // Bit a bit
  Ampersand,                 // &
  Bar,                       // |
  Caret,                     // ^
  Tilde,                     // ~

  // ── Palabras clave ───────────────────────────────────────────────────────────
  FirstKeyword,

  // Tipos primitivos
  AnyKeyword = FirstKeyword,
  NumberKeyword,
  BigintKeyword,
  BooleanKeyword,
  StringKeyword,
  SymbolKeyword,
  VoidKeyword,
  ObjectKeyword,
  NeverKeyword,
  UnknownKeyword,
  UndefinedKeyword,

  // Declaraciones
  TypeKeyword,
  InterfaceKeyword,
  ClassKeyword,
  EnumKeyword,
  FunctionKeyword,
  NamespaceKeyword,
  ModuleKeyword,
  DeclareKeyword,
  AbstractKeyword,

  // Módulos
  ExportKeyword,
  ImportKeyword,
  FromKeyword,
  AsKeyword,
  RequireKeyword,

  // Variables
  ConstKeyword,
  LetKeyword,
  VarKeyword,

  // Control de flujo
  IfKeyword,
  ElseKeyword,
  SwitchKeyword,
  CaseKeyword,
  DefaultKeyword,
  ForKeyword,
  WhileKeyword,
  DoKeyword,
  BreakKeyword,
  ContinueKeyword,
  ReturnKeyword,
  TryKeyword,
  CatchKeyword,
  FinallyKeyword,
  ThrowKeyword,

  // Modificadores
  PublicKeyword,
  PrivateKeyword,
  ProtectedKeyword,
  StaticKeyword,
  ReadonlyKeyword,
  OverrideKeyword,

  // Accesores
  GetKeyword,
  SetKeyword,

  // Async/Await
  AsyncKeyword,
  AwaitKeyword,

  // Operadores de tipo
  TypeofKeyword,
  KeyofKeyword,
  InstanceofKeyword,
  InKeyword,
  IsKeyword,

  // Clases y herencia
  ExtendsKeyword,
  ImplementsKeyword,
  NewKeyword,
  ThisKeyword,
  SuperKeyword,
  OfKeyword,

  // Nuevos en TS 4.x / 5.x
  SatisfiesKeyword,
  UsingKeyword,
  InferKeyword,
  AssertKeyword,
  AccessorKeyword,

  // Otros
  YieldKeyword,
  DeleteKeyword,
  VoidKeywordOp,  // void como operador unario (mismo string que VoidKeyword)
  InKeywordOp,    // in como operador (mismo string que InKeyword, contexto parser)
  WithKeyword,
  DebuggeryKeyword,

  LastKeyword = DebuggeryKeyword,
}

/** Verifica si un TokenType es una palabra clave */
export function isKeyword(t: TokenType): boolean {
  return t >= TokenType.FirstKeyword && t <= TokenType.LastKeyword;
}

/** Verifica si un TokenType es un modificador de acceso */
export function isAccessModifier(t: TokenType): boolean {
  return (
    t === TokenType.PublicKeyword ||
    t === TokenType.PrivateKeyword ||
    t === TokenType.ProtectedKeyword
  );
}

/** Verifica si es un modificador de declaración válido */
export function isModifier(t: TokenType): boolean {
  switch (t) {
    case TokenType.PublicKeyword:
    case TokenType.PrivateKeyword:
    case TokenType.ProtectedKeyword:
    case TokenType.StaticKeyword:
    case TokenType.ReadonlyKeyword:
    case TokenType.AbstractKeyword:
    case TokenType.OverrideKeyword:
    case TokenType.AsyncKeyword:
    case TokenType.DeclareKeyword:
    case TokenType.ExportKeyword:
      return true;
    default:
      return false;
  }
}
