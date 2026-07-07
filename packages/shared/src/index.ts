export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(): string {
  return crypto.randomUUID();
}

export function exhaustive(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
