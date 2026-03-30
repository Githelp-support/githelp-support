/**
 * Parse a displayed time string (e.g. "2h 30m", "45m", "-") to minutes for sorting/comparison.
 * Used by dashboard tables that show formatted time from formatTime().
 */
export function parseTimeDisplayToMinutes(time: string): number {
  if (time === "-") return 0
  const match = time.match(/(\d+)h\s*(\d+)m|(\d+)m/)
  if (!match) return 0
  const hours = match[1] ? Number.parseInt(match[1], 10) : 0
  const minutes = match[2] ? Number.parseInt(match[2], 10) : match[3] ? Number.parseInt(match[3], 10) : 0
  return hours * 60 + minutes
}

/**
 * Format a date string as a relative time (e.g. "Just now", "5 min", "2h", "3d").
 * Use for notifications, activity feeds, etc.
 */
export function formatRelativeTime(createdAt: string): string {
  const now = new Date()
  const created = new Date(createdAt)
  const diffMs = now.getTime() - created.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins} min`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 3) return `${diffDays}d`

  const sameYear = created.getFullYear() === now.getFullYear()
  const month = created.toLocaleString("en-US", { month: "short" })
  const day = created.getDate()

  return sameYear ? `${month} ${day}` : `${month} ${day}, ${created.getFullYear()}`
}
