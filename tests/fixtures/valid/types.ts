// Union types
type StringOrNumber = string | number;
type Resultado = "ok" | "error" | "pendiente";

// Intersection types
type Timestamp = { createdAt: Date };
type Auditable = { createdBy: string } & Timestamp;

// Conditional types
type IsString<T> = T extends string ? true : false;
type NonNullable2<T> = T extends null | undefined ? never : T;

// Indexed access
type ArrayElement<T extends readonly unknown[]> = T[number];

// Tuple types
type Punto = [number, number];

// Enum con valores string
enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT",
}

const dir = Direction.Up;
console.log(dir);
