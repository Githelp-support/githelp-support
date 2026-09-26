import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// MarkdownContent → ChatImage → useTicketAttachments pulls in the client, which throws without env vars.
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))

import { MarkdownContent } from "./markdown-content"

describe("MarkdownContent code rendering", () => {
    it("renders a fenced block without a language tag as a code block", () => {
        const { container } = render(<MarkdownContent content={"```\nconst a = 1\nconst b = 2\n```"} />)
        const block = container.querySelector(".markdown-code-block")
        expect(block).not.toBeNull()
        // Language is guessed for highlighting
        expect(block?.getAttribute("data-language")).toBe("javascript")
        expect(block?.textContent).toContain("const a = 1")
    })

    it("shows the language label and a copy button", () => {
        render(<MarkdownContent content={"```ts\nconst a: number = 1\n```"} />)
        expect(screen.getByText("TypeScript")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument()
    })

    it("keeps inline code inline", () => {
        const { container } = render(<MarkdownContent content={"run `npm i` first"} />)
        expect(container.querySelector(".markdown-code-block")).toBeNull()
        expect(container.querySelector("code")?.textContent).toBe("npm i")
    })

    it("does not turn a literal \\n inside code into a line break", () => {
        const { container } = render(<MarkdownContent content={'```js\nconst s = "a\\nb"\n```'} />)
        expect(container.querySelector(".markdown-code-block")?.textContent).toContain('"a\\nb"')
    })

    it("still unescapes messages stored with literal \\n and no real newlines", () => {
        const { container } = render(<MarkdownContent content={"line one\\nline two"} />)
        expect(container.querySelector("br")).not.toBeNull()
    })

    it("colour-codes an untagged JavaScript snippet", () => {
        const snippet = [
            "```",
            "const response = {",
            '  message: error.message || "An unexpected error occurred",',
            '  code: error instanceof CustomError ? error.code : "unknown_error",',
            "};",
            "return new Response(JSON.stringify(response), {",
            '  headers: { ...corsHeaders, "Content-Type": "application/json" },',
            "  status: 500,",
            "});",
            "```",
        ].join("\n")
        const { container } = render(<MarkdownContent content={snippet} />)
        expect(screen.getByText("JavaScript")).toBeInTheDocument()
        // Prism wraps keywords/strings in coloured .token spans; a plain-text fallback has none.
        const tokens = Array.from(container.querySelectorAll<HTMLElement>(".markdown-code-block .token"))
        expect(tokens.length).toBeGreaterThan(5)
        const colours = new Set(tokens.map((t) => t.style.color).filter(Boolean))
        expect(colours.size).toBeGreaterThan(2)
    })

    it("shows line numbers only for longer blocks", () => {
        const short = render(<MarkdownContent content={"```\na\nb\n```"} />)
        expect(short.container.querySelector(".linenumber")).toBeNull()
        short.unmount()
        const long = render(<MarkdownContent content={"```\na\nb\nc\nd\ne\n```"} />)
        expect(long.container.querySelector(".linenumber")).not.toBeNull()
    })
})
