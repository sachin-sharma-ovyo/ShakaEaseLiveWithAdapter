/** Message from an `Error`, or `fallback` for anything else. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
