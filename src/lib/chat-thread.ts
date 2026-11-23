/**
 * Pure helpers for the chat thread: message times, day dividers and grouping
 * of consecutive messages from the same sender. No React, no formatting of
 * the existing `timestamp` strings.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTHS = [
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

/** Messages from the same sender at most this far apart share a group. */
export const GROUP_WINDOW_MS = 5 * 60 * 1000

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

/** "HH:MM" (24-hour, zero-padded, local time). */
export function formatChatTime(value: Date | string): string {
  const date = toDate(value)
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

/** Both fall on the same local calendar day. */
export function isSameDay(a: Date | string, b: Date | string): boolean {
  const first = toDate(a)
  const second = toDate(b)
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  )
}

/** "Today", "Yesterday" or "Sunday 15 November". */
export function formatDayDividerLabel(value: Date | string, now: Date = new Date()): string {
  const date = toDate(value)
  if (isSameDay(date, now)) return "Today"
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (isSameDay(date, yesterday)) return "Yesterday"
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

/** The fields `buildThreadRows` reads; `TicketChatMessage` satisfies it as is. */
export interface ThreadItem {
  id: string
  /** "user" | "helper" | "system" (either field name is accepted). */
  senderType?: string | null
  sender?: string | null
  senderId?: string | null
  /** Raw ISO time. Absent on synthetic items (claimed, pending first message, session summary). */
  createdAt?: string | null
  /** A claimed/ended banner. `kind: "claimed" | "ended"` counts as one too. */
  isBanner?: boolean
  /** `"welcome"` is the stored welcome row: always a group start. */
  kind?: string | null
  /** Welcome, start note or auto-reply: built in the browser, or a stored row of those kinds (`metadata.kind`, optional `tickets_messages.is_automatic`). */
  isAutomatic?: boolean | null
}

export interface ThreadRow<T extends ThreadItem = ThreadItem> {
  item: T
  /** Label of the day divider to render above this row, or null for none. */
  showDayDivider: string | null
  /** First row of a sender group (shows avatar, name and time). */
  groupStart: boolean
}

function parseCreatedAt(item: ThreadItem): Date | null {
  if (!item.createdAt) return null
  const date = new Date(item.createdAt)
  return Number.isNaN(date.getTime()) ? null : date
}

function senderTypeOf(item: ThreadItem): string | null {
  return item.senderType ?? item.sender ?? null
}

/**
 * System messages, automatic rows (whatever sender type they carry), the
 * welcome row and claimed/ended banners never join or continue a group.
 */
function breaksGroup(item: ThreadItem): boolean {
  return (
    senderTypeOf(item) === "system" ||
    !!item.isAutomatic ||
    !!item.isBanner ||
    item.kind === "welcome" ||
    item.kind === "claimed" ||
    item.kind === "ended"
  )
}

/**
 * Thread rows with day dividers and sender grouping.
 *
 * Day dividers: the first row always gets one; after that a divider appears
 * whenever the day changes. Items without `createdAt` inherit the day of the
 * nearest dated item (the previous one, or the next one at the top of the
 * thread; `now` when nothing is dated) and never trigger a divider themselves.
 *
 * Grouping: a row continues the previous row's group only when both are from
 * the same sender, on the same day, the row is at most 5 minutes after the
 * previous one, and nothing is in between. A day divider, a system message,
 * an automatic row, the welcome row or a claimed/ended banner always starts a
 * new group.
 */
export function buildThreadRows<T extends ThreadItem>(messages: T[], now: Date = new Date()): ThreadRow<T>[] {
  const dates = messages.map(parseCreatedAt)
  const firstDated = dates.find((d): d is Date => d !== null) ?? null

  const rows: ThreadRow<T>[] = []
  let currentDay: Date | null = null

  messages.forEach((item, index) => {
    const date = dates[index]
    let showDayDivider: string | null = null

    if (index === 0) {
      currentDay = date ?? firstDated ?? now
      showDayDivider = formatDayDividerLabel(currentDay, now)
    } else if (date && currentDay && !isSameDay(date, currentDay)) {
      currentDay = date
      showDayDivider = formatDayDividerLabel(date, now)
    }

    const prev = index > 0 ? messages[index - 1] : null
    const prevDate = index > 0 ? dates[index - 1] : null
    let groupStart = true
    if (prev && !showDayDivider && !breaksGroup(item) && !breaksGroup(prev) && date && prevDate) {
      const gap = date.getTime() - prevDate.getTime()
      groupStart = !(
        senderTypeOf(item) === senderTypeOf(prev) &&
        (item.senderId ?? null) === (prev.senderId ?? null) &&
        gap >= 0 &&
        gap <= GROUP_WINDOW_MS
      )
    }

    rows.push({ item, showDayDivider, groupStart })
  })

  return rows
}
