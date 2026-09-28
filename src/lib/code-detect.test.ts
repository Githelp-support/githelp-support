import { describe, expect, it } from "vitest"
import { detectLanguageAsync, detectLanguageWithHljs } from "./code-detect"

/** Real-world snippet (from a bug report) that highlight.js alone rates as Go. */
const RESPONSE_SNIPPET = `const response = {
  message: error.message || "An unexpected error occurred",
  code: error instanceof CustomError ? error.code : "unknown_error",
};
return new Response(JSON.stringify(response), {
  headers: { ...corsHeaders, "Content-Type": "application/json" },
  status: 500,
});`

describe("detectLanguageWithHljs", () => {
    it("identifies a plain JS object literal as JavaScript, not Go", async () => {
        expect(await detectLanguageWithHljs(RESPONSE_SNIPPET)).toBe("javascript")
    })

    it("places marker-free code the quick heuristic gives up on", async () => {
        const goish = `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hi")\n}`
        const plain = `x = compute(a, b)\ny = x * 2\nprint(y)\nif y > 10:\n    print("big")`
        expect(await detectLanguageWithHljs(goish)).toBe("go")
        expect(await detectLanguageAsync(plain)).toBe("python")
    })

    it("identifies Python and SQL", async () => {
        expect(await detectLanguageWithHljs(`import os\n\nfor f in os.listdir("."):\n    print(f)`)).toBe("python")
        expect(await detectLanguageWithHljs(`SELECT u.id, u.email\nFROM users u\nJOIN orders o ON o.user_id = u.id\nWHERE o.total > 100`)).toBe("sql")
    })

    it("maps hljs names to Prism ids", async () => {
        expect(await detectLanguageWithHljs(`<!DOCTYPE html>\n<html>\n<body>\n<div class="a"><p>hi</p></div>\n</body>\n</html>`)).toBe("markup")
    })

    it("returns empty for prose and tiny inputs", async () => {
        expect(await detectLanguageWithHljs("Hello, could you check the invoice for me? Thanks a lot!")).toBe("")
        expect(await detectLanguageWithHljs("x = 1")).toBe("")
    })
})

describe("detectLanguageAsync", () => {
    it("prefers the quick heuristic when it is confident", async () => {
        expect(await detectLanguageAsync(`interface A { a: string }\nconst f = (x: number) => x`)).toBe("typescript")
    })

    it("falls back to highlight.js otherwise", async () => {
        expect(await detectLanguageAsync(RESPONSE_SNIPPET)).toBe("javascript")
    })
})
