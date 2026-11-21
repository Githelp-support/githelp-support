import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TicketChat, type TicketChatMessage } from "./ticket-chat"

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/components/layout/header", () => ({
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
vi.mock("@/components/ticket-chat/chat-input", () => ({
  TicketChatInput: () => <div data-testid="composer" />,
}))
vi.mock("@/hooks/useTicketAttachments", () => ({
  useTicketAttachmentUpload: () => ({ uploadFiles: vi.fn(), isUploading: false }),
}))

/** Local wall-clock time on a November 2026 day, as the ISO string the API returns. */
const at = (day: number, hours: number, minutes: number) => new Date(2026, 10, day, hours, minutes).toISOString()

function message(overrides: Partial<TicketChatMessage> & Pick<TicketChatMessage, "id">): TicketChatMessage {
  return {
    senderType: "helper",
    senderName: "Ada Lovelace",
    senderId: "helper-1",
    timestamp: "15.11.2026, 09:05",
    content: "Hello",
    ...overrides,
  }
}

function renderChat(messages: TicketChatMessage[], intro?: ReactNode) {
  return render(
    <TooltipProvider>
      <TicketChat
        headerTitle="Ticket"
        messages={messages}
        intro={intro}
        message=""
        onMessageChange={() => {}}
        onSend={() => {}}
      />
    </TooltipProvider>,
  )
}

describe("TicketChat message list", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows only the time beside the sender name", () => {
    renderChat([message({ id: "m1", createdAt: at(15, 9, 5) })])
    const stamp = screen.getByText("09:05")
    expect(stamp).toHaveClass("font-mono", "text-xs", "tabular-nums", "text-muted-foreground")
    expect(screen.queryByText(/15\.11\.2026/)).not.toBeInTheDocument()
    expect(screen.getByText("Ada Lovelace")).toHaveClass("text-sm", "font-semibold")
  })

  it("labels each day with a divider", () => {
    renderChat([
      message({ id: "m1", createdAt: at(15, 9, 5) }),
      message({ id: "m2", createdAt: at(19, 10, 0) }),
      message({ id: "m3", createdAt: at(20, 11, 0) }),
    ])
    const dividers = screen.getAllByRole("separator")
    expect(dividers.map((d) => d.textContent)).toEqual(["Sunday 15 November", "Yesterday", "Today"])
    expect(dividers[0]).not.toHaveClass("animate-enter")
  })

  it("puts the first day divider above the intro", () => {
    renderChat(
      [message({ id: "m1", createdAt: at(15, 9, 5) }), message({ id: "m2", createdAt: at(19, 10, 0) })],
      <p>Welcome to the support chat.</p>,
    )
    const dividers = screen.getAllByRole("separator")
    expect(dividers.map((d) => d.textContent)).toEqual(["Sunday 15 November", "Yesterday"])
    const intro = screen.getByText("Welcome to the support chat.")
    expect(dividers[0].compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(intro.compareDocumentPosition(screen.getAllByText("Hello")[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("hides the name, time and avatar inside a grouped run", () => {
    const { container } = renderChat([
      message({ id: "m1", createdAt: at(20, 9, 5), content: "First" }),
      message({ id: "m2", createdAt: at(20, 9, 7), content: "Second" }),
      message({ id: "m3", createdAt: at(20, 9, 30), content: "Later" }),
    ])
    // m1 and m3 start a group; m2 continues m1's.
    expect(screen.getAllByText("Ada Lovelace")).toHaveLength(2)
    expect(screen.getByText("09:05")).toBeInTheDocument()
    expect(screen.queryByText("09:07")).not.toBeInTheDocument()
    expect(screen.getByText("09:30")).toBeInTheDocument()

    const row = screen.getByText("Second").closest(".flex.items-start") as HTMLElement
    expect(within(row).queryByText("Ada Lovelace")).not.toBeInTheDocument()
    // The avatar column is kept as an empty spacer.
    expect(row.firstElementChild).toBeEmptyDOMElement()
    expect(row.firstElementChild).toHaveClass("w-7.5")
    // One avatar per group start (the right panel has no participants here).
    expect(container.querySelectorAll('[data-slot="avatar"]')).toHaveLength(2)
    expect(row.querySelector('[data-slot="avatar"]')).not.toBeInTheDocument()
  })

  it('prefixes a plain system message with "Note · " and no box', () => {
    const { container } = renderChat([
      message({
        id: "s1",
        senderType: "system",
        senderName: "Acme Team",
        senderId: null,
        createdAt: at(20, 9, 0),
        content: "Feel free to chat before the ticket is claimed.",
      }),
    ])
    const note = container.querySelector('[data-slot="chat-note"]') as HTMLElement
    expect(note).toBeInTheDocument()
    expect(note.textContent).toBe("Note · Feel free to chat before the ticket is claimed.")
    expect(within(note).getByText("Note")).toHaveClass("font-semibold")
    expect(note.querySelector(".fi-rr-info")).toBeInTheDocument()
    expect(note.querySelector(".bg-muted")).not.toBeInTheDocument()
    expect(screen.queryByText("Acme Team")).not.toBeInTheDocument()
    expect(screen.queryByText("09:00")).not.toBeInTheDocument()
  })

  it("keeps the coloured callout for payment status messages", () => {
    const { container } = renderChat([
      message({
        id: "s1",
        senderType: "system",
        senderId: null,
        createdAt: at(20, 9, 0),
        content: "Payment method authorized.",
        paymentMetadata: { kind: "payment_authorized" },
      }),
    ])
    expect(container.querySelector('[data-slot="chat-note"]')).not.toBeInTheDocument()
    expect(screen.getByText(/Payment method authorized/).closest(".bg-status-success-bg")).toBeInTheDocument()
  })
})
