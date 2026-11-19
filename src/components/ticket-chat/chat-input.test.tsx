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

describe("TicketChatInput autoGrow", () => {
    it("starts at one line and caps the height when autoGrow is set", () => {
        render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} autoGrow />)
        const textarea = screen.getByRole("textbox")
        expect(textarea).toHaveAttribute("rows", "1")
        expect(textarea).toHaveClass("min-h-0", "max-h-50", "overflow-y-auto")
        expect(textarea).not.toHaveClass("min-h-[100px]")
        expect(textarea).not.toHaveClass("min-h-16")
        // 16px text below md (no iOS zoom).
        expect(textarea).toHaveClass("text-base")
    })

    it("sizes the textarea to its content, up to 200px, without field-sizing support", () => {
        const scrollHeight = vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get")
        try {
            scrollHeight.mockReturnValue(72)
            const props = { onChange: () => {}, onSend: () => {}, autoGrow: true }
            const { rerender } = render(<TicketChatInput value={"a\nb\nc"} {...props} />)
            const textarea = screen.getByRole("textbox")
            expect(textarea.style.height).toBe("72px")

            scrollHeight.mockReturnValue(640)
            rerender(<TicketChatInput value={"long\n".repeat(40)} {...props} />)
            expect(textarea.style.height).toBe("200px")

            // Cleared after sending: back to one line.
            scrollHeight.mockReturnValue(24)
            rerender(<TicketChatInput value="" {...props} />)
            expect(textarea.style.height).toBe("24px")
        } finally {
            scrollHeight.mockRestore()
        }
    })

    it("keeps the fixed 100px textarea without autoGrow", () => {
        render(<TicketChatInput value="hello" onChange={() => {}} onSend={() => {}} />)
        const textarea = screen.getByRole("textbox")
        expect(textarea).not.toHaveAttribute("rows")
        expect(textarea).toHaveClass("min-h-[100px]", "max-h-32")
        expect(textarea).not.toHaveClass("max-h-50")
        expect(textarea).not.toHaveClass("overflow-y-auto")
        expect(textarea.style.height).toBe("")
    })
})
