import { TokenType } from "./TokenType.ts";

/**
 * Mapa de texto → TokenType para todas las palabras clave de TypeScript.
 * true, false, null están incluidos aquí aunque se clasifican como literales.
 */
export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map([
  // Literales especiales
  ["true", TokenType.TrueKeyword],
  ["false", TokenType.FalseKeyword],
  ["null", TokenType.NullKeyword],

  // Tipos primitivos
  ["any", TokenType.AnyKeyword],
  ["number", TokenType.NumberKeyword],
  ["bigint", TokenType.BigintKeyword],
  ["boolean", TokenType.BooleanKeyword],
  ["string", TokenType.StringKeyword],
  ["symbol", TokenType.SymbolKeyword],
  ["void", TokenType.VoidKeyword],
  ["object", TokenType.ObjectKeyword],
  ["never", TokenType.NeverKeyword],
  ["unknown", TokenType.UnknownKeyword],
  ["undefined", TokenType.UndefinedKeyword],

  // Declaraciones
  ["type", TokenType.TypeKeyword],
  ["interface", TokenType.InterfaceKeyword],
  ["class", TokenType.ClassKeyword],
  ["enum", TokenType.EnumKeyword],
  ["function", TokenType.FunctionKeyword],
  ["namespace", TokenType.NamespaceKeyword],
  ["module", TokenType.ModuleKeyword],
  ["declare", TokenType.DeclareKeyword],
  ["abstract", TokenType.AbstractKeyword],

  // Módulos
  ["export", TokenType.ExportKeyword],
  ["import", TokenType.ImportKeyword],
  ["from", TokenType.FromKeyword],
  ["as", TokenType.AsKeyword],
  ["require", TokenType.RequireKeyword],

  // Variables
  ["const", TokenType.ConstKeyword],
  ["let", TokenType.LetKeyword],
  ["var", TokenType.VarKeyword],

  // Control de flujo
  ["if", TokenType.IfKeyword],
  ["else", TokenType.ElseKeyword],
  ["switch", TokenType.SwitchKeyword],
  ["case", TokenType.CaseKeyword],
  ["default", TokenType.DefaultKeyword],
  ["for", TokenType.ForKeyword],
  ["while", TokenType.WhileKeyword],
  ["do", TokenType.DoKeyword],
  ["break", TokenType.BreakKeyword],
  ["continue", TokenType.ContinueKeyword],
  ["return", TokenType.ReturnKeyword],
  ["try", TokenType.TryKeyword],
  ["catch", TokenType.CatchKeyword],
  ["finally", TokenType.FinallyKeyword],
  ["throw", TokenType.ThrowKeyword],

  // Modificadores
  ["public", TokenType.PublicKeyword],
  ["private", TokenType.PrivateKeyword],
  ["protected", TokenType.ProtectedKeyword],
  ["static", TokenType.StaticKeyword],
  ["readonly", TokenType.ReadonlyKeyword],
  ["override", TokenType.OverrideKeyword],

  // Accesores
  ["get", TokenType.GetKeyword],
  ["set", TokenType.SetKeyword],

  // Async/Await/Generator
  ["async", TokenType.AsyncKeyword],
  ["await", TokenType.AwaitKeyword],
  ["yield", TokenType.YieldKeyword],

  // Operadores de tipo/valor
  ["typeof", TokenType.TypeofKeyword],
  ["keyof", TokenType.KeyofKeyword],
  ["instanceof", TokenType.InstanceofKeyword],
  ["in", TokenType.InKeyword],
  ["is", TokenType.IsKeyword],
  ["infer", TokenType.InferKeyword],

  // Clases y herencia
  ["extends", TokenType.ExtendsKeyword],
  ["implements", TokenType.ImplementsKeyword],
  ["new", TokenType.NewKeyword],
  ["this", TokenType.ThisKeyword],
  ["super", TokenType.SuperKeyword],
  ["of", TokenType.OfKeyword],

  // Nuevos TS 4.x / 5.x
  ["satisfies", TokenType.SatisfiesKeyword],
  ["using", TokenType.UsingKeyword],
  ["assert", TokenType.AssertKeyword],
  ["accessor", TokenType.AccessorKeyword],

  // Otros
  ["delete", TokenType.DeleteKeyword],
  ["with", TokenType.WithKeyword],
  ["debugger", TokenType.DebuggeryKeyword],
]);
