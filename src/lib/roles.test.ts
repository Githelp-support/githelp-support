import { describe, it, expect } from "vitest"
import { pickProjectForRole } from "./roles"

describe("pickProjectForRole", () => {
  it("prefers the project last used in that role", () => {
    expect(pickProjectForRole(["a", "b", "c"], "b", "c")).toBe("b")
  })

  it("falls back to the selected project when the last-used one no longer qualifies", () => {
    expect(pickProjectForRole(["a", "c"], "b", "c")).toBe("c")
  })

  it("falls back to the first qualifying project", () => {
    expect(pickProjectForRole(["a", "c"], null, "x")).toBe("a")
  })

  it("returns null when the role is held nowhere", () => {
    expect(pickProjectForRole([], "b", "c")).toBeNull()
  })
})
