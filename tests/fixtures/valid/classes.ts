interface Animal {
  nombre: string;
  sonido(): string;
}

abstract class AnimalBase implements Animal {
  nombre: string;

  constructor(nombre: string) {
    this.nombre = nombre;
  }

  abstract sonido(): string;

  describir(): string {
    return this.nombre + " hace " + this.sonido();
  }
}

class Perro extends AnimalBase {
  private raza: string;

  constructor(nombre: string, raza: string) {
    super(nombre);
    this.raza = raza;
  }

  sonido(): string {
    return "guau";
  }

  getRaza(): string {
    return this.raza;
  }
}

class Gato extends AnimalBase {
  readonly patas: number = 4;

  sonido(): string {
    return "miau";
  }
}

const perro = new Perro("Rex", "Pastor");
const gato = new Gato("Whiskers");

console.log(perro.describir());
console.log(gato.patas);
