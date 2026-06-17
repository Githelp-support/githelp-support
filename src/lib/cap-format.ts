/**
 * Convert a smallest-unit cap (null = unlimited) into the dollar string the
 * caps UI binds to. Null becomes the empty input.
 */
export function formatCapDollars(cents: number | null): string {
  if (cents === null) return ""
  return (cents / 100).toFixed(2)
}

/**
 * Parse an input string into a smallest-unit value. Empty / whitespace /
 * non-numeric input means "no cap" (null). Rounded to the nearest cent.
 */
export function parseCapDollars(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === "") return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed * 100)
}
