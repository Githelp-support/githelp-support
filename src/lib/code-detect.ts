/**
 * Async language detection for code blocks.
 *
 * `detectLanguage` in `code-blocks.ts` is a fast, synchronous heuristic used
 * where we can't wait (the paste handler). It only answers when a snippet
 * carries obvious markers, so plenty of ordinary code (a bare object literal,
 * a `return new Response(...)`) comes back untagged and would render without
 * colours.
 *
 * This module is the second opinion: highlight.js's statistical detector,
 * run over a curated set of grammars. It is loaded on demand — the grammars
 * are a few hundred KB — and its answer is mapped to the Prism ids the
 * renderer uses.
 */

import { CONFIDENT_SCORE, detectLanguage, scoreLanguages } from "./code-blocks"

type HljsCore = typeof import("highlight.js/lib/core").default

/** hljs grammar name → loader. Keys are the names passed to `highlightAuto`. */
const GRAMMARS: Record<string, () => Promise<{ default: unknown }>> = {
    javascript: () => import("highlight.js/lib/languages/javascript"),
    typescript: () => import("highlight.js/lib/languages/typescript"),
    python: () => import("highlight.js/lib/languages/python"),
    json: () => import("highlight.js/lib/languages/json"),
    xml: () => import("highlight.js/lib/languages/xml"),
    css: () => import("highlight.js/lib/languages/css"),
    scss: () => import("highlight.js/lib/languages/scss"),
    sql: () => import("highlight.js/lib/languages/sql"),
    bash: () => import("highlight.js/lib/languages/bash"),
    shell: () => import("highlight.js/lib/languages/shell"),
    go: () => import("highlight.js/lib/languages/go"),
    java: () => import("highlight.js/lib/languages/java"),
    csharp: () => import("highlight.js/lib/languages/csharp"),
    php: () => import("highlight.js/lib/languages/php"),
    ruby: () => import("highlight.js/lib/languages/ruby"),
    rust: () => import("highlight.js/lib/languages/rust"),
    yaml: () => import("highlight.js/lib/languages/yaml"),
    diff: () => import("highlight.js/lib/languages/diff"),
    kotlin: () => import("highlight.js/lib/languages/kotlin"),
    swift: () => import("highlight.js/lib/languages/swift"),
    cpp: () => import("highlight.js/lib/languages/cpp"),
    c: () => import("highlight.js/lib/languages/c"),
    dockerfile: () => import("highlight.js/lib/languages/dockerfile"),
    ini: () => import("highlight.js/lib/languages/ini"),
}

/** hljs name → Prism id used by the renderer. Missing entries map 1:1. */
const HLJS_TO_PRISM: Record<string, string> = {
    xml: "markup",
    shell: "bash",
    dockerfile: "docker",
}

/**
 * Minimum combined score (hljs relevance + heuristic markers) for a guess to
 * count. Prose typically lands at 0–2; real code of any length clears this.
 */
const MIN_SCORE = 5

/**
 * Which heuristic buckets feed each hljs language. TypeScript is a superset
 * of JavaScript so it inherits the JS markers; the JSX bucket feeds JS.
 */
function heuristicBonus(hljsLang: string, scores: Record<string, number>): number {
    const prism = HLJS_TO_PRISM[hljsLang] ?? hljsLang
    switch (prism) {
        case "javascript":
            return (scores.javascript ?? 0) + (scores.jsx ?? 0)
        case "typescript":
            return (scores.typescript ?? 0) + (scores.javascript ?? 0)
        default:
            return scores[prism] ?? 0
    }
}

let hljsPromise: Promise<HljsCore> | null = null

function loadHljs(): Promise<HljsCore> {
    if (!hljsPromise) {
        hljsPromise = (async () => {
            const [{ default: hljs }, ...grammars] = await Promise.all([
                import("highlight.js/lib/core"),
                ...Object.values(GRAMMARS).map((load) => load()),
            ])
            Object.keys(GRAMMARS).forEach((name, i) => {
                hljs.registerLanguage(name, grammars[i].default as Parameters<HljsCore["registerLanguage"]>[1])
            })
            return hljs
        })()
    }
    return hljsPromise
}

/**
 * Statistical detection: highlight.js relevance per grammar, blended with the
 * regex heuristic so near-ties (hljs rates a JS object literal as Go 10 vs
 * JS 9) resolve towards the language whose markers are actually present.
 * Returns a Prism language id, or "" when nothing scores high enough.
 * Never throws.
 */
export async function detectLanguageWithHljs(code: string): Promise<string> {
    if (code.trim().length < 8) return ""
    try {
        const hljs = await loadHljs()
        const heuristics = scoreLanguages(code)
        let best = ""
        let bestScore = 0
        // Iteration order doubles as the tie-break: JavaScript before TypeScript.
        for (const name of Object.keys(GRAMMARS)) {
            let relevance = 0
            try {
                relevance = hljs.highlight(code, { language: name, ignoreIllegals: true }).relevance
            } catch {
                continue
            }
            const score = relevance + heuristicBonus(name, heuristics)
            if (score > bestScore) {
                best = name
                bestScore = score
            }
        }
        if (!best || bestScore < MIN_SCORE) return ""
        return HLJS_TO_PRISM[best] ?? best
    } catch {
        return ""
    }
}

/**
 * Best-effort language detection: the fast heuristic when it is confident,
 * otherwise highlight.js. Returns "" when neither is sure.
 */
export async function detectLanguageAsync(code: string): Promise<string> {
    const quick = detectLanguage(code)
    if (quick.language && quick.score >= CONFIDENT_SCORE) return quick.language
    return detectLanguageWithHljs(code)
}
