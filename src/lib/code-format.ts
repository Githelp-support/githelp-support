/**
 * Formats code blocks in outgoing chat messages so shared code looks the
 * same for everyone regardless of how it was indented when pasted.
 *
 * Languages prettier understands (JS/TS/JSX/TSX, JSON, CSS/SCSS/Less, HTML,
 * YAML, Markdown, GraphQL) are run through prettier's browser build, which is
 * loaded lazily on first use so it never lands in the initial bundle.
 * Everything else gets `normalizeWhitespace` (dedent, tabs → spaces,
 * trailing whitespace stripped).
 *
 * Formatting must never lose content: any prettier failure (usually a snippet
 * that isn't a complete parse unit) falls back to whitespace normalisation.
 */

import { joinSegments, normalizeLanguage, normalizeWhitespace, splitFencedBlocks } from "./code-blocks"
import { detectLanguageAsync } from "./code-detect"

type PrettierPlugin = "babel" | "estree" | "typescript" | "postcss" | "html" | "yaml" | "markdown" | "graphql"

interface PrettierTarget {
    parser: string
    plugins: PrettierPlugin[]
}

const PRETTIER_TARGETS: Record<string, PrettierTarget> = {
    javascript: { parser: "babel", plugins: ["babel", "estree"] },
    jsx: { parser: "babel", plugins: ["babel", "estree"] },
    typescript: { parser: "typescript", plugins: ["typescript", "estree"] },
    tsx: { parser: "typescript", plugins: ["typescript", "estree"] },
    json: { parser: "json", plugins: ["babel", "estree"] },
    css: { parser: "css", plugins: ["postcss"] },
    scss: { parser: "scss", plugins: ["postcss"] },
    less: { parser: "less", plugins: ["postcss"] },
    markup: { parser: "html", plugins: ["html"] },
    yaml: { parser: "yaml", plugins: ["yaml"] },
    markdown: { parser: "markdown", plugins: ["markdown"] },
    graphql: { parser: "graphql", plugins: ["graphql"] },
}

/** Formatting options shared by every prettier-formatted block. */
const PRETTIER_OPTIONS = {
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "all" as const,
}

// Plugin modules are loaded on demand and cached for the session.
const pluginLoaders: Record<PrettierPlugin, () => Promise<unknown>> = {
    babel: () => import("prettier/plugins/babel"),
    estree: () => import("prettier/plugins/estree"),
    typescript: () => import("prettier/plugins/typescript"),
    postcss: () => import("prettier/plugins/postcss"),
    html: () => import("prettier/plugins/html"),
    yaml: () => import("prettier/plugins/yaml"),
    markdown: () => import("prettier/plugins/markdown"),
    graphql: () => import("prettier/plugins/graphql"),
}
const pluginCache = new Map<PrettierPlugin, Promise<unknown>>()

function loadPlugin(name: PrettierPlugin): Promise<unknown> {
    let p = pluginCache.get(name)
    if (!p) {
        p = pluginLoaders[name]()
        pluginCache.set(name, p)
    }
    return p
}

/** Can this language be formatted by prettier (vs. whitespace-only clean-up)? */
export function isPrettierLanguage(languageId: string): boolean {
    return languageId in PRETTIER_TARGETS
}

/**
 * Format a single code snippet. `language` may be anything the author wrote
 * after the fence; it is normalised first. Never throws.
 */
export async function formatCode(code: string, language: string): Promise<string> {
    const { id } = normalizeLanguage(language)
    const target = PRETTIER_TARGETS[id]
    const cleaned = normalizeWhitespace(code, id)
    if (!target || cleaned.trim() === "") return cleaned

    try {
        const [prettier, ...plugins] = await Promise.all([
            import("prettier/standalone"),
            ...target.plugins.map(loadPlugin),
        ])
        const out = await prettier.format(cleaned, {
            ...PRETTIER_OPTIONS,
            parser: target.parser,
            plugins: plugins as never[],
        })
        return out.replace(/\s+$/, "")
    } catch {
        // Snippets are often fragments (a lone `else` branch, a JSX subtree)
        // that no parser accepts. Keep the author's code, just tidied.
        return cleaned
    }
}

/**
 * Format every fenced code block in a markdown message. Blocks without a
 * language tag get one when the language can be detected confidently, so
 * the reader sees syntax highlighting too.
 */
export async function formatMessageCodeBlocks(markdown: string): Promise<string> {
    const segments = splitFencedBlocks(markdown)
    if (!segments.some((s) => s.type === "code")) return markdown

    const formatted = await Promise.all(
        segments.map(async (seg) => {
            if (seg.type !== "code") return seg
            const language = seg.language || (await detectLanguageAsync(seg.code))
            const code = await formatCode(seg.code, language)
            return { ...seg, language, code, unterminated: false }
        }),
    )
    return joinSegments(formatted)
}

/**
 * Everything a chat message goes through before it is sent: trimming plus
 * code-block formatting. Use this instead of `message.trim()` in send handlers.
 */
export async function prepareOutgoingMessage(message: string): Promise<string> {
    const trimmed = message.trim()
    if (!trimmed) return ""
    return formatMessageCodeBlocks(trimmed)
}
