import {
  type Diagnostic,
  type DiagnosticMessage,
  type RelatedInformation,
  type Span,
  DiagnosticSeverity,
  DiagnosticCategory,
  formatMessage,
} from "./Diagnostic.ts";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

const useColor = typeof process !== "undefined" && process.stdout?.isTTY;

function c(code: string, text: string): string {
  return useColor ? `${code}${text}${RESET}` : text;
}

export class DiagnosticBag {
  private readonly items: Diagnostic[] = [];
  private _errorCount = 0;
  private _speculativeDepth = 0;

  get errorCount(): number {
    return this._errorCount;
  }

  /** Entra en modo especulativo: los diagnósticos se descartan al salir con rollback */
  beginSpeculation(): number {
    this._speculativeDepth++;
    return this.items.length;
  }

  /** Sale del modo especulativo; si `accept=false`, descarta diagnósticos emitidos desde `checkpoint` */
  endSpeculation(checkpoint: number, accept: boolean): void {
    this._speculativeDepth--;
    if (!accept && this.items.length > checkpoint) {
      // Recalcular errorCount
      const discarded = this.items.splice(checkpoint);
      for (const d of discarded) {
        if (d.severity === DiagnosticSeverity.Error) this._errorCount--;
      }
    }
  }

  isSpeculating(): boolean {
    return this._speculativeDepth > 0;
  }

  add(
    message: DiagnosticMessage,
    span: Span,
    fileName: string,
    ...args: string[]
  ): void {
    const severity =
      message.category === DiagnosticCategory.Semantic
        ? DiagnosticSeverity.Error
        : message.category === DiagnosticCategory.Parser
          ? DiagnosticSeverity.Error
          : DiagnosticSeverity.Error;

    this.push({ message, args, severity, span, fileName });
  }

  addWarning(
    message: DiagnosticMessage,
    span: Span,
    fileName: string,
    ...args: string[]
  ): void {
    this.push({
      message,
      args,
      severity: DiagnosticSeverity.Warning,
      span,
      fileName,
    });
  }

  addWithRelated(
    message: DiagnosticMessage,
    span: Span,
    fileName: string,
    related: RelatedInformation[],
    ...args: string[]
  ): void {
    this.push({
      message,
      args,
      severity: DiagnosticSeverity.Error,
      span,
      fileName,
      relatedInformation: related,
    });
  }

  private push(diag: Diagnostic): void {
    this.items.push(diag);
    if (diag.severity === DiagnosticSeverity.Error) {
      this._errorCount++;
    }
  }

  hasErrors(): boolean {
    return this._errorCount > 0;
  }

  getErrors(): ReadonlyArray<Diagnostic> {
    return this.items.filter((d) => d.severity === DiagnosticSeverity.Error);
  }

  getAll(): ReadonlyArray<Diagnostic> {
    return this.items;
  }

  /**
   * Formatea todos los diagnósticos con contexto de código fuente,
   * produciendo salida estilo tsc con flechas indicando la posición.
   */
  format(source: string): string {
    if (this.items.length === 0) return "";
    const lines = source.split("\n");
    return this.items.map((d) => this.formatOne(d, lines)).join("\n\n");
  }

  private formatOne(d: Diagnostic, lines: string[]): string {
    const severityLabel =
      d.severity === DiagnosticSeverity.Error
        ? c(RED + BOLD, "error")
        : d.severity === DiagnosticSeverity.Warning
          ? c(YELLOW + BOLD, "warning")
          : c(CYAN + BOLD, "info");

    const code = `TS${d.message.code}`;
    const text = formatMessage(d.message, d.args);
    const header = `${severityLabel} ${c(BOLD, code)}: ${text}`;

    const { line, column } = d.span.start;
    const location = `  ${c(CYAN, d.fileName)}:${line}:${column}`;

    const sourceContext = this.renderSourceContext(lines, line, column, d.span.end);

    const parts = [header, location, sourceContext];

    if (d.relatedInformation) {
      for (const rel of d.relatedInformation) {
        parts.push(
          `  ${c(DIM, "related:")} ${rel.message}`,
          `    ${c(CYAN, rel.fileName)}:${rel.span.start.line}:${rel.span.start.column}`,
        );
      }
    }

    return parts.join("\n");
  }

  private renderSourceContext(
    lines: string[],
    errorLine: number,
    errorCol: number,
    endPos: { line: number; column: number },
  ): string {
    const idx = errorLine - 1; // 0-based array index
    if (idx < 0 || idx >= lines.length) return "";

    const result: string[] = [];
    const lineNumWidth = String(errorLine + 1).length + 1;

    // línea anterior (contexto)
    if (idx > 0) {
      result.push(
        c(DIM, `${String(errorLine - 1).padStart(lineNumWidth)} | `) +
          (lines[idx - 1] ?? ""),
      );
    }

    // línea del error
    result.push(
      c(BOLD, `${String(errorLine).padStart(lineNumWidth)} | `) +
        (lines[idx] ?? ""),
    );

    // flecha de subrayado
    const caretStart = errorCol;
    const caretEnd =
      endPos.line === errorLine ? endPos.column : (lines[idx]?.length ?? 0);
    const caretLen = Math.max(1, caretEnd - caretStart);
    const padding = " ".repeat(lineNumWidth + 3 + caretStart);
    result.push(padding + c(RED + BOLD, "^".repeat(caretLen)));

    // línea siguiente (contexto)
    if (idx + 1 < lines.length) {
      result.push(
        c(DIM, `${String(errorLine + 1).padStart(lineNumWidth)} | `) +
          (lines[idx + 1] ?? ""),
      );
    }

    return result.join("\n");
  }
}
