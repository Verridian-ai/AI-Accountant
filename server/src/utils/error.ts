export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function hasCode(error: unknown): error is { code: unknown } {
  return typeof error === 'object' && error !== null && 'code' in error;
}
