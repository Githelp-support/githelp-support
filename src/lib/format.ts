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
  if (diffDays < 7) return `${diffDays}d`
  return created.toLocaleDateString()
}

/**
 * Format a duration in seconds as days, hours and minutes, dropping any unit
 * that is zero: 93000 → "1d 1h 50m", 5400 → "1h 30m", 1800 → "30m".
 * Rounded to the nearest minute; anything under half a minute is "<1m".
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "<1m"
  const totalMinutes = Math.round(totalSeconds / 60)
  if (totalMinutes < 1) return "<1m"

  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  return parts.join(" ")
}
