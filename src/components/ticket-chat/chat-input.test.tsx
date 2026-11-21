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

describe("TicketChatInput focus", () => {
    it("darkens the composer border on focus-within without a ring on the textarea", () => {
        render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} />)
        const textarea = screen.getByRole("textbox")
        const composer = textarea.closest(".shadow-soft") as HTMLElement
        expect(composer).toHaveClass("focus-within:border-border-composer-focus", "transition-colors", "border-border")
        expect(composer.className).not.toMatch(/transition-all/)
        expect(textarea).toHaveClass("focus-visible:ring-0")
    })

    it("lets the drag state override the focus border", () => {
        render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} onImageFiles={() => {}} />)
        const composer = screen.getByRole("textbox").closest(".shadow-soft") as HTMLElement
        fireEvent.dragOver(composer, { dataTransfer: { types: ["Files"], files: [] } })
        expect(composer).toHaveClass("border-brand-primary", "focus-within:border-brand-primary")
        expect(composer).not.toHaveClass("focus-within:border-border-composer-focus")
    })
})
