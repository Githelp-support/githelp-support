import { describe, it, expect } from "vitest"
import {
  parseTimeDisplayToMinutes,
  formatRelativeTime,
  formatDate,
  formatDateTime,
  formatTime,
  formatDayLabel,
  formatShortDate,
} from "../format"

describe("parseTimeDisplayToMinutes", () => {
  it("returns 0 for dash placeholder", () => {
    expect(parseTimeDisplayToMinutes("-")).toBe(0)
  })

  it("parses combined hours and minutes", () => {
    expect(parseTimeDisplayToMinutes("2h 30m")).toBe(150)
    expect(parseTimeDisplayToMinutes("1h 0m")).toBe(60)
    expect(parseTimeDisplayToMinutes("10h 15m")).toBe(615)
  })

  it("parses minutes only", () => {
    expect(parseTimeDisplayToMinutes("45m")).toBe(45)
    expect(parseTimeDisplayToMinutes("5m")).toBe(5)
  })

  it("returns 0 for unrecognized input", () => {
    expect(parseTimeDisplayToMinutes("")).toBe(0)
    expect(parseTimeDisplayToMinutes("nope")).toBe(0)
    expect(parseTimeDisplayToMinutes("abc")).toBe(0)
  })
})

describe("formatRelativeTime", () => {
  it('returns "Just now" for a timestamp less than 1 minute ago', () => {
    const now = new Date()
    expect(formatRelativeTime(now.toISOString())).toBe("Just now")
  })

  it("returns minutes ago", () => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - 10)
    expect(formatRelativeTime(d.toISOString())).toBe("10 min")
  })

  it("returns hours ago", () => {
    const d = new Date()
    d.setHours(d.getHours() - 3)
    expect(formatRelativeTime(d.toISOString())).toBe("3h")
  })

  it("returns days ago for dates within the past week", () => {
    const d = new Date()
    d.setDate(d.getDate() - 2)
    expect(formatRelativeTime(d.toISOString())).toBe("2d")
  })

  it("returns a locale date string for dates older than 7 days", () => {
    const d = new Date()
    d.setDate(d.getDate() - 10)
    const result = formatRelativeTime(d.toISOString())
    // Should be a formatted date string, not a relative expression
    expect(result).not.toMatch(/min|h$|d$/)
  })
})

describe("formatTime", () => {
  it("formats as zero-padded 24h HH:MM in local time", () => {
    expect(formatTime(new Date(2026, 10, 15, 9, 5))).toBe("09:05")
    expect(formatTime(new Date(2026, 10, 15, 0, 0))).toBe("00:00")
    expect(formatTime(new Date(2026, 10, 15, 23, 59))).toBe("23:59")
  })

  it("accepts an ISO string", () => {
    expect(formatTime(new Date(2026, 10, 15, 14, 7).toISOString())).toBe("14:07")
  })
})

describe("formatDayLabel", () => {
  const now = new Date(2026, 10, 21, 12, 0)

  it('returns "Today" for any time on the same local day', () => {
    expect(formatDayLabel(new Date(2026, 10, 21, 0, 0), now)).toBe("Today")
    expect(formatDayLabel(new Date(2026, 10, 21, 23, 59), now)).toBe("Today")
  })

  it('returns "Yesterday" for the previous local day, also just before midnight', () => {
    expect(formatDayLabel(new Date(2026, 10, 20, 23, 59), now)).toBe("Yesterday")
    expect(formatDayLabel(new Date(2026, 10, 20, 0, 0), now)).toBe("Yesterday")
  })

  it("handles yesterday across a month boundary", () => {
    expect(formatDayLabel(new Date(2026, 9, 31, 18, 0), new Date(2026, 10, 1, 8, 0))).toBe("Yesterday")
  })

  it("returns weekday, day and month for older dates", () => {
    expect(formatDayLabel(new Date(2026, 10, 15, 10, 16), now)).toBe("Sunday 15 November")
    expect(formatDayLabel(new Date(2026, 10, 19, 10, 16), now)).toBe("Thursday 19 November")
    expect(formatDayLabel(new Date(2026, 0, 5, 10, 0).toISOString(), now)).toBe("Monday 5 January")
  })

  it("does not call a future day Today or Yesterday", () => {
    expect(formatDayLabel(new Date(2026, 10, 22, 10, 0), now)).toBe("Sunday 22 November")
  })
})

describe("formatShortDate", () => {
  it("formats as day, short month and year", () => {
    expect(formatShortDate(new Date(2026, 10, 15, 10, 16))).toBe("15 Nov 2026")
    expect(formatShortDate(new Date(2026, 10, 7))).toBe("7 Nov 2026")
    expect(formatShortDate(new Date(2026, 4, 1).toISOString())).toBe("1 May 2026")
  })
})

describe("formatDate / formatDateTime (unchanged)", () => {
  it("keeps dd.mm.yyyy and dd.mm.yyyy, HH:MM", () => {
    expect(formatDate(new Date(2026, 1, 1))).toBe("01.02.2026")
    expect(formatDateTime(new Date(2026, 1, 1, 9, 5))).toBe("01.02.2026, 09:05")
  })
})
