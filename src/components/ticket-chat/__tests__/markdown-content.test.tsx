import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MarkdownContent } from "../markdown-content"

describe("MarkdownContent", () => {
  it("renders a fenced block WITHOUT a language as a code block", () => {
    const { container } = render(<MarkdownContent content={"```\nconst a = 1\nconst b = 2\n```"} />)
    expect(container.querySelector(".markdown-code-block")).not.toBeNull()
  })

  it("renders a fenced block WITH a language as a highlighted code block", () => {
    const { container } = render(<MarkdownContent content={"```ts\nconst a = 1\n```"} />)
    const block = container.querySelector(".markdown-code-block")
    expect(block).not.toBeNull()
    expect(block!.querySelectorAll(".token").length).toBeGreaterThan(0)
  })

  it("renders inline code as inline", () => {
    const { container } = render(<MarkdownContent content={"use `npm i` here"} />)
    expect(container.querySelector(".markdown-code-block")).toBeNull()
    expect(container.querySelector("code")?.textContent).toBe("npm i")
  })

  it("renders an indented code block as a code block", () => {
    const { container } = render(<MarkdownContent content={"text\n\n    indented code\n    more"} />)
    expect(container.querySelector(".markdown-code-block")).not.toBeNull()
  })
})
