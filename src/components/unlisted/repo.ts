/**
 * "owner/repo" from anything that looks like a GitHub repository reference:
 * https://github.com/owner/repo(.git)(/tree/...), git@github.com:owner/repo.git,
 * github.com/owner/repo, or plain owner/repo. Lower-cased (GitHub names are
 * case-insensitive); null when nothing matches.
 */
export function parseRepoRef(input: string | null | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim().replace(/\/+$/, "")
  const patterns = [
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/i,
    /^git@github\.com:([^/\s]+)\/([^/\s]+)$/i,
    /^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s]+)$/i,
    /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/,
  ]
  for (const re of patterns) {
    const m = trimmed.match(re)
    if (m) {
      const repo = m[2].replace(/\.git$/i, "")
      if (!repo || repo === "." || repo === "..") return null
      return `${m[1]}/${repo}`.toLowerCase()
    }
  }
  return null
}

/** Public demand page for a repository. */
export function demandPagePath(repo: string): string {
  const [owner, name] = repo.split("/")
  return `/r/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
}

/** "$12.50" from cents. */
export function formatUsd(smallestUnit: number | null | undefined): string {
  return `$${((smallestUnit ?? 0) / 100).toFixed(2)}`
}

/** Cents from a dollar amount typed by a person ("25", "25.5", "25.50"); null when empty, NaN when invalid. */
export function dollarsToCents(value: string): number | null {
  const v = value.trim()
  if (!v) return null
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(v)) return Number.NaN
  return Math.round(Number(v) * 100)
}
