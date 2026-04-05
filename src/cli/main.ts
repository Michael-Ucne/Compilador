#!/usr/bin/env bun
import { parseArgs } from "util";
import { Lexer } from "../lexer/Lexer.ts";
import { TokenType } from "../lexer/TokenType.ts";
import { Parser } from "../parser/Parser.ts";
import { SemanticAnalyzer } from "../semantic/SemanticAnalyzer.ts";
import { DiagnosticBag } from "../errors/DiagnosticBag.ts";
import { DiagnosticSeverity } from "../errors/Diagnostic.ts";
import { IRGenerator } from "../ir/IRGenerator.ts";
import { Optimizer } from "../optimizer/Optimizer.ts";
import { CodeGenerator } from "../codegen/CodeGenerator.ts";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    tokens:      { type: "boolean", short: "t", default: false },
    ast:         { type: "boolean", short: "a", default: false },
    ir:          { type: "boolean", short: "i", default: false },
    "no-check":  { type: "boolean", default: false },
    "no-opt":    { type: "boolean", default: false },
    emit:        { type: "boolean", short: "e", default: false },
    out:         { type: "string",  short: "o" },
    json:        { type: "boolean", short: "j", default: false },
    minify:      { type: "boolean", short: "m", default: false },
    help:        { type: "boolean", short: "h", default: false },
  },
  allowPositionals: true,
});

function printUsage(): void {
  console.log(`
compiladorts — Compilador de TypeScript a JavaScript

Uso:
  bun run src/cli/main.ts [opciones] <archivo.ts> [...]

Análisis:
  -t, --tokens     Mostrar tokens
  -a, --ast        Mostrar el AST
  -i, --ir         Mostrar el IR antes y después de optimizar
      --no-check   Omitir el análisis semántico
      --no-opt     Omitir la optimización

Emisión:
  -e, --emit       Emitir código JavaScript
  -o, --out <dir>  Directorio de salida
  -m, --minify     Minificar la salida

General:
  -j, --json       Salida en formato JSON
  -h, --help       Mostrar esta ayuda
`);
}

function formatToken(t: { type: number; value: string; span: any }): string {
  const name = TokenType[t.type] ?? `Unknown(${t.type})`;
  const { line, column } = t.span.start;
  const val = t.value.length > 40 ? t.value.slice(0, 37) + "..." : t.value;
  return `  [${String(line).padStart(4)}:${String(column).padStart(3)}]  ${name.padEnd(35)} ${JSON.stringify(val)}`;
}

function printAST(node: any, indent = 0): string {
  if (!node || typeof node !== "object") return String(node);
  const pad = "  ".repeat(indent);
  const kindName = typeof node.kind === "number" ? (kindNames[node.kind] ?? `NodeKind(${node.kind})`) : node.kind;
  const lines: string[] = [`${pad}${kindName}`];
  for (const [key, val] of Object.entries(node)) {
    if (key === "kind" || key === "parent" || key === "start" || key === "end") continue;
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      lines.push(`${pad}  .${key}:`);
      for (const item of val) {
        if (item && typeof item === "object" && "kind" in item) {
          lines.push(printAST(item, indent + 2));
        } else {
          lines.push(`${pad}    ${JSON.stringify(item)}`);
        }
      }
    } else if (val && typeof val === "object" && "kind" in val) {
      lines.push(`${pad}  .${key}:`);
      lines.push(printAST(val, indent + 2));
    } else if (val !== undefined && val !== null) {
      lines.push(`${pad}  .${key}: ${JSON.stringify(val)}`);
    }
  }
  return lines.join("\n");
}

function printIR(node: any, indent = 0): string {
  if (!node || typeof node !== "object") return String(node);
  const pad = "  ".repeat(indent);
  const kindName = typeof node.kind === "number" ? (irKindNames[node.kind] ?? `IRKind(${node.kind})`) : String(node.kind);
  const lines: string[] = [`${pad}[${kindName}]`];
  for (const [key, val] of Object.entries(node)) {
    if (key === "kind") continue;
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      lines.push(`${pad}  .${key}:`);
      for (const item of val) {
        if (item && typeof item === "object") {
          lines.push(printIR(item, indent + 2));
        } else {
          lines.push(`${pad}    ${JSON.stringify(item)}`);
        }
      }
    } else if (val && typeof val === "object") {
      lines.push(`${pad}  .${key}:`);
      lines.push(printIR(val, indent + 2));
    } else if (val !== undefined && val !== null) {
      lines.push(`${pad}  .${key}: ${JSON.stringify(val)}`);
    }
  }
  return lines.join("\n");
}

const kindNames: Record<number, string> = {};
const irKindNames: Record<number, string> = {};

(async () => {
  const { NodeKind } = await import("../ast/Node.ts");
  for (const [k, v] of Object.entries(NodeKind)) {
    if (typeof v === "number") kindNames[v] = k;
  }
  const { IRKind } = await import("../ir/IRNode.ts");
  for (const [k, v] of Object.entries(IRKind)) {
    if (typeof v === "number") irKindNames[v] = k;
  }
})();

async function main(): Promise<void> {
  if (values.help || positionals.length === 0) {
    printUsage();
    process.exit(0);
  }

  let exitCode = 0;

  for (const filePath of positionals) {
    let source: string;
    try {
      source = await Bun.file(filePath).text();
    } catch {
      console.error(`Error: No se puede leer el archivo '${filePath}'`);
      exitCode = 2;
      continue;
    }

    const bag = new DiagnosticBag();

    const lexer = new Lexer(source, bag);

    if (values.tokens) {
      const tokens = new Lexer(source, bag).tokenize().filter(t => t.type !== 1);
      if (values.json) {
        console.log(JSON.stringify(tokens, null, 2));
      } else {
        console.log(`\n=== Tokens: ${filePath} (${tokens.length}) ===`);
        for (const tok of tokens) console.log(formatToken(tok));
      }
      if (bag.hasErrors()) {
        console.error(bag.format(source));
        exitCode = 1;
      }
      continue;
    }

    const parser = new Parser(lexer, bag);
    const ast = parser.parseSourceFile(filePath, source);

    if (values.ast) {
      if (values.json) {
        console.log(JSON.stringify(ast, (_, v) => {
          if (v && typeof v === "object" && "parent" in v) {
            const { parent, ...rest } = v;
            return rest;
          }
          return v;
        }, 2));
      } else {
        console.log(`\n=== AST: ${filePath} ===`);
        console.log(printAST(ast));
      }
    }

    if (!values["no-check"]) {
      new SemanticAnalyzer(bag).analyze(ast, source);
    }

    if (bag.hasErrors()) {
      console.error(bag.format(source));
      const errors = bag.errorCount;
      console.error(`\n${filePath}: ${errors} error${errors > 1 ? "es" : ""} encontrado${errors > 1 ? "s" : ""}. Compilación abortada.`);
      exitCode = 1;
      continue;
    }

    if (!values.emit && !values.ir) {
      const allDiags = bag.getAll();
      if (allDiags.length > 0) {
        console.warn(bag.format(source));
        console.warn(`\n${filePath}: OK (con advertencias).`);
      } else {
        console.log(`${filePath}: OK`);
      }
      continue;
    }

    const irBefore = new IRGenerator().generate(ast);
    const irAfter = values["no-opt"] ? irBefore : new Optimizer().optimize(irBefore);

    if (values.ir) {
      console.log(`\n=== IR (antes de optimizar): ${filePath} ===`);
      console.log(printIR(irBefore));
      if (!values["no-opt"]) {
        console.log(`\n=== IR (después de optimizar): ${filePath} ===`);
        console.log(printIR(irAfter));
      }
    }

    if (values.emit) {
      const jsCode = new CodeGenerator({ minify: values.minify }).generate(irAfter);

      if (values.out) {
        const path = await import("path");
        const baseName = path.basename(filePath, path.extname(filePath)) + ".js";
        const outPath = path.join(values.out, baseName);
        try {
          await Bun.write(outPath, jsCode);
          console.log(`${filePath} → ${outPath}`);
        } catch (err) {
          console.error(`Error al escribir '${outPath}': ${err}`);
          exitCode = 2;
        }
      } else {
        console.log(jsCode);
      }
    }

    const warnings = bag.getAll().filter(d => d.severity === DiagnosticSeverity.Warning);
    if (warnings.length > 0) {
      console.warn(bag.format(source));
    }
  }

  process.exit(exitCode);
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(2);
});
