import { describe, expect, it } from "vitest"
import { demandPagePath, dollarsToCents, formatUsd, parseRepoRef } from "./repo"

describe("parseRepoRef", () => {
  it("understands the usual GitHub references", () => {
    expect(parseRepoRef("https://github.com/Owner/Repo")).toBe("owner/repo")
    expect(parseRepoRef("https://github.com/owner/repo.git")).toBe("owner/repo")
    expect(parseRepoRef("https://github.com/owner/repo/tree/main/src")).toBe("owner/repo")
    expect(parseRepoRef("git@github.com:owner/repo.git")).toBe("owner/repo")
    expect(parseRepoRef("github.com/owner/repo/")).toBe("owner/repo")
    expect(parseRepoRef("owner/repo")).toBe("owner/repo")
  })

  it("rejects anything else", () => {
    for (const bad of ["", null, undefined, "not a repo", "https://gitlab.com/a/b", "owner/..", "a b/c"]) {
      expect(parseRepoRef(bad)).toBeNull()
    }
  })
})

describe("helpers", () => {
  it("builds the demand page path", () => {
    expect(demandPagePath("vercel/next.js")).toBe("/r/vercel/next.js")
  })

  it("converts dollars to cents and back", () => {
    expect(dollarsToCents("")).toBeNull()
    expect(dollarsToCents("25")).toBe(2500)
    expect(dollarsToCents("25.5")).toBe(2550)
    expect(Number.isNaN(dollarsToCents("1e3") as number)).toBe(true)
    expect(Number.isNaN(dollarsToCents("12345678") as number)).toBe(true)
    expect(formatUsd(1250)).toBe("$12.50")
  })
})
