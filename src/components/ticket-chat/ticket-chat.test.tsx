import type { ComponentProps, ReactNode } from "react"
import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TicketChat, type TicketChatMessage } from "./ticket-chat"

// The thread is under test; the Header needs the whole provider chain.
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/components/layout/header", () => ({
  Header: ({ title, inlineRightContent, actions }: { title: string; inlineRightContent?: ReactNode; actions?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {inlineRightContent}
      {actions}
    </header>
  ),
}))

vi.mock("@/hooks/useTicketAttachments", () => ({
  useTicketAttachmentUpload: () => ({ uploadFiles: vi.fn(), isUploading: false }),
}))

// jsdom has no scrollIntoView; the thread scrolls to the bottom on the next frame.
Element.prototype.scrollIntoView = vi.fn()

/** ISO string for a local wall-clock time, so the expected stamps hold in any time zone. */
const at = (day: number, hours: number, minutes: number) => new Date(2026, 10, day, hours, minutes).toISOString()

const userMessage = (id: string, createdAt: string, content: string): TicketChatMessage => ({
  id,
  senderType: "user",
  senderId: "u1",
  senderName: "Ada Lovelace",
  timestamp: "15.11.2026, 14:05",
  createdAt,
  content,
})

function renderChat(messages: TicketChatMessage[], props: Partial<ComponentProps<typeof TicketChat>> = {}) {
  return render(
    <TooltipProvider>
      <TicketChat
        headerTitle="Ticket"
        messages={messages}
        message=""
        onMessageChange={vi.fn()}
        onSend={vi.fn()}
        {...props}
      />
    </TooltipProvider>,
  )
}

describe("TicketChat thread", () => {
  it("shows one name and one time for a grouped run", () => {
    renderChat([
      userMessage("m1", at(15, 14, 5), "First message"),
      userMessage("m2", at(15, 14, 6), "Second message"),
      userMessage("m3", at(15, 14, 7), "Third message"),
    ])
    expect(screen.getByText("First message")).toBeInTheDocument()
    expect(screen.getByText("Third message")).toBeInTheDocument()
    expect(screen.getAllByText("Ada Lovelace")).toHaveLength(1)
    expect(screen.getAllByText("14:05")).toHaveLength(1)
    expect(screen.queryByText("14:06")).not.toBeInTheDocument()
  })

  it("repeats the header when the run is broken by more than five minutes", () => {
    renderChat([
      userMessage("m1", at(15, 14, 5), "First message"),
      userMessage("m2", at(15, 14, 30), "Second message"),
    ])
    expect(screen.getAllByText("Ada Lovelace")).toHaveLength(2)
  })

  it("renders a day divider for each day", () => {
    const { container } = renderChat([
      userMessage("m1", at(15, 14, 5), "First message"),
      userMessage("m2", at(16, 9, 0), "Second message"),
    ])
    const dividers = container.querySelectorAll('[data-slot="chat-day-divider"]')
    expect(dividers).toHaveLength(2)
    expect(dividers[0]).toHaveTextContent("Sunday 15 November")
    expect(dividers[1]).toHaveTextContent("Monday 16 November")
    dividers.forEach((divider) => {
      const label = divider.querySelector("span")
      expect(label).not.toBeNull()
      expect(label).not.toHaveClass("font-mono")
      expect(label).toHaveClass("text-xs", "text-muted-foreground")
    })
  })

  it("renders a system message as a 'Note' without the grey box", () => {
    const { container } = renderChat([
      { id: "s1", senderType: "system", timestamp: "", content: "This is an automatic reply." },
    ])
    const note = container.querySelector('[data-slot="chat-note"]') as HTMLElement
    expect(note).toHaveTextContent("Note · This is an automatic reply.")
    expect(screen.getByText("Note")).toHaveClass("font-semibold")
    expect(note.className).not.toContain("bg-muted")
    expect(note.querySelector(".bg-muted")).toBeNull()
    expect(screen.queryByText("System")).not.toBeInTheDocument()
  })

  it("stamps messages with the time only, falling back to the timestamp without createdAt", () => {
    renderChat([
      userMessage("m1", at(15, 9, 3), "Dated"),
      { id: "m2", senderType: "helper", senderId: "h1", senderName: "Grace", timestamp: "just now", content: "Undated" },
    ])
    expect(screen.getByText("09:03")).toHaveClass("font-mono", "tabular-nums")
    expect(screen.queryByText("15.11.2026, 14:05")).not.toBeInTheDocument()
    expect(screen.getByText("just now")).toBeInTheDocument()
  })
})

describe("TicketChat header", () => {
  const TICKET_ID = "3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f"

  it("shows the first 8 characters of the ticket ID and copies the full ID", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })

    const { container } = renderChat([], { ticketId: TICKET_ID })
    const pill = container.querySelector('[data-slot="ticket-id-pill"]') as HTMLElement
    expect(pill).toHaveTextContent("3f2a9c1e")
    expect(pill).not.toHaveTextContent(TICKET_ID)
    expect(pill).toHaveClass("font-mono", "bg-bg-subtle")

    fireEvent.click(screen.getByRole("button", { name: "Copy full ticket ID" }))
    expect(writeText).toHaveBeenCalledWith(TICKET_ID)
    const copied = await screen.findByText("Copied")
    expect(copied).toHaveAttribute("aria-live", "polite")
  })

  it("has no ticket ID pill without a ticket", () => {
    const { container } = renderChat([])
    expect(container.querySelector('[data-slot="ticket-id-pill"]')).toBeNull()
    expect(screen.queryByRole("button", { name: "Copy full ticket ID" })).not.toBeInTheDocument()
  })

  it("puts 'End session' in the header and opens the confirmation dialog", () => {
    renderChat([], { onRequestEndSession: vi.fn() })
    const button = within(screen.getByRole("banner")).getByRole("button", { name: "End session" })
    expect(screen.getAllByRole("button", { name: "End session" })).toHaveLength(1)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(button)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("hides 'End session' without a handler, once requested and on an ended ticket", () => {
    const { unmount } = renderChat([])
    expect(screen.queryByRole("button", { name: "End session" })).not.toBeInTheDocument()
    unmount()
    const requested = renderChat([], { onRequestEndSession: vi.fn(), endSessionRequestedAt: at(15, 14, 5) })
    expect(screen.queryByRole("button", { name: "End session" })).not.toBeInTheDocument()
    requested.unmount()
    renderChat([], { onRequestEndSession: vi.fn(), isEnded: true })
    expect(screen.queryByRole("button", { name: "End session" })).not.toBeInTheDocument()
  })
})

describe("TicketChat right panel", () => {
  it("says no helper has joined yet, with and without participants", () => {
    const { unmount } = renderChat([])
    expect(screen.getByText("No helper has joined yet.")).toHaveClass("text-ui", "text-text-note")
    unmount()
    renderChat([], { participants: [{ id: "u1", name: "Ada Lovelace", avatarInitial: "A" }] })
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
    expect(screen.getByText("No helper has joined yet.")).toBeInTheDocument()
  })

  it("drops the helper note once a helper has joined or while loading", () => {
    const { unmount } = renderChat([], { helperJoined: true })
    expect(screen.queryByText("No helper has joined yet.")).not.toBeInTheDocument()
    unmount()
    renderChat([], { participantsLoading: true })
    expect(screen.queryByText("No helper has joined yet.")).not.toBeInTheDocument()
  })

  it("shows a left-aligned note when there are no other topics", () => {
    const { unmount } = renderChat([])
    expect(screen.getByText("No other topics yet.")).toHaveClass("text-ui", "text-text-note", "text-left")
    expect(screen.queryByText("-")).not.toBeInTheDocument()
    unmount()
    renderChat([], { topics: ["Billing"] })
    expect(screen.queryByText("No other topics yet.")).not.toBeInTheDocument()
  })
})
