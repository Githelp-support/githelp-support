import { describe, it, expect } from "vitest"
import { homeRouteForRole } from "./roles"

describe("homeRouteForRole", () => {
  it("sends admins to the dashboard", () => {
    expect(homeRouteForRole("admin")).toBe("/")
  })

  it("sends helpers to the helper overview", () => {
    expect(homeRouteForRole("helper")).toBe("/helper/overview")
  })

  it("sends plain users to support tickets", () => {
    expect(homeRouteForRole("user")).toBe("/support/tickets")
  })
})
