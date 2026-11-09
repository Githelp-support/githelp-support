import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, it, expect } from "vitest"
import { avatarColorsHex, getAvatarColorHexForId } from "./constants"

/**
 * Light-mode `--avatar-N` tokens from globals.css, indexed 1..9.
 * Only the `:root` block is read so the `.dark` overrides are not mixed in.
 */
function readLightModeAvatarTokens(): string[] {
  const css = readFileSync(
    path.resolve(__dirname, "../app/globals.css"),
    "utf8"
  )
  const rootStart = css.indexOf(":root {")
  const darkStart = css.indexOf(".dark {", rootStart)
  expect(rootStart).toBeGreaterThan(-1)
  expect(darkStart).toBeGreaterThan(rootStart)

  const lightBlock = css.slice(rootStart, darkStart)
  const tokens: string[] = []
  for (let n = 1; n <= 9; n++) {
    const match = lightBlock.match(new RegExp(`--avatar-${n}:\\s*(#[0-9a-fA-F]{6})\\s*;`))
    expect(match, `--avatar-${n} is defined in the :root block`).not.toBeNull()
    tokens.push(match![1].toLowerCase())
  }
  return tokens
}

describe("avatar colour contract", () => {
  it("returns the same hex for the same id regardless of call site", () => {
    const id = "user_8f3a2c1d-helper"
    const fromChart = getAvatarColorHexForId(id)
    const fromList = getAvatarColorHexForId(id)
    const fromDrawer = getAvatarColorHexForId(` ${id} `)

    expect(fromList).toBe(fromChart)
    expect(fromDrawer).toBe(fromChart)
    expect(avatarColorsHex).toContain(fromChart)
  })

  it("returns a different hex for a different id", () => {
    expect(getAvatarColorHexForId("a")).not.toBe(getAvatarColorHexForId("b"))
    expect(getAvatarColorHexForId("helper-1")).not.toBe(getAvatarColorHexForId("helper-2"))
  })

  it("keeps avatarColorsHex in sync with the --avatar-N light-mode tokens in globals.css", () => {
    const tokens = readLightModeAvatarTokens()

    expect(tokens).toHaveLength(9)
    expect(avatarColorsHex).toHaveLength(9)
    expect(avatarColorsHex.map((hex) => hex.toLowerCase())).toEqual(tokens)
  })
})
