import { describe, it, expect } from "vitest"
import { SQUIRCLE_RADIUS, squircleRadiusClass } from "./constants"

describe("squircle radius map", () => {
  it("keeps GitHelp's proportional corner (about 34% of the size) for every avatar/tile size", () => {
    expect(SQUIRCLE_RADIUS[20]).toBe("rounded-[7px]")
    expect(SQUIRCLE_RADIUS[22]).toBe("rounded-[8px]")
    expect(SQUIRCLE_RADIUS[24]).toBe("rounded-[8px]")
    expect(SQUIRCLE_RADIUS[28]).toBe("rounded-[10px]")
    expect(SQUIRCLE_RADIUS[32]).toBe("rounded-[11px]")
    expect(SQUIRCLE_RADIUS[42]).toBe("rounded-[14px]")
    expect(SQUIRCLE_RADIUS[48]).toBe("rounded-[16.5px]")
  })

  it("falls back to the 9px radius used by the project switcher for unknown sizes", () => {
    expect(squircleRadiusClass(26)).toBe("rounded-[9px]")
    expect(squircleRadiusClass(32)).toBe("rounded-[11px]")
  })
})
