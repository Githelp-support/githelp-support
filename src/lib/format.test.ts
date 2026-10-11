import { describe, it, expect } from "vitest"
import { parseTimeDisplayToMinutes, formatRelativeTime, formatDuration, truncateText } from "./format"

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

describe("formatDuration", () => {
  it("shows minutes only when under an hour", () => {
    expect(formatDuration(30 * 60)).toBe("30m")
    expect(formatDuration(60)).toBe("1m")
  })

  it("shows hours and minutes when under a day", () => {
    expect(formatDuration(90 * 60)).toBe("1h 30m")
    expect(formatDuration(23 * 3600 + 59 * 60)).toBe("23h 59m")
  })

  it("shows days, hours and minutes", () => {
    expect(formatDuration(26 * 3600 + 30 * 60)).toBe("1d 2h 30m")
  })

  it("drops units that are zero", () => {
    expect(formatDuration(3600)).toBe("1h")
    expect(formatDuration(86400)).toBe("1d")
    expect(formatDuration(86400 + 30 * 60)).toBe("1d 30m")
    expect(formatDuration(2 * 86400 + 3 * 3600)).toBe("2d 3h")
  })

  it("rounds to the nearest minute", () => {
    expect(formatDuration(89)).toBe("1m")
    expect(formatDuration(150)).toBe("3m")
    expect(formatDuration(3599)).toBe("1h")
  })

  it("shows <1m for tiny, negative or invalid values", () => {
    expect(formatDuration(0)).toBe("<1m")
    expect(formatDuration(20)).toBe("<1m")
    expect(formatDuration(-5)).toBe("<1m")
    expect(formatDuration(Number.NaN)).toBe("<1m")
  })
})

describe("truncateText", () => {
  it("returns a 30-character string unchanged", () => {
    const exact = "a".repeat(30)
    expect(truncateText(exact)).toBe(exact)
    expect(truncateText(exact)).toHaveLength(30)
  })

  it("returns a string under 30 characters unchanged", () => {
    expect(truncateText("Short title")).toBe("Short title")
  })

  it("truncates strings over 30 characters to 30 chars plus a single ellipsis", () => {
    const long = "This is a long ticket title that exceeds thirty characters"
    const result = truncateText(long)
    expect(result).toBe(long.slice(0, 30) + "…")
    expect(result).toHaveLength(31)
    expect(result.endsWith("…")).toBe(true)
    expect(result.endsWith("……")).toBe(false)
  })

  it("returns an empty string unchanged", () => {
    expect(truncateText("")).toBe("")
  })

  it("respects a custom maxLength", () => {
    expect(truncateText("abcdef", 3)).toBe("abc…")
    expect(truncateText("abc", 3)).toBe("abc")
  })
})
