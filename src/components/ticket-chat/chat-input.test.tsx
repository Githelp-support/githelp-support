import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { composerPlaceholder, TicketChatInput } from "./chat-input"

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
    it("keeps the toolbar end content (e.g. the helper's Claim button) and wraps it on narrow screens", () => {
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
    /** jsdom has no layout, so the textarea's content height is stubbed. */
    function stubScrollHeight(getHeight: () => number) {
        const spy = vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(getHeight)
        return () => spy.mockRestore()
    }

    it("starts at one row, capped at max-h-50 with its own scrollbar", () => {
        render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} />)
        const textarea = screen.getByRole("textbox") as HTMLTextAreaElement
        expect(textarea.rows).toBe(1)
        expect(textarea.className).toMatch(/min-h-0/)
        expect(textarea.className).toMatch(/max-h-50/)
        expect(textarea.className).toMatch(/overflow-y-auto/)
        expect(textarea.className).not.toMatch(/min-h-\[100px\]|max-h-32/)
    })

    it("grows with the value and shrinks back when it is cleared after a send", () => {
        let height = 24
        const restore = stubScrollHeight(() => height)
        try {
            const { rerender } = render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} />)
            const textarea = screen.getByRole("textbox") as HTMLTextAreaElement
            expect(textarea.style.height).toBe("24px")

            height = 120
            rerender(<TicketChatInput value={"one\ntwo\nthree\nfour\nfive"} onChange={() => {}} onSend={() => {}} />)
            expect(textarea.style.height).toBe("120px")

            height = 24
            rerender(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} />)
            expect(textarea.style.height).toBe("24px")
        } finally {
            restore()
        }
    })

    it("shows no ring or outline on the textarea itself; the container shows focus", () => {
        const { container } = render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} />)
        const textarea = screen.getByRole("textbox")
        expect(textarea.className).toMatch(/focus-visible:ring-0/)
        expect(textarea.className).toMatch(/outline-none/)
        const composer = container.firstElementChild as HTMLElement
        expect(composer.className).toMatch(/focus-within:border-composer-border-focus/)
        expect(composer.className).not.toMatch(/\bmx-4\b/)
    })
})

describe("TicketChatInput placeholder", () => {
    it("builds 'Ask #' from the project's slug, falling back to its display name", () => {
        expect(composerPlaceholder({ slug: "githelp-crm", name: "Githelp CRM" })).toBe("Ask #githelp-crm")
        expect(composerPlaceholder({ slug: "", name: "Githelp CRM" })).toBe("Ask #Githelp CRM")
        expect(composerPlaceholder({ slug: null, display_name: "Sandbox", name: "sandbox-internal" })).toBe("Ask #Sandbox")
    })

    it("takes the placeholder as a prop and truncates a long one", () => {
        render(
            <TicketChatInput
                value=""
                onChange={() => {}}
                onSend={() => {}}
                placeholder={composerPlaceholder({ slug: "githelp-crm" })}
            />,
        )
        const textarea = screen.getByPlaceholderText("Ask #githelp-crm")
        expect(textarea.className).toMatch(/placeholder:truncate/)
    })
})
