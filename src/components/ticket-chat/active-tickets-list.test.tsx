import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ActiveTicketsList, type ActiveTicketListItem } from "./active-tickets-list"

function item(overrides: Partial<ActiveTicketListItem> = {}): ActiveTicketListItem {
    return {
        id: "ticket-1",
        subject: "Build fails on CI",
        projectName: "Acme",
        shortId: "ticket-1",
        createdAt: "2026-11-15T10:00:00Z",
        avatarUrl: null,
        avatarInitial: "A",
        current: false,
        hasNotification: false,
        ...overrides,
    }
}

describe("ActiveTicketsList unread dot", () => {
    it("renders a labelled, centred brand dot at the end of a row with unread messages", () => {
        render(<ActiveTicketsList items={[item({ hasNotification: true })]} count={1} getHref={() => "/t/1"} />)

        const dot = screen.getByRole("img", { name: "Unread messages" })
        expect(dot).toHaveClass("size-2", "shrink-0", "self-center", "rounded-full", "bg-brand-primary")
        expect(dot).not.toHaveClass("mt-1.5")
        expect(dot).toBeEmptyDOMElement()
        expect(dot.parentElement?.lastElementChild).toBe(dot)
    })

    it("renders no dot when there are no unread messages", () => {
        render(<ActiveTicketsList items={[item()]} count={1} getHref={() => "/t/1"} />)

        expect(screen.queryByRole("img", { name: "Unread messages" })).not.toBeInTheDocument()
    })
})
