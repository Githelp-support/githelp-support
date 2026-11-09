import { Inter, Outfit } from "next/font/google"
import localFont from "next/font/local"

// Two body faces, picked by size (see the "Font by size" rules in globals.css):
// Inter for text at 15px and below, Nudica for 16px and above.

// Inter is variable: every weight the app uses (400/450/500/600) renders from one file.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

// Nudica is a static family (files in src/fonts/nudica, license alongside).
// It ships Regular, Medium and Bold only, so the weight ranges below map the
// app's 450 to Regular, 550 (font-subtitle) to Medium and 600 to Bold.
const nudica = localFont({
  src: [
    { path: "../fonts/nudica/nudica-regular-webfont.woff2", weight: "400 450", style: "normal" },
    { path: "../fonts/nudica/nudica-regularitalic-webfont.woff2", weight: "400 450", style: "italic" },
    { path: "../fonts/nudica/nudica-medium-webfont.woff2", weight: "500 599", style: "normal" },
    { path: "../fonts/nudica/nudica-mediumitalic-webfont.woff2", weight: "500 599", style: "italic" },
    { path: "../fonts/nudica/nudica-bold-webfont.woff2", weight: "600 700", style: "normal" },
    { path: "../fonts/nudica/nudica-bolditalic-webfont.woff2", weight: "600 700", style: "italic" },
  ],
  variable: "--font-nudica",
  display: "swap",
})

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-outfit",
})

// Geist Mono is declared here, from the woff2 the `geist` package ships, instead
// of importing `GeistMono` from "geist/font/mono": the package's own fallback
// list starts with ui-monospace and SFMono-Regular, which would put San Francisco
// Mono back into every mono stack. Same file, variable and weight range.
export const GeistMono = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  adjustFontFallback: false,
  fallback: ["Menlo", "Consolas", "monospace"],
})

// Goes on <html> (root layout and global-error), so --font-inter, --font-nudica,
// --font-geist-mono and --font-outfit exist on :root and the theme variables
// built from them (--font-sans, --font-display, --font-mono) resolve there.
export const fontVariables = `${inter.variable} ${nudica.variable} ${GeistMono.variable} ${outfit.variable}`
