"use client"

import dynamic from "next/dynamic"

// NEXT_PUBLIC_COLOUR_TESTER is inlined at build time (next.config.ts). In a
// production build the condition is the literal `false`, so the import() below
// is dead code and the tester chunk is never emitted.
const ColourSchemeTester =
  process.env.NEXT_PUBLIC_COLOUR_TESTER === "true"
    ? dynamic(() => import("./colour-scheme-tester"), { ssr: false })
    : null

export function ColourSchemeTesterLoader() {
  return ColourSchemeTester ? <ColourSchemeTester /> : null
}
