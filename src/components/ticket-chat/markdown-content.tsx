"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
// CJS import for Next.js compatibility (ESM style path can fail to resolve)
// Light theme for code blocks to match Figma (muted container + syntax colors)
const prismLight = require("react-syntax-highlighter/dist/cjs/styles/prism/one-light").default

export interface MarkdownContentProps {
  content: string
  className?: string
}

/** Base styles so markdown matches original chat message look: text-sm, same color, normal line-height.
 * Color is inherited so callers can control message color via parent styles. */
const baseMessageClasses = "text-sm leading-normal font-normal"

/** Normalize content: literal \n in text and escaped \\n from DB become real newlines */
function normalizeNewlines(text: string): string {
  return text.replace(/\\n/g, "\n")
}

/** Renders message content as markdown (code blocks, bold, italic, lists, etc.) */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const normalizedContent = normalizeNewlines(content)
  return (
    <div className={className ? `${baseMessageClasses} ${className}` : baseMessageClasses}>
      <ReactMarkdown
        remarkPlugins={[remarkBreaks, remarkGfm]}
        components={{
          code({ className: codeClassName, children, ...props }) {
            const isBlock = Boolean(codeClassName?.includes("language-"))
            const langMatch = /language-(\w*)/.exec(codeClassName || "")
            const language = langMatch ? (langMatch[1] || "plaintext") : "plaintext"
            const code = String(children).replace(/\n$/, "")
            if (isBlock) {
              return (
                <div className="markdown-code-block my-2">
                  <SyntaxHighlighter
                    PreTag="div"
                    style={prismLight}
                    language={language}
                    customStyle={{
                      margin: 0,
                      padding: 0,
                      background: "transparent",
                      fontSize: "inherit",
                    }}
                    codeTagProps={{ style: { background: "transparent" } }}
                    showLineNumbers={false}
                  >
                    {code}
                  </SyntaxHighlighter>
                </div>
              )
            }
            return (
              <code className="px-1.5 py-0.5 rounded text-sm font-mono" style={{ backgroundColor: 'rgba(0,0,0,0.04)' }} {...props}>
                {children}
              </code>
            )
          },
          pre({ children }) {
            return <>{children}</>
          },
          br() {
            return <br className="my-0.5 block h-0 w-full overflow-hidden" />
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0 text-sm leading-normal">{children}</p>
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2 space-y-0.5 text-sm">{children}</ul>
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2 space-y-0.5 text-sm">{children}</ol>
          },
          li({ children }) {
            return <li className="text-sm leading-normal">{children}</li>
          },
          strong({ children }) {
            return <strong className="font-semibold">{children}</strong>
          },
          em({ children }) {
            return <em className="italic">{children}</em>
          },
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}
