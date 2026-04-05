// Función genérica
function identity<T>(value: T): T {
  return value;
}

// Función con restricción
function getLength<T extends { length: number }>(item: T): number {
  return item.length;
}

// Clase genérica
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  get size(): number {
    return this.items.length;
  }
}

// Interfaz genérica
interface Repository<T> {
  findById(id: number): T | undefined;
  findAll(): T[];
  save(entity: T): void;
}

// Tipos utilitarios
type Opcional<T> = T | undefined;
type Nullable<T> = T | null;
type Par<A, B> = { first: A; second: B };

const stack = new Stack<number>();
stack.push(1);
stack.push(2);
const top = stack.pop();
