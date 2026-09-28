import { describe, expect, it } from "vitest"
import { formatCode, formatMessageCodeBlocks, prepareOutgoingMessage } from "./code-format"

describe("formatCode", () => {
    it("formats JavaScript with prettier", async () => {
        const out = await formatCode(`const  x={a:1,b:[1,2,3]}\nfunction f( a,b ){return a+b}`, "js")
        expect(out).toBe(`const x = { a: 1, b: [1, 2, 3] };\nfunction f(a, b) {\n  return a + b;\n}`)
    })

    it("formats TypeScript, JSON and CSS", async () => {
        expect(await formatCode(`interface A{a:string;b?:number}`, "ts")).toBe(
            `interface A {\n  a: string;\n  b?: number;\n}`,
        )
        expect(await formatCode(`{"a":1,"b":[1,2]}`, "json")).toBe(`{ "a": 1, "b": [1, 2] }`)
        expect(await formatCode(`.a{color:red;padding:0}`, "css")).toBe(`.a {\n  color: red;\n  padding: 0;\n}`)
    })

    it("falls back to whitespace normalisation for languages prettier does not know", async () => {
        const out = await formatCode(`\n    def f():\n        return 1\n\n`, "python")
        expect(out).toBe(`def f():\n    return 1`)
    })

    it("keeps the author's code when it does not parse", async () => {
        const snippet = `} else {\n  return 2`
        expect(await formatCode(snippet, "js")).toBe(snippet)
    })
})

describe("formatMessageCodeBlocks", () => {
    it("formats every block and tags untagged blocks with a detected language", async () => {
        const md = "Look:\n```\nconst  a = 1\nconsole.log( a )\n```\nand\n```py\n  def f():\n      pass\n```"
        const out = await formatMessageCodeBlocks(md)
        expect(out).toBe("Look:\n```javascript\nconst a = 1;\nconsole.log(a);\n```\nand\n```py\ndef f():\n    pass\n```")
    })

    it("returns messages without fences untouched", async () => {
        expect(await formatMessageCodeBlocks("just *text*")).toBe("just *text*")
    })

    it("closes an unterminated fence so the message renders", async () => {
        expect(await formatMessageCodeBlocks("```\nfoo")).toBe("```\nfoo\n```")
    })
})

describe("prepareOutgoingMessage", () => {
    it("trims and formats", async () => {
        expect(await prepareOutgoingMessage("   \n```json\n{\"a\":1}\n```  ")).toBe('```json\n{ "a": 1 }\n```')
        expect(await prepareOutgoingMessage("   ")).toBe("")
    })
})
