import { describe, it, expect } from "vitest"
import { buildThreadRows, formatChatTime, formatDayDividerLabel, isSameDay, type ThreadItem } from "../chat-thread"
import { formatDateMedium } from "../format"

/** Local-time ISO string, so the tests pass in any timezone. */
const at = (day: number, hour: number, minute: number, month = 10) =>
  new Date(2026, month, day, hour, minute).toISOString()

const NOW = new Date(2026, 10, 22, 12, 0)

const msg = (id: string, createdAt: string | undefined, overrides: Partial<ThreadItem> = {}): ThreadItem => ({
  id,
  senderType: "user",
  senderId: "u1",
  createdAt,
  ...overrides,
})

describe("formatChatTime", () => {
  it("returns zero-padded HH:MM", () => {
    expect(formatChatTime(new Date(2026, 10, 15, 9, 5))).toBe("09:05")
    expect(formatChatTime(at(15, 23, 59))).toBe("23:59")
  })
})

describe("isSameDay", () => {
  it("compares local calendar days", () => {
    expect(isSameDay(new Date(2026, 10, 15, 0, 1), new Date(2026, 10, 15, 23, 59))).toBe(true)
    expect(isSameDay(new Date(2026, 10, 15, 23, 59), new Date(2026, 10, 16, 0, 0))).toBe(false)
    expect(isSameDay(new Date(2025, 10, 15), new Date(2026, 10, 15))).toBe(false)
  })
})

describe("formatDayDividerLabel", () => {
  it("returns Today and Yesterday relative to now", () => {
    expect(formatDayDividerLabel(new Date(2026, 10, 22, 0, 5), NOW)).toBe("Today")
    expect(formatDayDividerLabel(new Date(2026, 10, 21, 23, 55), NOW)).toBe("Yesterday")
  })

  it("handles yesterday across a month boundary", () => {
    expect(formatDayDividerLabel(new Date(2026, 9, 31, 10, 0), new Date(2026, 10, 1, 9, 0))).toBe("Yesterday")
  })

  it("returns weekday, day and month for older days", () => {
    expect(formatDayDividerLabel(new Date(2026, 10, 15, 10, 16), NOW)).toBe("Sunday 15 November")
    expect(formatDayDividerLabel(at(20, 10, 0), NOW)).toBe("Friday 20 November")
  })
})

describe("formatDateMedium", () => {
  it("returns d Mon yyyy", () => {
    expect(formatDateMedium(new Date(2026, 10, 15))).toBe("15 Nov 2026")
    expect(formatDateMedium(at(7, 8, 0))).toBe("7 Nov 2026")
  })
})

describe("buildThreadRows", () => {
  it("returns no rows for an empty thread", () => {
    expect(buildThreadRows([], NOW)).toEqual([])
  })

  it("always gives the first row a divider and a group start", () => {
    const rows = buildThreadRows([msg("a", at(15, 10, 16))], NOW)
    expect(rows).toEqual([{ item: expect.objectContaining({ id: "a" }), showDayDivider: "Sunday 15 November", groupStart: true }])
  })

  it("groups the same sender within 5 minutes on the same day", () => {
    const rows = buildThreadRows(
      [msg("a", at(15, 10, 17)), msg("b", at(15, 10, 20)), msg("c", at(15, 10, 25)), msg("d", at(15, 10, 31))],
      NOW,
    )
    expect(rows.map((r) => r.groupStart)).toEqual([true, false, false, true])
    expect(rows.slice(1).every((r) => r.showDayDivider === null)).toBe(true)
  })

  it("starts a new group for another sender", () => {
    const rows = buildThreadRows(
      [
        msg("a", at(15, 10, 17)),
        msg("b", at(15, 10, 18), { senderType: "helper", senderId: "h1" }),
        msg("c", at(15, 10, 19), { senderType: "helper", senderId: "h2" }),
        msg("d", at(15, 10, 20), { senderType: "helper", senderId: "h2" }),
      ],
      NOW,
    )
    expect(rows.map((r) => r.groupStart)).toEqual([true, true, true, false])
  })

  it("accepts `sender` in place of `senderType`", () => {
    const rows = buildThreadRows(
      [
        { id: "a", sender: "user", senderId: "u1", createdAt: at(15, 10, 17) },
        { id: "b", sender: "user", senderId: "u1", createdAt: at(15, 10, 18) },
        { id: "c", sender: "system", createdAt: at(15, 10, 18) },
      ],
      NOW,
    )
    expect(rows.map((r) => r.groupStart)).toEqual([true, false, true])
  })

  it("adds a divider when the day changes, which starts a new group", () => {
    const rows = buildThreadRows(
      [msg("a", at(20, 23, 58)), msg("b", at(21, 0, 1)), msg("c", at(22, 9, 0))],
      NOW,
    )
    expect(rows.map((r) => r.showDayDivider)).toEqual(["Friday 20 November", "Yesterday", "Today"])
    expect(rows.map((r) => r.groupStart)).toEqual([true, true, true])
  })

  it("never groups system messages, and they split the group around them", () => {
    const rows = buildThreadRows(
      [
        msg("a", at(15, 10, 17)),
        msg("s1", at(15, 10, 17), { senderType: "system", senderId: null }),
        msg("s2", at(15, 10, 17), { senderType: "system", senderId: null }),
        msg("b", at(15, 10, 18)),
      ],
      NOW,
    )
    expect(rows.map((r) => r.groupStart)).toEqual([true, true, true, true])
  })

  it("treats claimed/ended banners as group breaks", () => {
    const rows = buildThreadRows(
      [
        msg("a", at(15, 10, 17), { senderType: "helper", senderId: "h1" }),
        msg("banner", at(15, 10, 17), { senderType: "helper", senderId: "h1", isBanner: true }),
        msg("b", at(15, 10, 18), { senderType: "helper", senderId: "h1" }),
        msg("ended", at(15, 10, 18), { senderType: "helper", senderId: "h1", kind: "ended" }),
        msg("c", at(15, 10, 19), { senderType: "helper", senderId: "h1" }),
      ],
      NOW,
    )
    expect(rows.map((r) => r.groupStart)).toEqual([true, true, true, true, true])
  })

  it("treats the stored welcome row as a group start and automatic rows as group breaks", () => {
    const rows = buildThreadRows(
      [
        msg("welcome", at(15, 10, 17), { senderType: "system", senderId: null, kind: "welcome", isAutomatic: true }),
        msg("start-note", at(15, 10, 17), { senderType: "system", senderId: null, isAutomatic: true }),
        msg("a", at(15, 10, 17)),
        msg("auto-reply", at(15, 10, 17), { senderType: "system", senderId: null, isAutomatic: true }),
        msg("b", at(15, 10, 18)),
        msg("c", at(15, 10, 19)),
      ],
      NOW,
    )
    expect(rows.map((r) => r.showDayDivider)).toEqual(["Sunday 15 November", null, null, null, null, null])
    // The auto-reply sits between a and b, so b starts a new group; c joins b.
    expect(rows.map((r) => r.groupStart)).toEqual([true, true, true, true, true, false])
  })

  it("breaks groups on the welcome kind and the automatic flag alone, whatever the sender", () => {
    const rows = buildThreadRows(
      [
        msg("a", at(15, 10, 17)),
        msg("welcome", at(15, 10, 17), { kind: "welcome" }),
        msg("b", at(15, 10, 18)),
        msg("auto", at(15, 10, 18), { isAutomatic: true }),
        msg("c", at(15, 10, 19)),
      ],
      NOW,
    )
    expect(rows.map((r) => r.groupStart)).toEqual([true, true, true, true, true])
  })

  it("lets undated items inherit the neighbouring day without a divider of their own", () => {
    const rows = buildThreadRows(
      [
        msg("system-claimed", undefined, { senderType: "system", senderId: "h1", kind: "claimed" }),
        msg("pending-first", undefined),
        msg("a", at(15, 10, 17)),
        msg("b", at(15, 10, 18)),
        msg("c", at(16, 9, 0)),
        msg("session-summary", undefined, { senderType: "system", senderId: null }),
      ],
      NOW,
    )
    // The undated rows at the top take the first dated message's day, not "Today".
    expect(rows.map((r) => r.showDayDivider)).toEqual([
      "Sunday 15 November",
      null,
      null,
      null,
      "Monday 16 November",
      null,
    ])
    expect(rows.map((r) => r.groupStart)).toEqual([true, true, true, false, true, true])
  })

  it("falls back to today when nothing in the thread is dated", () => {
    const rows = buildThreadRows([msg("session-summary", undefined, { senderType: "system", senderId: null })], NOW)
    expect(rows[0].showDayDivider).toBe("Today")
  })

  it("does not group an undated message with its neighbour", () => {
    const rows = buildThreadRows([msg("pending-first", undefined), msg("b", at(15, 10, 18))], NOW)
    expect(rows.map((r) => r.groupStart)).toEqual([true, true])
    expect(rows.map((r) => r.showDayDivider)).toEqual(["Sunday 15 November", null])
  })

  it("keeps the original item on each row", () => {
    const item = { ...msg("a", at(15, 10, 17)), content: "Hei" }
    expect(buildThreadRows([item], NOW)[0].item).toBe(item)
  })
})
