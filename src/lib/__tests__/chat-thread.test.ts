import { describe, it, expect } from "vitest"
import { buildThreadRows, firstThreadDay, type ThreadItem } from "../chat-thread"

/** Local-time ISO string, so the tests pass in any timezone. */
const at = (day: number, hours: number, minutes: number, seconds = 0) =>
  new Date(2026, 10, day, hours, minutes, seconds).toISOString()

let nextId = 0
const msg = (senderKey: string | null, createdAt?: string | null): ThreadItem => ({
  id: `m${nextId++}`,
  senderKey,
  isSystem: false,
  createdAt,
})
const sys = (createdAt?: string | null): ThreadItem => ({ id: `s${nextId++}`, senderKey: null, isSystem: true, createdAt })

describe("buildThreadRows", () => {
  it("returns one row per item and nothing for an empty thread", () => {
    expect(buildThreadRows([])).toEqual([])
    expect(buildThreadRows([msg("a", at(15, 10, 0)), msg("a", at(15, 10, 1))])).toHaveLength(2)
  })

  it("starts with a day divider and a group on the first dated message", () => {
    const first = msg("a", at(15, 10, 0))
    expect(buildThreadRows([first])).toEqual([
      { showDayDivider: true, dayLabelDate: first.createdAt, isGroupStart: true },
    ])
  })

  it("groups messages from one sender up to and including 5 minutes apart", () => {
    const rows = buildThreadRows([
      msg("a", at(15, 10, 0)),
      msg("a", at(15, 10, 5)), // exactly 5 minutes: continues
      msg("a", at(15, 10, 10, 1)), // 5 minutes and 1 second: new group
    ])
    expect(rows.map((r) => r.isGroupStart)).toEqual([true, false, true])
    expect(rows.map((r) => r.showDayDivider)).toEqual([true, false, false])
  })

  it("measures the 5 minutes from the previous message, not the group start", () => {
    const rows = buildThreadRows([
      msg("a", at(15, 10, 0)),
      msg("a", at(15, 10, 4)),
      msg("a", at(15, 10, 8)),
    ])
    expect(rows.map((r) => r.isGroupStart)).toEqual([true, false, false])
  })

  it("starts a new group for a different sender", () => {
    const rows = buildThreadRows([
      msg("a", at(15, 10, 0)),
      msg("b", at(15, 10, 1)),
      msg("a", at(15, 10, 2)),
    ])
    expect(rows.map((r) => r.isGroupStart)).toEqual([true, true, true])
  })

  it("never groups messages without a sender key", () => {
    const rows = buildThreadRows([msg(null, at(15, 10, 0)), msg(null, at(15, 10, 1))])
    expect(rows.map((r) => r.isGroupStart)).toEqual([true, true])
  })

  it("emits a divider and a new group when the thread crosses midnight", () => {
    const afterMidnight = msg("a", at(16, 0, 1))
    const rows = buildThreadRows([msg("a", at(15, 23, 58)), afterMidnight, msg("a", at(16, 0, 2))])
    expect(rows[1]).toEqual({ showDayDivider: true, dayLabelDate: afterMidnight.createdAt, isGroupStart: true })
    expect(rows[2]).toEqual({ showDayDivider: false, isGroupStart: false })
  })

  it("breaks the group at a system message in between", () => {
    const rows = buildThreadRows([
      msg("a", at(15, 10, 0)),
      sys(at(15, 10, 1)),
      msg("a", at(15, 10, 2)),
      msg("a", at(15, 10, 3)),
    ])
    expect(rows.map((r) => r.isGroupStart)).toEqual([true, true, true, false])
  })

  it("always starts a group on a system item, even after another system item", () => {
    const rows = buildThreadRows([sys(at(15, 10, 0)), sys(at(15, 10, 0))])
    expect(rows.map((r) => r.isGroupStart)).toEqual([true, true])
  })

  it("lets a dated system item emit the day divider", () => {
    const note = sys(at(16, 9, 0))
    const rows = buildThreadRows([msg("a", at(15, 10, 0)), note, msg("a", at(16, 9, 1))])
    expect(rows[1]).toEqual({ showDayDivider: true, dayLabelDate: note.createdAt, isGroupStart: true })
    expect(rows[2].showDayDivider).toBe(false)
  })

  it("never emits a divider for undated synthetic messages and never groups them", () => {
    const rows = buildThreadRows([
      sys(), // welcome
      msg("a"), // pending first message
      msg("a", null),
      sys(undefined), // auto-reply
    ])
    expect(rows.every((r) => !r.showDayDivider)).toBe(true)
    expect(rows.every((r) => r.dayLabelDate === undefined)).toBe(true)
    expect(rows.map((r) => r.isGroupStart)).toEqual([true, true, true, true])
  })

  it("lets undated items inherit the current day, so the next dated item on that day has no divider", () => {
    const rows = buildThreadRows([
      msg("a", at(15, 10, 0)),
      msg("a"), // undated: same day, but starts its own group
      msg("a", at(15, 10, 1)), // previous row is undated: starts a group
      msg("a", at(16, 10, 0)),
    ])
    expect(rows.map((r) => r.showDayDivider)).toEqual([true, false, false, true])
    expect(rows.map((r) => r.isGroupStart)).toEqual([true, true, true, true])
  })

  it("treats an unparseable createdAt as undated", () => {
    const rows = buildThreadRows([msg("a", at(15, 10, 0)), msg("a", "not a date")])
    expect(rows[1]).toEqual({ showDayDivider: false, isGroupStart: true })
  })

  it("does not group a message dated before the previous one", () => {
    const rows = buildThreadRows([msg("a", at(15, 10, 5)), msg("a", at(15, 10, 0))])
    expect(rows.map((r) => r.isGroupStart)).toEqual([true, true])
  })

  describe("initialDay", () => {
    it("suppresses the divider for the first dated item on that day", () => {
      const rows = buildThreadRows([sys(), msg("a", at(15, 10, 0))], { initialDay: at(15, 8, 0) })
      expect(rows.map((r) => r.showDayDivider)).toEqual([false, false])
    })

    it("still emits a divider when the first dated item is on another day", () => {
      const first = msg("a", at(16, 10, 0))
      const rows = buildThreadRows([first], { initialDay: at(15, 8, 0) })
      expect(rows[0]).toEqual({ showDayDivider: true, dayLabelDate: first.createdAt, isGroupStart: true })
    })
  })
})

describe("firstThreadDay", () => {
  it("returns the first dated item's createdAt", () => {
    const dated = msg("a", at(15, 10, 0))
    expect(firstThreadDay([sys(), msg("a", null), dated, msg("a", at(16, 10, 0))])).toBe(dated.createdAt)
  })

  it("returns null when nothing is dated", () => {
    expect(firstThreadDay([])).toBeNull()
    expect(firstThreadDay([sys(), msg("a")])).toBeNull()
  })

  it("pairs with buildThreadRows so the thread does not repeat the divider above the intro", () => {
    const items = [sys(), msg("a", at(15, 10, 0)), msg("a", at(15, 10, 1))]
    const rows = buildThreadRows(items, { initialDay: firstThreadDay(items) })
    expect(rows.some((r) => r.showDayDivider)).toBe(false)
  })
})
