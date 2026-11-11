import { describe, it, expect } from "vitest"
import {
  getAvailableContributors,
  getExcludedGithubLogins,
  type ExcludableInvite,
} from "./helper-contributors"

// Mirrors the page's isPendingInvite for single-use GitHub invites:
// active and never used.
const isPending = (invite: ExcludableInvite) => invite.is_active && invite.uses_count === 0

const contributors = [
  { login: "Alice", id: 1, contributions: 10 },
  { login: "bob", id: 2, contributions: 5 },
  { login: "carol", id: 3, contributions: 2 },
  { login: "dave", id: 4, contributions: 1 },
]

function invite(github_username: string, is_active: boolean, uses_count: number): ExcludableInvite {
  return { github_username, is_active, uses_count }
}

describe("getExcludedGithubLogins", () => {
  it("excludes a pending invite", () => {
    const excluded = getExcludedGithubLogins([invite("bob", true, 0)], [], isPending)
    expect(excluded.has("bob")).toBe(true)
  })

  it("excludes an accepted invite", () => {
    const excluded = getExcludedGithubLogins([invite("carol", false, 1)], [], isPending)
    expect(excluded.has("carol")).toBe(true)
  })

  it("excludes an existing helper", () => {
    const excluded = getExcludedGithubLogins([], [{ user: { username: "dave" } }], isPending)
    expect(excluded.has("dave")).toBe(true)
  })

  it("keeps a revoked, never-used invite so the contributor can be re-invited", () => {
    const excluded = getExcludedGithubLogins([invite("bob", false, 0)], [], isPending)
    expect(excluded.has("bob")).toBe(false)
    expect(excluded.size).toBe(0)
  })

  it("ignores invites without a GitHub username and helpers without a user", () => {
    const excluded = getExcludedGithubLogins(
      [{ github_username: null, is_active: true, uses_count: 0 }],
      [{ user: null }, { user: { username: null } }],
      isPending
    )
    expect(excluded.size).toBe(0)
  })

  it("lower-cases logins", () => {
    const excluded = getExcludedGithubLogins(
      [invite("ALICE", true, 0)],
      [{ user: { username: "Dave" } }],
      isPending
    )
    expect([...excluded].sort()).toEqual(["alice", "dave"])
  })
})

describe("getAvailableContributors", () => {
  it("filters out excluded logins", () => {
    const available = getAvailableContributors(contributors, new Set(["bob", "dave"]))
    expect(available.map((c) => c.login)).toEqual(["Alice", "carol"])
  })

  it("matches case-insensitively", () => {
    const available = getAvailableContributors(contributors, new Set(["alice"]))
    expect(available.map((c) => c.login)).toEqual(["bob", "carol", "dave"])
  })

  it("returns everyone when nothing is excluded", () => {
    expect(getAvailableContributors(contributors, new Set())).toEqual(contributors)
  })

  it("returns an empty list when every contributor is excluded", () => {
    const all = new Set(contributors.map((c) => c.login.toLowerCase()))
    expect(getAvailableContributors(contributors, all)).toEqual([])
  })

  it("works end to end with the exclusion set", () => {
    const excluded = getExcludedGithubLogins(
      [
        invite("Alice", true, 0), // pending
        invite("bob", false, 1), // accepted, then deactivated
        invite("carol", false, 0), // revoked, never used
      ],
      [{ user: { username: "dave" } }],
      isPending
    )
    expect(getAvailableContributors(contributors, excluded).map((c) => c.login)).toEqual(["carol"])
  })
})
