import { describe, expect, it } from "vitest"
import {
    detectLanguage,
    isInsideOpenFence,
    joinSegments,
    looksLikeCode,
    normalizeLanguage,
    normalizeWhitespace,
    splitFencedBlocks,
    wrapInFence,
} from "./code-blocks"

describe("normalizeLanguage", () => {
    it("maps common aliases to highlighter ids with labels", () => {
        expect(normalizeLanguage("JS")).toEqual({ id: "javascript", label: "JavaScript" })
        expect(normalizeLanguage("c#")).toEqual({ id: "csharp", label: "C#" })
        expect(normalizeLanguage("html")).toEqual({ id: "markup", label: "HTML" })
        expect(normalizeLanguage("")).toEqual({ id: "text", label: "Code" })
    })

    it("passes unknown languages through", () => {
        expect(normalizeLanguage("elixir")).toEqual({ id: "elixir", label: "Elixir" })
    })
})

describe("detectLanguage", () => {
    it("detects TypeScript", () => {
        const code = `interface User { id: string }\nconst load = async (id: string): Promise<User> => fetch(id)`
        expect(detectLanguage(code).language).toBe("typescript")
    })

    it("detects JavaScript", () => {
        const code = `const total = items.map((i) => i.price)\nconsole.log(total)`
        expect(detectLanguage(code).language).toBe("javascript")
    })

    it("detects TSX for React components with types", () => {
        const code = `export function Card({ title }: { title: string }) {\n  return (\n    <div className="card">{title}</div>\n  )\n}`
        expect(detectLanguage(code).language).toBe("tsx")
    })

    it("detects Python", () => {
        const code = `def greet(name):\n    if name:\n        print(f"hi {name}")\n    return None`
        expect(detectLanguage(code).language).toBe("python")
    })

    it("detects SQL, JSON, HTML, CSS and shell", () => {
        expect(detectLanguage(`SELECT id, name FROM users WHERE id = 1;`).language).toBe("sql")
        expect(detectLanguage(`{"a": 1, "b": [1, 2]}`).language).toBe("json")
        expect(detectLanguage(`<div class="x">\n  <p>Hello</p>\n</div>`).language).toBe("markup")
        expect(detectLanguage(`.card {\n  color: red;\n  padding: 4px;\n}`).language).toBe("css")
        expect(detectLanguage(`npm install foo\ngit commit -m "x"`).language).toBe("bash")
    })

    it("returns empty for prose", () => {
        expect(detectLanguage("Hello, could you help me with my project? Thanks!").language).toBe("")
    })
})

describe("looksLikeCode", () => {
    it("is true for pasted source", () => {
        expect(
            looksLikeCode(`function add(a, b) {\n  return a + b;\n}\n\nmodule.exports = { add };`),
        ).toBe(true)
    })

    it("is true for a stack trace / terminal output with indentation", () => {
        expect(
            looksLikeCode(`$ npm run build\n> next build\n\nError: Cannot find module 'x'\n    at Object.<anonymous> (index.js:1:1)\n    at Module._compile (node:internal/modules/cjs/loader:1)`),
        ).toBe(true)
    })

    it("is false for single lines and ordinary prose", () => {
        expect(looksLikeCode("const x = 1")).toBe(false)
        expect(
            looksLikeCode(
                "Hi there, I have a question about the invoice from last month.\nCould you check whether the discount was applied correctly? It looks off to me.",
            ),
        ).toBe(false)
        expect(looksLikeCode("- buy milk\n- walk the dog\n- call mum")).toBe(false)
    })
})

describe("normalizeWhitespace", () => {
    it("dedents, strips trailing whitespace and blank edges, expands tabs", () => {
        const input = "\n\n\t\tif (x) {   \n\t\t\ty()\n\t\t}\n\n"
        expect(normalizeWhitespace(input)).toBe("if (x) {\n  y()\n}")
    })

    it("uses four spaces per tab for Python and keeps tabs for Go", () => {
        expect(normalizeWhitespace("def f():\n\treturn 1", "python")).toBe("def f():\n    return 1")
        expect(normalizeWhitespace("func f() {\n\treturn 1\n}", "go")).toBe("func f() {\n\treturn 1\n}")
    })

    it("normalises CRLF", () => {
        expect(normalizeWhitespace("a\r\nb\r\n")).toBe("a\nb")
    })
})

describe("splitFencedBlocks / joinSegments", () => {
    it("splits prose and fenced code and round-trips", () => {
        const md = "Here is the bug:\n```ts\nconst a: number = 1\n```\nAny idea?"
        const segments = splitFencedBlocks(md)
        expect(segments).toEqual([
            { type: "text", text: "Here is the bug:" },
            { type: "code", language: "ts", code: "const a: number = 1", fence: "```", unterminated: false },
            { type: "text", text: "Any idea?" },
        ])
        expect(joinSegments(segments)).toBe(md)
    })

    it("treats an unclosed fence as running to the end", () => {
        const segments = splitFencedBlocks("```\nfoo\nbar")
        expect(segments).toEqual([{ type: "code", language: "", code: "foo\nbar", fence: "```", unterminated: true }])
    })

    it("leaves inline backticks alone", () => {
        expect(splitFencedBlocks("use `npm i` here")).toEqual([{ type: "text", text: "use `npm i` here" }])
    })

    it("does not swallow markers that look like fences in text", () => {
        // A closing fence for a ~~~ block must also be ~~~.
        const segments = splitFencedBlocks("~~~\n```\nstill code\n~~~\nafter")
        expect(segments[0]).toMatchObject({ type: "code", code: "```\nstill code", fence: "~~~" })
        expect(segments[1]).toEqual({ type: "text", text: "after" })
    })
})

describe("wrapInFence", () => {
    it("uses a longer fence when the code contains backtick runs", () => {
        expect(wrapInFence("a ``` b", "md")).toBe("````md\na ``` b\n````")
    })
})

describe("isInsideOpenFence", () => {
    it("is true while typing inside an open block and false once closed", () => {
        const open = "hello\n```js\nconst x = 1"
        expect(isInsideOpenFence(open, open.length)).toBe(true)
        const closed = open + "\n```\n"
        expect(isInsideOpenFence(closed, closed.length)).toBe(false)
        expect(isInsideOpenFence("plain text", 5)).toBe(false)
    })

    it("is true right after the opening fence line", () => {
        expect(isInsideOpenFence("```ts", 5)).toBe(true)
    })
})
