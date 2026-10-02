import { describe, it, expect } from "vitest"
import { isSafeClientRedirect, safeRelativeRedirect } from "./safe-redirect"

describe("safeRelativeRedirect", () => {
  it("keeps same-origin paths", () => {
    expect(safeRelativeRedirect("/oauth/consent?authorization_id=abc")).toBe("/oauth/consent?authorization_id=abc")
    expect(safeRelativeRedirect("/support/chat")).toBe("/support/chat")
  })

  it("reduces a same-origin full URL to its path", () => {
    expect(safeRelativeRedirect("https://app.test/support/chat?slug=x#m", "https://app.test")).toBe("/support/chat?slug=x#m")
    expect(safeRelativeRedirect("https://evil.example/support", "https://app.test")).toBeNull()
  })

  it("drops anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/a\nb", "", null]) {
      expect(safeRelativeRedirect(bad)).toBeNull()
    }
  })
})

describe("isSafeClientRedirect", () => {
  it("allows web and native app callbacks", () => {
    expect(isSafeClientRedirect("http://localhost:33418/callback?code=x")).toBe(true)
    expect(isSafeClientRedirect("https://claude.ai/api/mcp/auth_callback?code=x")).toBe(true)
    expect(isSafeClientRedirect("cursor://anysphere.cursor-mcp/oauth/callback?code=x")).toBe(true)
  })

  it("refuses script and local schemes", () => {
    expect(isSafeClientRedirect("javascript:alert(1)")).toBe(false)
    expect(isSafeClientRedirect("data:text/html,hi")).toBe(false)
    expect(isSafeClientRedirect("not a url")).toBe(false)
  })
})
