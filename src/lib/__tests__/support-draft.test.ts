import { describe, it, expect } from "vitest"
import {
  SUPPORT_DRAFT_MAX_AGE_MS,
  clearSupportDraft,
  registerSupportDraftSource,
  saveRegisteredSupportDraft,
  saveSupportDraft,
  takeSupportDraft,
} from "../support-draft"

function memory() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

describe("support draft", () => {
  it("is restored once per project and then gone (never pre-fills a later composer)", () => {
    const store = memory()
    saveSupportDraft("p1", "my question", store)
    expect(takeSupportDraft("p2", store)).toBeNull()
    expect(takeSupportDraft("p1", store)).toBe("my question")
    expect(takeSupportDraft("p1", store)).toBeNull()
  })

  it("expires after 60 minutes", () => {
    const store = memory()
    const t0 = 1_000_000
    saveSupportDraft("p1", "old", store, () => t0)
    expect(takeSupportDraft("p1", store, () => t0 + SUPPORT_DRAFT_MAX_AGE_MS + 1)).toBeNull()
    expect(store.map.size).toBe(0)
    saveSupportDraft("p1", "fresh", store, () => t0)
    expect(takeSupportDraft("p1", store, () => t0 + SUPPORT_DRAFT_MAX_AGE_MS - 1)).toBe("fresh")
  })

  it("ignores empty text and can be cleared", () => {
    const store = memory()
    saveSupportDraft("p1", "   ", store)
    expect(store.map.size).toBe(0)
    saveSupportDraft("p1", "x", store)
    clearSupportDraft("p1", store)
    expect(takeSupportDraft("p1", store)).toBeNull()
  })

  it("top-bar / sidebar sign-in save the registered composer (localStorage, survives a new tab)", () => {
    window.localStorage.clear()
    registerSupportDraftSource(() => ({ projectId: "p1", text: "typed" }))
    saveRegisteredSupportDraft()
    registerSupportDraftSource(null)
    expect(takeSupportDraft("p1")).toBe("typed")
  })
})
