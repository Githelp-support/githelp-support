import { describe, it, expect } from "vitest"
import { parseTimeDisplayToMinutes, formatRelativeTime } from "./format"

describe("parseTimeDisplayToMinutes", () => {
  it("returns 0 for dash placeholder", () => {
    expect(parseTimeDisplayToMinutes("-")).toBe(0)
  })

  it("parses hours and minutes", () => {
    expect(parseTimeDisplayToMinutes("2h 30m")).toBe(150)
    expect(parseTimeDisplayToMinutes("1h 0m")).toBe(60)
  })

  it("parses minutes only", () => {
    expect(parseTimeDisplayToMinutes("45m")).toBe(45)
  })

  it("returns 0 for invalid or empty", () => {
    expect(parseTimeDisplayToMinutes("")).toBe(0)
    expect(parseTimeDisplayToMinutes("nope")).toBe(0)
  })
})

describe("formatRelativeTime", () => {
  it("formats recent time as Just now", () => {
    const now = new Date()
    expect(formatRelativeTime(now.toISOString())).toBe("Just now")
  })

  it("formats minutes ago", () => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - 5)
    expect(formatRelativeTime(d.toISOString())).toBe("5 min")
  })
})
