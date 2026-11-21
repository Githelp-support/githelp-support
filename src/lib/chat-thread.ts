/**
 * Pure row layout for a chat thread: where the day dividers go and which
 * messages start a new group (avatar + name + time) versus continue the one
 * above. Shared by the customer, helper and admin threads.
 */

import { formatTime } from "@/lib/format"

/** The minimum a thread item must expose. */
export interface ThreadItem {
  id: string
  /** Identifies the sender for grouping; `null` (unknown sender) never groups. */
  senderKey: string | null
  isSystem: boolean
  /** ISO timestamp. Synthetic messages (welcome, auto-reply, …) may have none. */
  createdAt?: string | null
}

export interface ThreadRow {
  /** A day divider is rendered above this item. */
  showDayDivider: boolean
  /** The item's `createdAt`, set only when `showDayDivider` is true. */
  dayLabelDate?: string
  /** The item shows its avatar, name and time; false = continues the group above. */
  isGroupStart: boolean
}

export interface BuildThreadRowsOptions {
  /**
   * The day already shown above the first item (e.g. the divider above the
   * intro, from `firstThreadDay`), so the first dated item on that day does
   * not repeat it.
   */
  initialDay?: string | Date | null
}

/** Messages from one sender at most this far apart share a group. */
export const GROUP_WINDOW_MS = 5 * 60 * 1000

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Local calendar day, comparable with ===. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** The first dated item's `createdAt`, or null when no item has one. */
export function firstThreadDay(items: readonly ThreadItem[]): string | null {
  for (const item of items) {
    if (item.createdAt && parseDate(item.createdAt)) return item.createdAt
  }
  return null
}

/**
 * One row per item, in order.
 *
 * - Day divider: emitted when a dated item falls on a different local day
 *   than the previous dated item (or than `initialDay` for the first one).
 *   Undated items inherit the current day and never emit one.
 * - Group: an item continues the group above only if the previous row is a
 *   non-system message from the same sender, both are dated, on the same day,
 *   and this one is at most 5 minutes later. System items and day dividers
 *   always start a new group.
 */
export function buildThreadRows(items: readonly ThreadItem[], options: BuildThreadRowsOptions = {}): ThreadRow[] {
  const initial = parseDate(options.initialDay)
  let currentDay: string | null = initial ? dayKey(initial) : null
  let previous: { item: ThreadItem; date: Date | null } | null = null

  return items.map((item) => {
    const date = parseDate(item.createdAt)

    let showDayDivider = false
    if (date) {
      const key = dayKey(date)
      showDayDivider = key !== currentDay
      currentDay = key
    }

    const prev = previous
    const continuesGroup =
      !showDayDivider &&
      !item.isSystem &&
      prev !== null &&
      !prev.item.isSystem &&
      item.senderKey !== null &&
      prev.item.senderKey === item.senderKey &&
      date !== null &&
      prev.date !== null &&
      dayKey(prev.date) === dayKey(date) &&
      date.getTime() - prev.date.getTime() >= 0 &&
      date.getTime() - prev.date.getTime() <= GROUP_WINDOW_MS

    previous = { item, date }

    const row: ThreadRow = { showDayDivider, isGroupStart: !continuesGroup }
    if (showDayDivider && item.createdAt) row.dayLabelDate = item.createdAt
    return row
  })
}

/**
 * The time beside a message ("10:16"): from the raw ISO `createdAt` when there
 * is one, otherwise the time part of an already formatted chat timestamp
 * ("15.11.2026, 10:16", as synthetic messages carry). Empty when neither has one.
 */
export function chatTimeLabel(createdAt: string | null | undefined, timestamp?: string | null): string {
  const date = parseDate(createdAt)
  if (date) return formatTime(date)
  const match = timestamp?.match(/\d{1,2}:\d{2}/)
  return match ? match[0] : ""
}
