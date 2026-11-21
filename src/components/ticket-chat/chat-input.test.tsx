import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TicketChatInput } from "./chat-input"

describe("TicketChatInput sending", () => {
    it("sends on Enter", () => {
        const onSend = vi.fn()
        render(<TicketChatInput value="hello" onChange={() => {}} onSend={onSend} />)
        fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })
        expect(onSend).toHaveBeenCalledTimes(1)
    })

    it("does not send on Enter while the send button is disabled", () => {
        const onSend = vi.fn()
        render(<TicketChatInput value="hello" onChange={() => {}} onSend={onSend} sendDisabled />)
        fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })
        expect(onSend).not.toHaveBeenCalled()
    })

    it("keeps Shift+Enter for a new line", () => {
        const onSend = vi.fn()
        render(<TicketChatInput value="hello" onChange={() => {}} onSend={onSend} />)
        fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", shiftKey: true })
        expect(onSend).not.toHaveBeenCalled()
    })
})

describe("TicketChatInput toolbar", () => {
    it("wraps the toolbar so the end content stays visible on narrow screens", () => {
        render(
            <TicketChatInput value="" onChange={() => {}} onSend={() => {}} toolbarEndContent={<button>Claim ticket</button>} />,
        )
        const toolbar = screen.getByText("Claim ticket").closest(".border-b") as HTMLElement
        expect(toolbar.className).toMatch(/flex-wrap/)
        // Tighter gap and gutter below md keep the eight formatting buttons on one row at 375px.
        expect(toolbar.className).toMatch(/max-md:gap-1/)
        expect(toolbar.className).toMatch(/max-md:px-3/)
    })
})

describe("TicketChatInput auto-grow", () => {
    /** jsdom has no layout, so the content height is stubbed. */
    function stubScrollHeight(heightFor: (value: string) => number) {
        return vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(function (
            this: HTMLTextAreaElement,
        ) {
            return heightFor(this.value)
        })
    }

    const ONE_LINE = 36

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("starts at one line of text", () => {
        stubScrollHeight(() => ONE_LINE)
        render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} />)
        const textarea = screen.getByRole("textbox") as HTMLTextAreaElement
        expect(textarea).toHaveAttribute("rows", "1")
        expect(textarea.style.height).toBe(`${ONE_LINE}px`)
        // Overrides the primitive's min-h-16 and the old fixed 100px.
        expect(textarea.className).toMatch(/\bmin-h-0\b/)
        expect(textarea.className).not.toMatch(/min-h-16|min-h-\[100px\]/)
    })

    it("grows with the content", () => {
        stubScrollHeight((value) => ONE_LINE + 24 * (value.split("\n").length - 1))
        render(<TicketChatInput value={"one\ntwo\nthree"} onChange={() => {}} onSend={() => {}} />)
        expect((screen.getByRole("textbox") as HTMLTextAreaElement).style.height).toBe("84px")
    })

    it("stops growing at 200px and scrolls inside", () => {
        stubScrollHeight(() => 640)
        render(<TicketChatInput value={"line\n".repeat(30)} onChange={() => {}} onSend={() => {}} />)
        const textarea = screen.getByRole("textbox") as HTMLTextAreaElement
        expect(textarea.style.height).toBe("200px")
        expect(textarea.className).toMatch(/\bmax-h-50\b/)
        expect(textarea.className).toMatch(/\boverflow-y-auto\b/)
        expect(textarea.className).toMatch(/\bresize-none\b/)
    })

    it("shrinks back to one line when the value is cleared after sending", () => {
        stubScrollHeight((value) => (value ? 640 : ONE_LINE))
        const { rerender } = render(
            <TicketChatInput value={"line\n".repeat(30)} onChange={() => {}} onSend={() => {}} />,
        )
        const textarea = screen.getByRole("textbox") as HTMLTextAreaElement
        expect(textarea.style.height).toBe("200px")
        rerender(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} />)
        expect(textarea.style.height).toBe(`${ONE_LINE}px`)
    })
})

describe("TicketChatInput placeholder", () => {
    it("uses the caller's placeholder and keeps it on one line", () => {
        render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} placeholder="Ask #githelp-crm" />)
        const textarea = screen.getByPlaceholderText("Ask #githelp-crm")
        expect(textarea.className).toMatch(/placeholder:truncate/)
    })

    it("keeps the closed-ticket notice", () => {
        render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} placeholder="Ask #githelp-crm" disabled />)
        expect(screen.getByPlaceholderText("This ticket is closed. New messages can't be sent.")).toBeDisabled()
    })
})
