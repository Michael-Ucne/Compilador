// Error: identificador duplicado
const x = 1;
const x = 2; // Error TS3002

function miFuncion() {
  return 1;
}

function miFuncion() { // Error TS3002
  return 2;
}
