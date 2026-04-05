export * from "./errors/index.ts";
export * from "./lexer/index.ts";
export * from "./ast/index.ts";
export * from "./parser/index.ts";
export * from "./semantic/index.ts";
export * from "./ir/index.ts";
export * from "./optimizer/index.ts";
export * from "./codegen/index.ts";

import { Lexer } from "./lexer/Lexer.ts";
import { Parser } from "./parser/Parser.ts";
import { SemanticAnalyzer } from "./semantic/SemanticAnalyzer.ts";
import { IRGenerator } from "./ir/IRGenerator.ts";
import { Optimizer } from "./optimizer/Optimizer.ts";
import { CodeGenerator, type CodeGenOptions } from "./codegen/CodeGenerator.ts";
import { DiagnosticBag } from "./errors/DiagnosticBag.ts";

export interface CompileResult {
  code: string;
  diagnostics: DiagnosticBag;
  success: boolean;
}

export interface CompileOptions extends CodeGenOptions {
  fileName?: string;
  noCheck?: boolean;
  noOptimize?: boolean;
}

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const bag = new DiagnosticBag();
  const fileName = options.fileName ?? "<input>";

  const lexer = new Lexer(source, bag);
  const parser = new Parser(lexer, bag);
  const ast = parser.parseSourceFile(fileName, source);

  if (!options.noCheck) {
    new SemanticAnalyzer(bag).analyze(ast, source);
  }

  if (bag.hasErrors()) {
    return { code: "", diagnostics: bag, success: false };
  }

  const ir = new IRGenerator().generate(ast);
  const optimized = options.noOptimize ? ir : new Optimizer().optimize(ir);
  const code = new CodeGenerator(options).generate(optimized);

  return { code, diagnostics: bag, success: true };
}
