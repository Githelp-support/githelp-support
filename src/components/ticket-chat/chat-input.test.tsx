import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
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
            <TicketChatInput value="" onChange={() => {}} onSend={() => {}} toolbarEndContent={<button>End session</button>} />,
        )
        const toolbar = screen.getByText("End session").closest(".border-b") as HTMLElement
        expect(toolbar.className).toMatch(/flex-wrap/)
        // Tighter gap and gutter below md keep the eight formatting buttons on one row at 375px.
        expect(toolbar.className).toMatch(/max-md:gap-1/)
        expect(toolbar.className).toMatch(/max-md:px-3/)
    })
})

describe("TicketChatInput placeholder and sizing", () => {
    it("renders a custom placeholder", () => {
        render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} placeholder="Ask #acme" />)
        expect(screen.getByPlaceholderText("Ask #acme")).toBeInTheDocument()
    })

    it("keeps the closed-ticket notice over a custom placeholder", () => {
        render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} placeholder="Ask #acme" disabled />)
        expect(screen.queryByPlaceholderText("Ask #acme")).not.toBeInTheDocument()
        expect(screen.getByPlaceholderText(/This ticket is closed/)).toBeInTheDocument()
    })

    it("starts at one line and grows to 200px with autoGrow", () => {
        render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} autoGrow />)
        const textarea = screen.getByRole("textbox")
        expect(textarea).toHaveAttribute("rows", "1")
        expect(textarea.className).toMatch(/max-h-50/)
        expect(textarea.className).toMatch(/overflow-y-auto/)
        expect(textarea.className).not.toMatch(/min-h-\[100px\]/)
        // 16px text below md (no iOS zoom).
        expect(textarea.className).toMatch(/(^|\s)text-base(\s|$)/)
    })

    it("sizes to the content, capped at 200px, and shrinks back when cleared (no field-sizing support)", () => {
        const { rerender } = render(<TicketChatInput value="a" onChange={() => {}} onSend={() => {}} autoGrow />)
        const textarea = screen.getByRole("textbox") as HTMLTextAreaElement
        let scrollHeight = 500
        Object.defineProperty(textarea, "scrollHeight", { configurable: true, get: () => scrollHeight })
        rerender(<TicketChatInput value={"a\nb\nc"} onChange={() => {}} onSend={() => {}} autoGrow />)
        expect(textarea.style.height).toBe("200px")
        scrollHeight = 36
        rerender(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} autoGrow />)
        expect(textarea.style.height).toBe("36px")
    })

    it("keeps the default placeholder and the fixed 100px sizing without autoGrow", () => {
        render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} />)
        const textarea = screen.getByPlaceholderText("Message #askanything") as HTMLTextAreaElement
        expect(textarea).not.toHaveAttribute("rows")
        expect(textarea.className).toMatch(/min-h-\[100px\]/)
        expect(textarea.className).toMatch(/max-h-32/)
        expect(textarea.className).not.toMatch(/max-h-50/)
        expect(textarea.style.height).toBe("")
    })
})
