import { Inter, Outfit } from "next/font/google"
import localFont from "next/font/local"
import { GeistMono } from "geist/font/mono"

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

export { GeistMono }

// Goes on <html> (root layout and global-error), so --font-inter, --font-nudica,
// --font-geist-mono and --font-outfit exist on :root and the theme variables
// built from them (--font-sans, --font-display, --font-mono) resolve there.
export const fontVariables = `${inter.variable} ${nudica.variable} ${GeistMono.variable} ${outfit.variable}`
