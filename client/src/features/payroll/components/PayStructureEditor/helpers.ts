export function centsToDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
