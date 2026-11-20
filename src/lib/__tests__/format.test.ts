import { describe, it, expect } from "vitest"
import {
  parseTimeDisplayToMinutes,
  formatRelativeTime,
  formatTime,
  formatDayLabel,
  formatShortDate,
  shortTicketId,
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
  it("formats local time as zero-padded HH:MM", () => {
    expect(formatTime(new Date(2026, 10, 15, 9, 5))).toBe("09:05")
    expect(formatTime(new Date(2026, 10, 15, 0, 0))).toBe("00:00")
    expect(formatTime(new Date(2026, 10, 15, 23, 59))).toBe("23:59")
  })

  it("accepts an ISO string", () => {
    expect(formatTime(new Date(2026, 10, 15, 14, 30).toISOString())).toBe("14:30")
  })
})

describe("formatDayLabel", () => {
  const now = new Date(2026, 10, 20, 12, 0)

  it('returns "Today" for any time on the same calendar day', () => {
    expect(formatDayLabel(new Date(2026, 10, 20, 0, 0), now)).toBe("Today")
    expect(formatDayLabel(new Date(2026, 10, 20, 23, 59), now)).toBe("Today")
  })

  it('returns "Yesterday" by calendar day, not by 24 hours', () => {
    expect(formatDayLabel(new Date(2026, 10, 19, 0, 1), now)).toBe("Yesterday")
    expect(formatDayLabel(new Date(2026, 10, 19, 23, 59), now)).toBe("Yesterday")
  })

  it("handles yesterday across a month boundary", () => {
    expect(formatDayLabel(new Date(2026, 9, 31, 18, 0), new Date(2026, 10, 1, 8, 0))).toBe("Yesterday")
  })

  it("returns weekday, day and month for older dates", () => {
    expect(formatDayLabel(new Date(2026, 10, 15, 10, 0), now)).toBe("Sunday 15 November")
    expect(formatDayLabel(new Date(2026, 10, 18, 10, 0), now)).toBe("Wednesday 18 November")
    expect(formatDayLabel(new Date(2026, 0, 1, 10, 0), now)).toBe("Thursday 1 January")
  })

  it("accepts an ISO string", () => {
    expect(formatDayLabel(new Date(2026, 10, 15, 10, 0).toISOString(), now)).toBe("Sunday 15 November")
  })
})

describe("formatShortDate", () => {
  it("formats as day and abbreviated month", () => {
    expect(formatShortDate(new Date(2026, 10, 15, 10, 0))).toBe("15 Nov")
    expect(formatShortDate(new Date(2026, 0, 1, 10, 0))).toBe("1 Jan")
    expect(formatShortDate(new Date(2026, 4, 9, 10, 0).toISOString())).toBe("9 May")
  })
})

describe("shortTicketId", () => {
  it("returns the first 8 characters", () => {
    expect(shortTicketId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("a1b2c3d4")
  })

  it("returns shorter ids unchanged", () => {
    expect(shortTicketId("abc")).toBe("abc")
    expect(shortTicketId("")).toBe("")
  })
})
