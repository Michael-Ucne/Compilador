// Variables con tipos primitivos
const nombre: string = "TypeScript";
let version: number = 5;
var flag = true;

// Funcion con tipo de retorno
function saludar(n: string): string {
  return "Hola, " n;
}

// Arrow function
const sumar = (a: number, b: number): number => a + b;

// Condicional
if (version > 4) {
  console.log("Version moderna");
} else {
  console.log("Version antigua");
}

// Bucle for
for (let i = 0; i < 10; i++) {
  console.log(i);
}

// Bucle while
let contador = 0;
while (contador < 5) {
  contador++;
}

// Destructuring de objeto
const obj = { x: 1, y: 2 };
const { x, y } = obj;

// Destructuring de array
const arr = [1, 2, 3, 4];
const [primero, segundo] = arr;

// Operador nullish coalescing
const valorNulo = null;
const valor = valorNulo ?? "default";

// Operador opcional
function getLongitud(texto: string | undefined): number {
  return texto?.length ?? 0;
}

// Operadores logicos
const condA = true;
const condB = false;
const resultado = condA && condB || !condB;
