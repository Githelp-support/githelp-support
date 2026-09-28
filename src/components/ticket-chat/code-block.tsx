"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { detectLanguage, normalizeLanguage, normalizeWhitespace } from "@/lib/code-blocks"
import { detectLanguageWithHljs } from "@/lib/code-detect"

// CJS import for Next.js compatibility (ESM style path can fail to resolve).
// Light theme for code blocks to match Figma (muted container + syntax colors).
const prismLight = require("react-syntax-highlighter/dist/cjs/styles/prism/one-light").default

export interface CodeBlockProps {
  code: string
  /** Language as written after the fence; guessed from the code when empty. */
  language?: string
}

/** Blocks with more lines than this get a line-number gutter. */
const LINE_NUMBER_THRESHOLD = 3

/** Same stack the chat timestamps use; explicit so nothing upstream can swap it for the sans font. */
const CODE_FONT = "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

/**
 * Editor-style code block used for fenced code in chat messages: a header
 * with the language and a copy button, syntax highlighting, and line numbers
 * for longer snippets. Whitespace is normalised so older messages that were
 * sent before formatting existed still line up.
 */
export function CodeBlock({ code, language }: CodeBlockProps) {
  const quickGuess = language ? language : detectLanguage(code).language
  // Untagged blocks the quick heuristic can't place get a second opinion from
  // highlight.js (loaded lazily); until it answers they render uncoloured.
  const [slowGuess, setSlowGuess] = useState("")
  useEffect(() => {
    if (quickGuess) return
    let cancelled = false
    detectLanguageWithHljs(code).then((lang) => {
      if (!cancelled && lang) setSlowGuess(lang)
    })
    return () => {
      cancelled = true
    }
  }, [code, quickGuess])

  const { id: languageId, label } = normalizeLanguage(quickGuess || slowGuess)
  const text = normalizeWhitespace(code, languageId)
  const lineCount = text.split("\n").length

  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // Clipboard unavailable (insecure context / permissions) — nothing to do.
    }
  }, [text])

  return (
    <div className="markdown-code-block my-2" data-language={languageId}>
      <div className="markdown-code-block__header">
        <span className="markdown-code-block__lang">{label}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="markdown-code-block__copy"
          aria-label={copied ? "Copied" : "Copy code"}
          title={copied ? "Copied" : "Copy code"}
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div className="markdown-code-block__body">
        <SyntaxHighlighter
          PreTag="div"
          style={prismLight}
          language={languageId === "text" ? "plaintext" : languageId}
          showLineNumbers={lineCount > LINE_NUMBER_THRESHOLD}
          lineNumberStyle={{
            minWidth: "2.5em",
            paddingRight: "1em",
            textAlign: "right",
            color: "var(--muted-foreground)",
            opacity: 0.6,
            userSelect: "none",
          }}
          customStyle={{
            margin: 0,
            padding: "0.75rem 1rem",
            background: "transparent",
            fontSize: "inherit",
            lineHeight: "inherit",
            fontFamily: CODE_FONT,
          }}
          codeTagProps={{ style: { background: "transparent", fontFamily: CODE_FONT, fontSize: "inherit" } }}
        >
          {text}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
