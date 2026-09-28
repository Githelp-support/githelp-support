/**
 * Shared helpers for code shared in chat messages.
 *
 * Messages are markdown. Code travels inside fenced blocks (```lang … ```).
 * These helpers detect code that was pasted without fences, guess a language
 * for highlighting, normalise whitespace, and split/rejoin the fenced blocks
 * of a message so each block can be formatted independently.
 *
 * Everything here is pure and synchronous; the async prettier-based
 * formatter lives in `code-format.ts`.
 */

/** Prism language id (react-syntax-highlighter) plus a human label. */
export interface LanguageInfo {
    /** Canonical id passed to the highlighter, e.g. "typescript". */
    id: string
    /** Label shown in the code block header, e.g. "TypeScript". */
    label: string
}

const LANGUAGE_ALIASES: Record<string, string> = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    javascript: "javascript",
    jsx: "jsx",
    ts: "typescript",
    typescript: "typescript",
    tsx: "tsx",
    py: "python",
    python: "python",
    rb: "ruby",
    ruby: "ruby",
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    bash: "bash",
    console: "bash",
    yml: "yaml",
    yaml: "yaml",
    html: "markup",
    htm: "markup",
    xml: "markup",
    svg: "markup",
    markup: "markup",
    vue: "markup",
    "c#": "csharp",
    cs: "csharp",
    csharp: "csharp",
    "c++": "cpp",
    cpp: "cpp",
    cc: "cpp",
    c: "c",
    h: "c",
    golang: "go",
    go: "go",
    kt: "kotlin",
    kotlin: "kotlin",
    rs: "rust",
    rust: "rust",
    md: "markdown",
    markdown: "markdown",
    json: "json",
    json5: "json",
    jsonc: "json",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    css: "css",
    scss: "scss",
    less: "less",
    java: "java",
    php: "php",
    swift: "swift",
    dart: "dart",
    docker: "docker",
    dockerfile: "docker",
    diff: "diff",
    patch: "diff",
    ini: "ini",
    toml: "toml",
    ps1: "powershell",
    powershell: "powershell",
    text: "text",
    txt: "text",
    plaintext: "text",
    plain: "text",
}

const LANGUAGE_LABELS: Record<string, string> = {
    javascript: "JavaScript",
    jsx: "JSX",
    typescript: "TypeScript",
    tsx: "TSX",
    python: "Python",
    ruby: "Ruby",
    bash: "Shell",
    yaml: "YAML",
    markup: "HTML",
    csharp: "C#",
    cpp: "C++",
    c: "C",
    go: "Go",
    kotlin: "Kotlin",
    rust: "Rust",
    markdown: "Markdown",
    json: "JSON",
    sql: "SQL",
    graphql: "GraphQL",
    css: "CSS",
    scss: "SCSS",
    less: "Less",
    java: "Java",
    php: "PHP",
    swift: "Swift",
    dart: "Dart",
    docker: "Dockerfile",
    diff: "Diff",
    ini: "INI",
    toml: "TOML",
    powershell: "PowerShell",
    text: "Code",
}

/**
 * Map whatever the author wrote after the fence ("JS", "c#", "Python", …) to
 * a highlighter language id and display label. Unknown names are passed
 * through as-is so Prism can still try them.
 */
export function normalizeLanguage(raw: string | null | undefined): LanguageInfo {
    const key = (raw ?? "").trim().toLowerCase()
    if (!key) return { id: "text", label: LANGUAGE_LABELS.text }
    const id = LANGUAGE_ALIASES[key] ?? key
    const label = LANGUAGE_LABELS[id] ?? key.charAt(0).toUpperCase() + key.slice(1)
    return { id, label }
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

interface Signal {
    re: RegExp
    weight: number
}

/**
 * Per-language regex signals. Scores are summed per language. A signal with
 * the `g` flag is counted per match (capped) so repeated markers — several
 * `const` lines, several shell commands — add up to a confident score.
 */
const LANGUAGE_SIGNALS: Record<string, Signal[]> = {
    python: [
        { re: /^\s*def\s+\w+\s*\(.*\)\s*(->\s*[\w[\], ]+)?\s*:/gm, weight: 4 },
        { re: /^\s*class\s+\w+(\(.*\))?\s*:/m, weight: 3 },
        { re: /^\s*(from\s+[\w.]+\s+)?import\s+[\w.]+(\s*,\s*[\w.]+)*\s*$/m, weight: 2 },
        { re: /^\s*(if|elif|else|for|while|try|except|with)\b.*:\s*$/m, weight: 3 },
        { re: /\bprint\(/, weight: 2 },
        { re: /\bself\./, weight: 2 },
        { re: /\b(None|True|False)\b/, weight: 1 },
        { re: /\belif\b/, weight: 3 },
    ],
    typescript: [
        { re: /^\s*(export\s+)?interface\s+\w+/m, weight: 4 },
        { re: /^\s*(export\s+)?type\s+\w+(<[^>]*>)?\s*=/m, weight: 4 },
        { re: /:\s*(string|number|boolean|void|unknown|never|any)\b/, weight: 3 },
        { re: /\w+\s*<[\w, ]+>\s*\(/, weight: 1 },
        { re: /\bas\s+const\b/, weight: 2 },
        { re: /\b(implements|readonly|enum)\b/, weight: 1 },
    ],
    javascript: [
        { re: /\b(const|let|var)\s+\w+\s*=/g, weight: 2 },
        { re: /=>/g, weight: 2 },
        { re: /\bfunction\s*\w*\s*\(/, weight: 2 },
        { re: /\bconsole\.(log|error|warn)\(/, weight: 2 },
        { re: /\brequire\(['"]/, weight: 2 },
        { re: /^\s*import\s+.*\s+from\s+['"]/m, weight: 3 },
        { re: /^\s*export\s+(default\s+)?(function|const|class|async)/m, weight: 3 },
        { re: /\b(await|async)\b/, weight: 1 },
        { re: /\.(then|catch|map|filter|forEach)\(/, weight: 1 },
        { re: /===|!==/, weight: 1 },
        { re: /\binstanceof\b/, weight: 2 },
        { re: /\bJSON\.(stringify|parse)\(/, weight: 2 },
        { re: /\bnew\s+[A-Z]\w*\(/, weight: 1 },
        { re: /\b(typeof|undefined|null)\b/, weight: 1 },
        { re: /\.\.\.\w+/, weight: 1 },
    ],
    jsx: [
        // Capitalised tag not glued to an identifier (so `Promise<User>` is a generic, not JSX)
        { re: /(?<![\w.])<[A-Z]\w*(\s[^>]*)?\/?>/, weight: 3 },
        { re: /\breturn\s*\(\s*\n?\s*</, weight: 3 },
        { re: /className=/, weight: 3 },
        { re: /\buse(State|Effect|Ref|Memo|Callback)\(/, weight: 2 },
        { re: /\{\s*\w+(\.\w+)*\s*\}/, weight: 1 },
    ],
    markup: [
        { re: /<!doctype\s+html/i, weight: 6 },
        { re: /<html[\s>]/i, weight: 5 },
        { re: /<\/(div|span|p|a|ul|li|body|head|table|tr|td|section|header|footer|nav|form|button|input|label|h[1-6])>/i, weight: 3 },
        { re: /<(div|span|p|a|ul|li|img|br|input|meta|link)(\s[^>]*)?\/?>/i, weight: 2 },
        { re: /<\?xml/, weight: 5 },
    ],
    css: [
        { re: /^\s*[.#]?[\w-]+(\s*[,>+~]\s*[.#]?[\w-]+)*\s*\{[^}]*:[^}]*;?[^}]*\}/m, weight: 4 },
        { re: /^\s*[\w-]+\s*:\s*[^;{}]+;\s*$/m, weight: 2 },
        { re: /@media\b|@import\b|@keyframes\b/, weight: 3 },
        { re: /\b(px|rem|em|vh|vw)\b/, weight: 1 },
    ],
    sql: [
        { re: /\bselect\b[\s\S]+\bfrom\b/i, weight: 4 },
        { re: /\binsert\s+into\b/i, weight: 4 },
        { re: /\bcreate\s+(or\s+replace\s+)?(table|index|view|function|policy)\b/i, weight: 4 },
        { re: /\bupdate\s+\w+\s+set\b/i, weight: 4 },
        { re: /\bdelete\s+from\b/i, weight: 4 },
        { re: /\b(where|group by|order by|inner join|left join|limit)\b/i, weight: 1 },
    ],
    bash: [
        { re: /^#!\s*\/(usr\/)?bin\/(env\s+)?(ba|z)?sh/m, weight: 6 },
        { re: /^\s*\$\s+\w+/m, weight: 3 },
        { re: /^\s*(npm|npx|pnpm|yarn|git|cd|ls|cat|curl|wget|sudo|apt|apt-get|brew|echo|export|chmod|mkdir|rm|cp|mv|docker|kubectl|pip|python3?|node)\s+[\w.-]/gm, weight: 3 },
        { re: /\|\s*(grep|awk|sed|xargs|sort|uniq|head|tail)\b/, weight: 3 },
        { re: /\$\{?\w+\}?/, weight: 1 },
        { re: /\b(fi|esac|done)\s*$/m, weight: 3 },
    ],
    go: [
        { re: /^\s*package\s+\w+\s*$/m, weight: 4 },
        { re: /^\s*func\s+(\(\w+\s+\*?\w+\)\s*)?\w+\s*\(/m, weight: 4 },
        { re: /:=/, weight: 2 },
        { re: /\bfmt\.\w+\(/, weight: 3 },
        { re: /^\s*import\s*\(/m, weight: 2 },
    ],
    java: [
        { re: /\bpublic\s+(static\s+)?(class|void|int|String)\b/, weight: 4 },
        { re: /\bSystem\.out\.print/, weight: 4 },
        { re: /^\s*import\s+java\./m, weight: 5 },
        { re: /\bnew\s+\w+(<[^>]*>)?\s*\(/, weight: 1 },
    ],
    csharp: [
        { re: /^\s*using\s+System/m, weight: 5 },
        { re: /^\s*namespace\s+[\w.]+/m, weight: 4 },
        { re: /\bConsole\.Write(Line)?\(/, weight: 4 },
        { re: /\b(public|private)\s+(async\s+)?(Task|void|string|int|var)\b/, weight: 2 },
    ],
    php: [
        { re: /<\?php/, weight: 6 },
        { re: /\$\w+\s*->\s*\w+/, weight: 3 },
        { re: /\becho\s+['"$]/, weight: 2 },
    ],
    ruby: [
        { re: /^\s*def\s+\w+[?!]?(\(.*\))?\s*$/m, weight: 3 },
        { re: /^\s*end\s*$/m, weight: 2 },
        { re: /\bputs\s+/, weight: 3 },
        { re: /\bdo\s*\|\w+\|/, weight: 3 },
        { re: /^\s*require\s+['"]/m, weight: 2 },
    ],
    rust: [
        { re: /\bfn\s+\w+\s*(<[^>]*>)?\s*\(/, weight: 4 },
        { re: /\blet\s+mut\b/, weight: 3 },
        { re: /\bprintln!\(/, weight: 4 },
        { re: /\buse\s+std::/, weight: 4 },
    ],
    yaml: [
        { re: /^\s*[\w.-]+:\s*(\S.*)?$/m, weight: 1 },
        { re: /^\s*-\s+[\w.-]+:\s/m, weight: 3 },
        { re: /^---\s*$/m, weight: 2 },
    ],
    diff: [
        { re: /^\+\+\+\s|^---\s/m, weight: 4 },
        { re: /^@@\s[-+\d, ]+\s@@/m, weight: 6 },
        { re: /^diff --git/m, weight: 6 },
    ],
    json: [],
}

/** Languages whose signals are too generic to win on their own. */
const WEAK_LANGUAGES = new Set(["yaml"])

/** A repeated (global) signal counts at most this many times. */
const MAX_SIGNAL_HITS = 3

function scoreSignal(code: string, s: Signal): number {
    if (!s.re.global) return s.re.test(code) ? s.weight : 0
    const hits = code.match(s.re)?.length ?? 0
    return Math.min(hits, MAX_SIGNAL_HITS) * s.weight
}

export interface DetectedLanguage {
    /** Highlighter language id, or "" when nothing matched confidently. */
    language: string
    /** Confidence score; ≥ CONFIDENT_SCORE means a real match. */
    score: number
}

export const CONFIDENT_SCORE = 4

function isStrictJson(text: string): boolean {
    const t = text.trim()
    if (!(t.startsWith("{") || t.startsWith("["))) return false
    try {
        JSON.parse(t)
        return true
    } catch {
        return false
    }
}

/**
 * Raw per-language heuristic scores (higher = more markers found). Exposed so
 * `code-detect.ts` can blend them with highlight.js's statistical relevance.
 */
export function scoreLanguages(code: string): Record<string, number> {
    const scores: Record<string, number> = {}
    for (const [lang, signals] of Object.entries(LANGUAGE_SIGNALS)) {
        let score = 0
        for (const s of signals) score += scoreSignal(code, s)
        scores[lang] = score
    }
    if (isStrictJson(code)) scores.json = 10
    return scores
}

/**
 * Guess the language of a code snippet for syntax highlighting.
 * Returns an empty language when no signal is strong enough.
 */
export function detectLanguage(code: string): DetectedLanguage {
    if (isStrictJson(code)) return { language: "json", score: 10 }

    const scores = scoreLanguages(code)

    // JSX/TSX builds on JS/TS: when JSX markers are present, lift the winner
    // to the JSX flavour rather than reporting bare HTML.
    const jsxScore = scores.jsx ?? 0
    const jsScore = scores.javascript ?? 0
    const tsScore = scores.typescript ?? 0
    if (jsxScore >= 3 && jsScore + tsScore >= 2) {
        const flavour = tsScore >= 3 ? "tsx" : "jsx"
        return { language: flavour, score: jsxScore + jsScore + tsScore }
    }
    // TS markers imply TS even when JS markers score higher on volume.
    if (tsScore >= 3 && jsScore >= 1) {
        return { language: "typescript", score: tsScore + jsScore }
    }
    // HTML without JS markers is markup, not JSX.
    scores.jsx = 0

    let best = ""
    let bestScore = 0
    for (const [lang, score] of Object.entries(scores)) {
        if (score > bestScore) {
            best = lang
            bestScore = score
        }
    }
    if (!best) return { language: "", score: 0 }
    if (WEAK_LANGUAGES.has(best) && bestScore < CONFIDENT_SCORE + 1) {
        return { language: "", score: bestScore }
    }
    return { language: bestScore >= CONFIDENT_SCORE ? best : "", score: bestScore }
}

// ---------------------------------------------------------------------------
// "Is this pasted text code?"
// ---------------------------------------------------------------------------

const CODE_LINE_RE =
    /(?:[;{}]\s*$)|(?:^\s*[}\])]\s*[,;]?\s*$)|(?:^\s{2,}\S)|(?:^\t)|(?:=>)|(?:\(\)\s*[{=:;])|(?:^\s*(?:import|export|const|let|var|def|class|function|return|if|for|while|public|private|#include|SELECT|INSERT|UPDATE|CREATE)\b)|(?:<\/?\w+[^>]*>)|(?:^\s*[@#$]\w)|(?:^\s*\$\s)|(?:^\s*at\s.+:\d+\)?$)/

const PROSE_LINE_RE = /^[A-Z][^{}<>;=]{40,}[.!?]$/

/**
 * Heuristic used when text is pasted into the chat box: does this look like
 * source code (or terminal output) that should be wrapped in a code fence?
 *
 * Deliberately conservative — a false positive turns a normal message into a
 * code block, which is more annoying than a missed detection.
 */
export function looksLikeCode(text: string): boolean {
    const lines = text.replace(/\r\n?/g, "\n").split("\n")
    const nonBlank = lines.filter((l) => l.trim().length > 0)
    if (nonBlank.length < 2) return false

    const detected = detectLanguage(text)
    if (detected.score >= CONFIDENT_SCORE + 2) return true

    let codeLines = 0
    let proseLines = 0
    for (const line of nonBlank) {
        if (CODE_LINE_RE.test(line)) codeLines++
        else if (PROSE_LINE_RE.test(line.trim())) proseLines++
    }
    if (proseLines > codeLines) return false
    const ratio = codeLines / nonBlank.length
    if (ratio >= 0.6) return true
    return ratio >= 0.4 && detected.score >= CONFIDENT_SCORE
}

// ---------------------------------------------------------------------------
// Whitespace normalisation
// ---------------------------------------------------------------------------

/** Languages whose convention is real tabs; leave their indentation alone. */
const TAB_INDENTED = new Set(["go", "makefile"])

/**
 * Light, language-agnostic clean-up applied to every code block:
 * CRLF → LF, tabs → spaces (2, or 4 for Python), trailing whitespace removed,
 * common leading indentation stripped, and blank lines trimmed at both ends.
 *
 * Safe for any language — it never changes tokens, only surrounding
 * whitespace, and it keeps relative indentation intact.
 */
export function normalizeWhitespace(code: string, language = ""): string {
    let text = code.replace(/\r\n?/g, "\n")
    if (!TAB_INDENTED.has(language)) {
        const width = language === "python" ? 4 : 2
        text = text.replace(/^\t+/gm, (tabs) => " ".repeat(tabs.length * width))
    }
    let lines = text.split("\n").map((l) => l.replace(/[ \t]+$/, ""))

    // Trim leading/trailing blank lines.
    while (lines.length && lines[0].trim() === "") lines.shift()
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop()

    // Dedent by the smallest indentation among non-blank lines.
    let minIndent = Infinity
    for (const line of lines) {
        if (line.trim() === "") continue
        const indent = line.match(/^[ \t]*/)?.[0].length ?? 0
        if (indent < minIndent) minIndent = indent
    }
    if (minIndent > 0 && minIndent !== Infinity) {
        lines = lines.map((l) => l.slice(Math.min(minIndent, l.match(/^[ \t]*/)?.[0].length ?? 0)))
    }
    return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Fenced block parsing
// ---------------------------------------------------------------------------

export type MessageSegment =
    | { type: "text"; text: string }
    | {
          type: "code"
          /** Language as written after the opening fence (may be empty). */
          language: string
          code: string
          /** Fence string used, e.g. "```" or "~~~~". */
          fence: string
          /** True when the closing fence was missing (block runs to end of message). */
          unterminated: boolean
      }

const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)[^\n]*$/

/** Split a markdown message into prose and fenced-code segments. */
export function splitFencedBlocks(markdown: string): MessageSegment[] {
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
    const segments: MessageSegment[] = []
    let textBuf: string[] = []
    let i = 0

    const flushText = () => {
        if (textBuf.length) {
            segments.push({ type: "text", text: textBuf.join("\n") })
            textBuf = []
        }
    }

    while (i < lines.length) {
        const open = FENCE_OPEN_RE.exec(lines[i])
        if (!open) {
            textBuf.push(lines[i])
            i++
            continue
        }
        const fence = open[1]
        const language = open[2] ?? ""
        const closeRe = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`)
        const codeLines: string[] = []
        let j = i + 1
        let closed = false
        while (j < lines.length) {
            if (closeRe.test(lines[j])) {
                closed = true
                break
            }
            codeLines.push(lines[j])
            j++
        }
        flushText()
        segments.push({
            type: "code",
            language,
            code: codeLines.join("\n"),
            fence,
            unterminated: !closed,
        })
        i = closed ? j + 1 : j
    }
    flushText()
    return segments
}

/** Pick a backtick fence longer than any backtick run inside the code. */
export function fenceFor(code: string): string {
    let longest = 0
    for (const run of code.match(/`+/g) ?? []) longest = Math.max(longest, run.length)
    return "`".repeat(Math.max(3, longest + 1))
}

/** Wrap code in a fenced block with the given language tag. */
export function wrapInFence(code: string, language = ""): string {
    const fence = fenceFor(code)
    return `${fence}${language}\n${code}\n${fence}`
}

/** Reassemble segments produced by `splitFencedBlocks`. */
export function joinSegments(segments: MessageSegment[]): string {
    return segments
        .map((seg) => {
            if (seg.type === "text") return seg.text
            const fence = seg.fence.startsWith("`") ? fenceFor(seg.code) : seg.fence
            return `${fence}${seg.language}\n${seg.code}\n${fence}`
        })
        .join("\n")
}

/**
 * Is the caret (character offset) inside an unclosed code fence?
 * Used by the chat input so Enter inserts a newline instead of sending.
 */
export function isInsideOpenFence(text: string, caret: number): boolean {
    const before = text.slice(0, caret)
    const segments = splitFencedBlocks(before)
    const last = segments[segments.length - 1]
    return last?.type === "code" && last.unterminated
}
