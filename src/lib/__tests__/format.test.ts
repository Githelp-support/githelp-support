import { describe, it, expect } from "vitest"
import { parseTimeDisplayToMinutes, formatRelativeTime } from "../format"

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
