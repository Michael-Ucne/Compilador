import { describe, it, expect } from "bun:test";
import { compile } from "../../src/index.ts";

function emit(src: string, noOptimize = false): string {
  const result = compile(src, { noCheck: true, noOptimize });
  return result.code.trim();
}

function emitChecked(src: string): { code: string; success: boolean; errorCount: number } {
  const result = compile(src, { noOptimize: true });
  return { code: result.code.trim(), success: result.success, errorCount: result.diagnostics.errorCount };
}

describe("CodeGenerator - literales", () => {
  it("emite número", () => {
    expect(emit("42;", true)).toBe("42;");
  });

  it("emite string", () => {
    expect(emit('"hola";', true)).toBe('"hola";');
  });

  it("emite boolean true", () => {
    expect(emit("true;", true)).toBe("true;");
  });

  it("emite boolean false", () => {
    expect(emit("false;", true)).toBe("false;");
  });

  it("emite null", () => {
    expect(emit("null;", true)).toBe("null;");
  });
});

describe("CodeGenerator - variables", () => {
  it("emite const sin tipo", () => {
    expect(emit("const x = 42;")).toBe("const x = 42;");
  });

  it("elimina la anotación de tipo en const", () => {
    expect(emit("const x: number = 42;")).toBe("const x = 42;");
  });

  it("emite let", () => {
    expect(emit("let y = 'hola';")).toBe('let y = "hola";');
  });

  it("emite var", () => {
    expect(emit("var z;")).toBe("var z;");
  });
});

describe("CodeGenerator - funciones", () => {
  it("emite función simple sin tipos", () => {
    const out = emit("function add(a: number, b: number): number { return a + b; }");
    expect(out).toBe("function add(a, b) {\n  return a + b;\n}");
  });

  it("emite función async", () => {
    const out = emit("async function fetch(): Promise<void> {}");
    expect(out).toContain("async function fetch()");
  });

  it("emite función generadora", () => {
    const out = emit("function* gen() { yield 1; }");
    expect(out).toMatch(/function\s*\*\s*gen\(\)/);
  });

  it("emite arrow function con parámetro simple", () => {
    const out = emit("const double = (x: number) => x * 2;", true);
    expect(out).toContain("=> x * 2");
  });

  it("emite arrow function con bloque", () => {
    const out = emit("const f = (x: number) => { return x; };", true);
    expect(out).toContain("=>");
    expect(out).toContain("return x");
  });
});

describe("CodeGenerator - clases", () => {
  it("emite clase vacía", () => {
    expect(emit("class Foo {}")).toBe("class Foo {}");
  });

  it("elimina type annotations de clase", () => {
    const src = `
      class Dog {
        name: string;
        constructor(name: string) {
          this.name = name;
        }
      }
    `;
    const out = emit(src);
    expect(out).toContain("class Dog");
    expect(out).toContain("constructor(name)");
    expect(out).not.toContain(": string");
  });

  it("emite herencia extends", () => {
    const out = emit("class Poodle extends Dog {}");
    expect(out).toBe("class Poodle extends Dog {}");
  });

  it("emite método", () => {
    const out = emit("class Foo { bar(): void { return; } }");
    expect(out).toContain("bar()");
    expect(out).not.toContain(": void");
  });

  it("emite método estático", () => {
    const out = emit("class Util { static help(): string { return ''; } }");
    expect(out).toContain("static help()");
  });

  it("emite getter", () => {
    const out = emit("class Foo { get value(): number { return 0; } }");
    expect(out).toContain("get value()");
  });
});

describe("CodeGenerator - enums", () => {
  it("convierte enum a objeto const", () => {
    const out = emit("enum Color { Red, Green, Blue }");
    expect(out).toContain("const Color =");
    expect(out).toContain('"Red"');
    expect(out).toContain('"Green"');
    expect(out).toContain('"Blue"');
  });
});

describe("CodeGenerator - sentencias de control", () => {
  it("emite if-else", () => {
    const out = emit("if (x > 0) { return x; } else { return -x; }");
    expect(out).toContain("if (x > 0)");
    expect(out).toContain("else");
  });

  it("emite while", () => {
    const out = emit("while (i < 10) { i++; }");
    expect(out).toContain("while (i < 10)");
  });

  it("emite for", () => {
    const out = emit("for (let i = 0; i < 10; i++) {}");
    expect(out).toContain("for (let i = 0; i < 10; i++)");
  });

  it("emite do-while", () => {
    const out = emit("do { i++; } while (i < 10);");
    expect(out).toContain("do");
    expect(out).toContain("while (i < 10)");
  });

  it("emite try-catch", () => {
    const out = emit("try { foo(); } catch (e) { bar(); }");
    expect(out).toContain("try");
    expect(out).toContain("catch");
  });

  it("emite switch", () => {
    const out = emit("switch (x) { case 1: break; default: break; }");
    expect(out).toContain("switch (x)");
    expect(out).toContain("case 1:");
    expect(out).toContain("default:");
  });

  it("emite return sin valor", () => {
    const out = emit("function f() { return; }");
    expect(out).toContain("return;");
  });

  it("emite throw", () => {
    const out = emit("throw new Error('msg');");
    expect(out).toContain("throw new Error");
  });
});

describe("CodeGenerator - expresiones", () => {
  it("emite operadores binarios", () => {
    expect(emit("a + b;")).toBe("a + b;");
    expect(emit("a * b;")).toBe("a * b;");
    expect(emit("a === b;")).toBe("a === b;");
  });

  it("emite operador unario prefijo", () => {
    expect(emit("!x;")).toBe("!x;");
    expect(emit("-n;")).toBe("-n;");
  });

  it("emite operador postfijo", () => {
    expect(emit("i++;")).toBe("i++;");
    expect(emit("j--;")).toBe("j--;");
  });

  it("emite new", () => {
    expect(emit("new Dog();")).toBe("new Dog();");
  });

  it("emite acceso a propiedad", () => {
    expect(emit("obj.prop;")).toBe("obj.prop;");
  });

  it("emite acceso indexado", () => {
    expect(emit("arr[0];")).toBe("arr[0];");
  });

  it("emite array literal", () => {
    expect(emit("[1, 2, 3];")).toBe("[1, 2, 3];");
  });

  it("emite object literal", () => {
    const out = emit("({ a: 1, b: 2 });");
    expect(out).toContain("a: 1");
    expect(out).toContain("b: 2");
  });

  it("emite ternario", () => {
    const out = emit("x > 0 ? x : -x;");
    expect(out).toContain("?");
    expect(out).toContain(":");
  });

  it("emite typeof", () => {
    expect(emit("typeof x;")).toBe("typeof x;");
  });
});

describe("CodeGenerator - optimizaciones integradas", () => {
  it("pliega constantes en tiempo de compilación", () => {
    const out = emit("const x = 2 + 3;");
    expect(out).toBe("const x = 5;");
  });

  it("propaga y pliega constantes encadenadas", () => {
    const out = emit("const PI = 3.14159;\nconst area = PI * 5 * 5;");
    expect(out).toContain("78.5397");
  });

  it("elimina if (false) completamente", () => {
    const out = emit("if (false) { neverExecuted(); }");
    expect(out).toBe("");
  });

  it("mantiene solo la rama then de if (true)", () => {
    const out = emit("if (true) { reached(); } else { unreachable(); }");
    expect(out).toContain("reached()");
    expect(out).not.toContain("unreachable");
    expect(out).not.toContain("if");
  });
});

describe("CodeGenerator - análisis semántico integrado", () => {
  it("rechaza variable no declarada", () => {
    const { success, errorCount } = emitChecked("console.log(variableInexistente);");
    expect(success).toBe(false);
    expect(errorCount).toBeGreaterThan(0);
  });

  it("rechaza reasignación de const", () => {
    const { success } = emitChecked("const PI = 3.14;\nPI = 3;");
    expect(success).toBe(false);
  });

  it("acepta código válido y emite JS", () => {
    const { success, code } = emitChecked("const x = 1;\nconsole.log(x);");
    expect(success).toBe(true);
    expect(code).toContain("console.log");
  });
});

describe("CodeGenerator - opciones", () => {
  it("opción semicolons:false omite punto y coma", () => {
    const result = compile("const x = 1;", { noCheck: true, semicolons: false });
    expect(result.code).not.toContain(";");
  });

  it("opción minify elimina espacios y saltos", () => {
    const result = compile("const x = 1;", { noCheck: true, minify: true });
    expect(result.code).not.toContain("\n");
  });
});
