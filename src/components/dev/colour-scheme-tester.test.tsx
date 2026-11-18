import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import {
  ColourSchemeTester,
  DEFAULT_VALUES,
  PRESETS,
  STORAGE_KEY,
  VARIABLES,
} from "./colour-scheme-tester"

const rootVar = (name: string) => document.documentElement.style.getPropertyValue(`--${name}`)

function openPanel() {
  render(<ColourSchemeTester />)
  fireEvent.click(screen.getByRole("button", { name: "Open colour scheme tester" }))
}

const hexInput = (name: string) => screen.getByLabelText(`${name} hex value`) as HTMLInputElement

describe("ColourSchemeTester", () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute("style")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("is collapsed by default and shows the default hexes for Current", () => {
    render(<ColourSchemeTester />)
    expect(screen.queryByLabelText("Preset")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Open colour scheme tester" }))
    expect(screen.getByLabelText("Preset")).toHaveValue("current")
    for (const name of VARIABLES) {
      expect(hexInput(name).value).toBe(DEFAULT_VALUES[name])
      expect(rootVar(name)).toBe("")
    }
  })

  it("ignores an invalid hex and keeps the last valid value applied", () => {
    openPanel()
    fireEvent.change(hexInput("brand"), { target: { value: "#112233" } })
    expect(rootVar("brand")).toBe("#112233")

    for (const bad of ["#11223", "#GGGGGG", "112233", "#1122334", ""]) {
      fireEvent.change(hexInput("brand"), { target: { value: bad } })
      expect(hexInput("brand").value).toBe(bad)
      expect(rootVar("brand")).toBe("#112233")
    }
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).values.brand).toBe("#112233")
  })

  it("sets the variable on documentElement for a valid hex", () => {
    openPanel()
    fireEvent.change(hexInput("link"), { target: { value: "#0a7B3c" } })
    expect(rootVar("link")).toBe("#0a7B3c")
    // Untouched variables stay with the globals.css defaults.
    expect(rootVar("brand")).toBe("")
  })

  it("applies all eight variables when a preset is selected", () => {
    openPanel()
    const preset = PRESETS.find((p) => p.id === "petrol")!
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "petrol" } })

    for (const name of VARIABLES) {
      expect(rootVar(name)).toBe(preset.values[name])
      expect(hexInput(name).value).toBe(preset.values[name])
    }
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({
      preset: "petrol",
      values: preset.values,
    })
  })

  it("offers Current plus the five presets", () => {
    openPanel()
    const options = Array.from(screen.getByLabelText("Preset").querySelectorAll("option")).map(
      (o) => o.textContent,
    )
    expect(options).toEqual(["Current", "Deep lagoon", "Petrol", "Harbour blue", "Periwinkle", "Hyacinth"])
    for (const preset of PRESETS) {
      for (const name of VARIABLES) expect(preset.values[name]).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it("Reset removes all eight variables and clears the stored state", () => {
    openPanel()
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "hyacinth" } })
    expect(rootVar("brand")).not.toBe("")

    fireEvent.click(screen.getByRole("button", { name: "Reset" }))
    for (const name of VARIABLES) {
      expect(rootVar(name)).toBe("")
      expect(hexInput(name).value).toBe(DEFAULT_VALUES[name])
    }
    expect(screen.getByLabelText("Preset")).toHaveValue("current")
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("selecting Current removes the variables as well", () => {
    openPanel()
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "periwinkle" } })
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "current" } })
    for (const name of VARIABLES) expect(rootVar(name)).toBe("")
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("restores and applies the stored state on mount", () => {
    const values = { ...PRESETS.find((p) => p.id === "harbour-blue")!.values, brand: "#123456" }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset: "harbour-blue", values }))

    openPanel()
    expect(screen.getByLabelText("Preset")).toHaveValue("harbour-blue")
    for (const name of VARIABLES) {
      expect(rootVar(name)).toBe(values[name])
      expect(hexInput(name).value).toBe(values[name])
    }
  })

  it("falls back to Current when the stored state is malformed", () => {
    for (const raw of ["{not json", "null", '{"preset":"petrol"}', '{"preset":"nope","values":{}}']) {
      window.localStorage.setItem(STORAGE_KEY, raw)
      const { unmount } = render(<ColourSchemeTester />)
      for (const name of VARIABLES) expect(rootVar(name)).toBe("")
      unmount()
    }
  })

  it("copies the current eight values as JSON keyed by variable name", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })

    openPanel()
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "deep-lagoon" } })
    fireEvent.change(hexInput("link"), { target: { value: "#010203" } })
    // An unfinished edit exports the last valid value.
    fireEvent.change(hexInput("brand"), { target: { value: "#12" } })
    fireEvent.click(screen.getByRole("button", { name: "Copy as JSON" }))

    await waitFor(() => expect(screen.getByText("Copied")).toBeInTheDocument())
    const preset = PRESETS.find((p) => p.id === "deep-lagoon")!
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual({
      "--brand": preset.values.brand,
      "--brand-text": preset.values["brand-text"],
      "--brand-hover": preset.values["brand-hover"],
      "--tile-from": preset.values["tile-from"],
      "--tile-to": preset.values["tile-to"],
      "--tint": preset.values.tint,
      "--tint-text": preset.values["tint-text"],
      "--link": "#010203",
    })
  })
})
