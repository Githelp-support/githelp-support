import { describe, it, expect } from "vitest"
import { cn } from "./utils"

describe("cn", () => {
  it("keeps the custom type-scale classes next to a text colour", () => {
    expect(cn("text-ui text-foreground")).toBe("text-ui text-foreground")
    expect(cn("text-title", "text-muted-foreground")).toBe("text-title text-muted-foreground")
  })

  it("still lets a later font size win over an earlier one", () => {
    expect(cn("text-sm", "text-ui")).toBe("text-ui")
    expect(cn("text-ui", "text-stat")).toBe("text-stat")
  })

  it("keeps the shadow and duration tokens", () => {
    expect(cn("shadow-soft bg-card")).toBe("shadow-soft bg-card")
    expect(cn("duration-fast ease-out")).toBe("duration-fast ease-out")
    expect(cn("duration-fast", "duration-slow")).toBe("duration-slow")
  })
})
