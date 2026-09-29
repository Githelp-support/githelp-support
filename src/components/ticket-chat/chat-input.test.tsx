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
