"use client"

import { Children, isValidElement, type ReactElement, type ReactNode } from "react"
import ReactMarkdown, { defaultUrlTransform } from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import { ChatImage } from "@/components/ticket-chat/chat-image"
import { CodeBlock } from "@/components/ticket-chat/code-block"
import { parseTicketAttachmentPath } from "@/lib/ticket-attachments"

export interface MarkdownContentProps {
  content: string
  className?: string
}

/** Base styles so markdown matches original chat message look: text-sm, same color, normal line-height.
 * Color is inherited so callers can control message color via parent styles. */
const baseMessageClasses = "text-sm leading-normal font-normal"

/**
 * Some older rows were stored with the newline escaped as a literal `\n`.
 * Only unescape when the message has no real newlines at all — otherwise a
 * `\n` inside shared code (e.g. `"a\nb"`) would be turned into a line break.
 */
function normalizeNewlines(text: string): string {
  if (text.includes("\n")) return text
  return text.replace(/\\n/g, "\n")
}

/** Flatten React children (strings, arrays, nested elements) to plain text. */
function childrenToText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(childrenToText).join("")
  if (isValidElement<{ children?: ReactNode }>(node)) return childrenToText(node.props.children)
  return ""
}

/**
 * react-markdown drops URLs with unknown protocols. Let the chat's own
 * `attachment:` image references through (ChatImage resolves them); everything
 * else keeps the default sanitising.
 */
function urlTransform(url: string, key: string): string {
  if (key === "src" && url.startsWith("attachment:") && parseTicketAttachmentPath(url)) return url
  return defaultUrlTransform(url)
}

/** Renders message content as markdown (code blocks, bold, italic, lists, etc.) */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const normalizedContent = normalizeNewlines(content)
  return (
    <div className={className ? `${baseMessageClasses} ${className}` : baseMessageClasses}>
      <ReactMarkdown
        remarkPlugins={[remarkBreaks, remarkGfm]}
        urlTransform={urlTransform}
        components={{
          img({ src, alt }) {
            return <ChatImage src={typeof src === "string" ? src : undefined} alt={alt} />
          },
          // Fenced / indented code arrives as <pre><code class="language-x">…</code></pre>.
          // Rendering at the <pre> level means blocks without a language tag are
          // still shown as blocks (they used to fall through to inline styling).
          pre({ children }) {
            const only = Children.toArray(children).find(isValidElement) as
              | ReactElement<{ className?: string; children?: ReactNode }>
              | undefined
            const codeClassName = only?.props.className ?? ""
            const langMatch = /language-([^\s]+)/.exec(codeClassName)
            const language = langMatch ? langMatch[1] : ""
            const code = childrenToText(only ? only.props.children : children).replace(/\n$/, "")
            return <CodeBlock code={code} language={language} />
          },
          code({ children, ...props }) {
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-[0.8125rem] font-mono" {...props}>
                {children}
              </code>
            )
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
