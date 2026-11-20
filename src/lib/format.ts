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
 * Format a date as zero-padded dd.mm.yyyy (01.02.2026), the way the ticket
 * lists show dates. Never use the bare browser locale for a list column.
 */
export function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${day}.${month}.${date.getFullYear()}`
}

/** dd.mm.yyyy, HH:MM — the timestamp format for chat messages and ticket lists. */
export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${formatDate(date)}, ${hours}:${minutes}`
}

/** HH:MM in local time, zero-padded (09:05): the time beside a chat message. */
export function formatTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/** Whether two dates fall on the same local calendar day. */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * Label for a chat day divider: "Today", "Yesterday", otherwise the weekday,
 * day and month ("Sunday 15 November"). Compared by local calendar day against
 * `now`, which is a parameter so the function stays pure.
 */
export function formatDayLabel(value: string | Date, now: Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value)
  if (isSameLocalDay(date, now)) return "Today"
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (isSameLocalDay(date, yesterday)) return "Yesterday"
  return `${WEEKDAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`
}

/** Day and abbreviated month, "15 Nov". */
export function formatShortDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}`
}

/** The first 8 characters of a ticket id (the first UUID segment), as shown in the UI. */
export function shortTicketId(id: string): string {
  return id.slice(0, 8)
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
  return formatDate(created)
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

/**
 * Truncate text to `maxLength` characters, appending a single "…" (U+2026)
 * when the original is longer. Text at or under the limit is returned unchanged.
 */
export function truncateText(text: string, maxLength = 30): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "…"
}
