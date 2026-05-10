import { describe, it, expect } from "vitest"
import { cn } from "../utils"

describe("cn", () => {
  it("merges multiple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes", () => {
    expect(cn("base", false && "skipped", "included")).toBe("base included")
    expect(cn("base", true && "added")).toBe("base added")
  })

  it("handles undefined and null inputs", () => {
    expect(cn(undefined, null, "valid")).toBe("valid")
    expect(cn(undefined)).toBe("")
  })

  it("merges conflicting tailwind classes, keeping the last one", () => {
    expect(cn("p-4", "p-2")).toBe("p-2")
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })

  it("handles object syntax", () => {
    expect(cn({ "font-bold": true, "italic": false })).toBe("font-bold")
  })

  it("handles array inputs", () => {
    expect(cn(["flex", "items-center"])).toBe("flex items-center")
  })
})
