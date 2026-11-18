"use client"

// Dev-only panel for trying accent colour schemes live. It sets the eight
// accent variables from globals.css as inline custom properties on <html>.
// Mounted from the root layout behind NEXT_PUBLIC_COLOUR_TESTER (see
// next.config.ts); never part of a production build.
//
// Deliberately self-contained: no app UI primitives and no brand/tint/link
// classes, so the scheme under test cannot restyle the panel itself.

import { useEffect, useRef, useState } from "react"

export const STORAGE_KEY = "githelp:colour-scheme-tester"

export const VARIABLES = [
  "brand",
  "brand-text",
  "brand-hover",
  "tile-from",
  "tile-to",
  "tint",
  "tint-text",
  "link",
] as const

export type VariableName = (typeof VARIABLES)[number]
export type SchemeValues = Record<VariableName, string>

const HEX = /^#[0-9a-fA-F]{6}$/

/** The :root defaults from globals.css. `tint` is the solid equivalent of the 10% tint on white. */
export const DEFAULT_VALUES: SchemeValues = {
  brand: "#554ABF",
  "brand-text": "#FFFFFF",
  "brand-hover": "#4A3FA3",
  "tile-from": "#554ABF",
  "tile-to": "#554ABF",
  tint: "#EEEDF9",
  "tint-text": "#554ABF",
  link: "#554ABF",
}

export const PRESETS: { id: string; label: string; values: SchemeValues }[] = [
  { id: "current", label: "Current", values: DEFAULT_VALUES },
  {
    id: "deep-lagoon",
    label: "Deep lagoon",
    values: {
      brand: "#156468",
      "brand-text": "#FFFFFF",
      "brand-hover": "#105558",
      "tile-from": "#1E8489",
      "tile-to": "#00A6AD",
      tint: "#DEF6F7",
      "tint-text": "#005256",
      link: "#156468",
    },
  },
  {
    id: "petrol",
    label: "Petrol",
    values: {
      brand: "#146276",
      "brand-text": "#FFFFFF",
      "brand-hover": "#105364",
      "tile-from": "#1E819A",
      "tile-to": "#00A2C5",
      tint: "#DFF5FC",
      "tint-text": "#005063",
      link: "#146276",
    },
  },
  {
    id: "harbour-blue",
    label: "Harbour blue",
    values: {
      brand: "#145E88",
      "brand-text": "#FFFFFF",
      "brand-hover": "#0F5074",
      "tile-from": "#1D7CB2",
      "tile-to": "#009CE4",
      tint: "#E2F3FF",
      "tint-text": "#004D74",
      link: "#145E88",
    },
  },
  {
    id: "periwinkle",
    label: "Periwinkle",
    values: {
      brand: "#A0AAF9",
      "brand-text": "#191259",
      "brand-hover": "#8E97F8",
      "tile-from": "#8A93FA",
      "tile-to": "#AEB8FF",
      tint: "#EEF1FF",
      "tint-text": "#3D2FB6",
      link: "#3D2FB6",
    },
  },
  {
    id: "hyacinth",
    label: "Hyacinth",
    values: {
      brand: "#B6A1F9",
      "brand-text": "#280A54",
      "brand-hover": "#A88CF8",
      "tile-from": "#A586FA",
      "tile-to": "#C1B0FF",
      tint: "#F2EFFF",
      "tint-text": "#5921AC",
      link: "#5921AC",
    },
  },
]

type Stored = { preset: string; values: SchemeValues }

function readStored(): Stored | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null
    const { preset, values } = parsed as { preset?: unknown; values?: unknown }
    if (typeof preset !== "string" || !PRESETS.some((p) => p.id === preset)) return null
    if (typeof values !== "object" || values === null) return null
    const record = values as Record<string, unknown>
    const result = {} as SchemeValues
    for (const name of VARIABLES) {
      const value = record[name]
      if (typeof value !== "string" || !HEX.test(value)) return null
      result[name] = value
    }
    return { preset, values: result }
  } catch {
    return null
  }
}

function writeStored(state: Stored) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable (private mode, quota): the scheme still applies for this page.
  }
}

function clearStored() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Sets the inline variables on <html>. Under "Current" a field still showing
 * its default is left to globals.css, so only the edited variables are overridden
 * (the default tint is translucent, its hex here is only an approximation).
 */
function applyScheme(preset: string, values: SchemeValues) {
  const style = document.documentElement.style
  for (const name of VARIABLES) {
    const untouchedDefault =
      preset === "current" && values[name].toUpperCase() === DEFAULT_VALUES[name].toUpperCase()
    if (untouchedDefault) style.removeProperty(`--${name}`)
    else style.setProperty(`--${name}`, values[name])
  }
}

function removeScheme() {
  const style = document.documentElement.style
  for (const name of VARIABLES) style.removeProperty(`--${name}`)
}

const focusRing =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
const buttonClass = `h-7 rounded-md border border-neutral-300 bg-white px-2 text-xs font-medium text-neutral-900 hover:bg-neutral-100 active:bg-neutral-200 ${focusRing}`

export function ColourSchemeTester() {
  // Lazy initialisers: the component is loaded client-only (ssr: false), and
  // readStored() returns null on the server anyway.
  const [initial] = useState(readStored)
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState(initial?.preset ?? "current")
  // `applied` holds the last valid value per variable; `text` is what the inputs show.
  const [applied, setApplied] = useState<SchemeValues>(initial?.values ?? DEFAULT_VALUES)
  const [text, setText] = useState<SchemeValues>(initial?.values ?? DEFAULT_VALUES)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (initial) applyScheme(initial.preset, initial.values)
  }, [initial])

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
  }, [])

  function selectPreset(id: string) {
    const next = PRESETS.find((p) => p.id === id)
    if (!next) return
    setPreset(next.id)
    setApplied(next.values)
    setText(next.values)
    if (next.id === "current") {
      removeScheme()
      clearStored()
    } else {
      applyScheme(next.id, next.values)
      writeStored({ preset: next.id, values: next.values })
    }
  }

  function editValue(name: VariableName, value: string) {
    setText((prev) => ({ ...prev, [name]: value }))
    const trimmed = value.trim()
    if (!HEX.test(trimmed)) return
    const next = { ...applied, [name]: trimmed }
    setApplied(next)
    document.documentElement.style.setProperty(`--${name}`, trimmed)
    writeStored({ preset, values: next })
  }

  async function copyJson() {
    const payload = Object.fromEntries(VARIABLES.map((name) => [`--${name}`, applied[name]]))
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    } catch {
      return
    }
    setCopied(true)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), 1500)
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open colour scheme tester"
        aria-expanded={false}
        onClick={() => setOpen(true)}
        className={`fixed bottom-4 right-4 z-[9999] h-8 rounded-md border border-neutral-300 bg-white px-3 font-sans text-xs font-medium text-neutral-900 shadow-lg hover:bg-neutral-100 active:bg-neutral-200 ${focusRing}`}
      >
        Colours
      </button>
    )
  }

  return (
    <section
      aria-label="Colour scheme tester"
      className="fixed bottom-4 right-4 z-[9999] w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-neutral-300 bg-white p-3 font-sans text-xs text-neutral-900 shadow-lg"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold">Colour scheme tester</h2>
        <button
          type="button"
          aria-label="Collapse colour scheme tester"
          aria-expanded={true}
          onClick={() => setOpen(false)}
          className={buttonClass}
        >
          Close
        </button>
      </div>

      <label className="mb-3 flex items-center justify-between gap-2">
        <span className="font-medium">Preset</span>
        <select
          aria-label="Preset"
          value={preset}
          onChange={(event) => selectPreset(event.target.value)}
          className={`h-7 w-40 rounded-md border border-neutral-300 bg-white px-1 text-xs text-neutral-900 ${focusRing}`}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <ul className="space-y-1.5">
        {VARIABLES.map((name) => {
          const invalid = !HEX.test(text[name].trim())
          return (
            <li key={name} className="flex items-center gap-2">
              <label htmlFor={`colour-tester-${name}`} className="flex-1 font-mono text-neutral-700">
                {name}
              </label>
              <span
                aria-hidden="true"
                data-testid={`swatch-${name}`}
                className="size-5 shrink-0 rounded-sm border border-neutral-300"
                style={{ backgroundColor: applied[name] }}
              />
              <input
                id={`colour-tester-${name}`}
                type="text"
                aria-label={`${name} hex value`}
                aria-invalid={invalid}
                value={text[name]}
                onChange={(event) => editValue(name, event.target.value)}
                maxLength={7}
                spellCheck={false}
                autoComplete="off"
                className={`h-7 w-20 rounded-md border bg-white px-1.5 font-mono text-xs text-neutral-900 ${invalid ? "border-neutral-900" : "border-neutral-300"} ${focusRing}`}
              />
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex items-center justify-end gap-2">
        <span aria-live="polite" className="mr-auto text-neutral-600">
          {copied ? "Copied" : ""}
        </span>
        <button type="button" onClick={() => selectPreset("current")} className={buttonClass}>
          Reset
        </button>
        <button type="button" onClick={copyJson} className={buttonClass}>
          Copy as JSON
        </button>
      </div>
    </section>
  )
}

export default ColourSchemeTester
