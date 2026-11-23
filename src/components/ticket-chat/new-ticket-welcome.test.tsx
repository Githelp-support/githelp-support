import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"

// MarkdownContent → ChatImage → useTicketAttachments pulls in the client, which throws without env vars.
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/components/layout/header", () => ({
  Header: (props: { title: string; actions?: ReactNode }) => (
    <header>
      <h1>{props.title}</h1>
      {props.actions}
    </header>
  ),
}))

import { FIRST_OPEN_DELAY_MS, TicketChat } from "./ticket-chat"
import { CustomerChatIntro } from "./customer-chat-intro"
import {
  buildCustomerThreadMessages,
  START_NOTE,
  START_NOTE_FREE,
  type PersistedTicketMessage,
} from "@/lib/customer-chat-messages"
import { formatTicketRates, isFreeSupport, type TicketPriceSettings } from "@/lib/ticket-pricing"
import { isAutomaticMessage, latestReadableMessageId } from "@/lib/ticket-message-summary"

/**
 * A new ticket, from creation to what the customer sees.
 *
 * `FakeDb` stands in for the database. With `migrated: true` it writes what
 * the triggers of backend migration 20261123120000_ticket_welcome_messages
 * write (welcome + start note on ticket insert, auto-reply after the first
 * user message; the triggers themselves are tested by the backend harness
 * probes R15a–g). With `migrated: false` it is a database that does not have
 * that migration: nothing is stored. The thread must show the welcome, the
 * rates and the notes in both cases.
 */
type Row = PersistedTicketMessage & { ticket_id: string }
type Ticket = { id: string; project_id: string; created_at: string; pricing_snapshot: TicketPriceSettings | null }

class FakeDb {
  rows: Row[] = []
  private seq = 0
  constructor(
    private migrated: boolean,
    private projectName = "Acme",
  ) {}

  private plusMs(iso: string, ms: number) {
    return new Date(new Date(iso).getTime() + ms).toISOString()
  }

  private system(ticketId: string, created_at: string, content: string, metadata: Record<string, unknown>) {
    this.rows.push({
      id: `row-${++this.seq}`,
      ticket_id: ticketId,
      sender_type: "system",
      sender_id: null,
      is_automatic: true,
      created_at,
      content,
      metadata,
    })
  }

  createTicket(pricing_snapshot: TicketPriceSettings | null, created_at: string): Ticket {
    const ticket: Ticket = { id: "t1", project_id: "p1", created_at, pricing_snapshot }
    if (!this.migrated) return ticket
    // insert_ticket_welcome_messages()
    const isFree = isFreeSupport(pricing_snapshot)
    this.system(
      ticket.id,
      created_at,
      `Welcome to ${this.projectName}'s support chat.\nAsk your question and someone from our team will try to help you, as soon as we can.`,
      {
        kind: "welcome",
        project_name: this.projectName,
        rates: { ...pricing_snapshot, currency: "usd", is_free: isFree },
        rates_source: "ticket_snapshot",
        ...(isFree ? { free_text: `${this.projectName} offers support for free - no payment method needed.` } : {}),
      },
    )
    this.system(ticket.id, this.plusMs(created_at, 1), isFree ? START_NOTE_FREE : START_NOTE, {
      kind: "start_note",
      is_free: isFree,
    })
    return ticket
  }

  sendUserMessage(ticket: Ticket, content: string, created_at: string) {
    const first = !this.rows.some((r) => r.sender_type === "user")
    this.rows.push({
      id: `row-${++this.seq}`,
      ticket_id: ticket.id,
      sender_type: "user",
      sender_id: "u1",
      is_automatic: false,
      created_at,
      content,
      metadata: null,
    })
    // insert_ticket_auto_reply(): no response-time sentence without a value.
    if (this.migrated && first) {
      this.system(
        ticket.id,
        this.plusMs(created_at, 1),
        "Thank you for reaching out! A helper will get in touch with you as soon as possible.",
        { kind: "auto_reply" },
      )
    }
  }

  /** `useTicketMessages`: every row of the ticket, oldest first, nothing filtered out. */
  messages(ticketId: string): Row[] {
    return this.rows
      .filter((r) => r.ticket_id === ticketId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
}

const RATES: TicketPriceSettings = {
  ticket_start_price: 500,
  ticket_price_minute_first_60: 50,
  ticket_price_minute_after_60: 25,
}
const FREE: TicketPriceSettings = {
  ticket_start_price: 0,
  ticket_price_minute_first_60: 0,
  ticket_price_minute_after_60: 0,
}
const CREATED_AT = new Date(2026, 10, 15, 9, 41, 0).toISOString()
const FIRST_MESSAGE_AT = new Date(2026, 10, 15, 9, 41, 2).toISOString()

/** What the customer pages (`/support`, `/support/chat`) hand to TicketChat for a conversation started in this chat. */
function chatUi(opts: {
  ticket: Ticket | null
  /** `undefined` while the messages query is loading. */
  messagesData: Row[] | undefined
  /** The project's live settings (may have changed since the ticket was opened). */
  liveSettings: TicketPriceSettings | null
  pendingFirstMessage?: string | null
}) {
  const { ticket, messagesData, liveSettings, pendingFirstMessage } = opts
  const effectivePricing = ticket?.pricing_snapshot ?? liveSettings
  const welcomeText = "Welcome to Acme's support chat.\nAsk your question and someone from our team will try to help you, as soon as we can."
  const messages = buildCustomerThreadMessages({
    projectName: "Acme",
    projectLogo: null,
    nowFormatted: "15.11.2026, 09:40",
    messagesData,
    pendingFirstMessage,
    fallbackTimestamp: ticket?.created_at ?? null,
    currentUser: { id: "u1", name: "patrick" },
    fallback: {
      welcome: !!ticket,
      welcomeText,
      rates: formatTicketRates(effectivePricing),
      isFree: isFreeSupport(effectivePricing),
      avgResponseSeconds: null,
      whileLoading: true,
    },
  })
  return (
    <TicketChat
      headerTitle="Ticket with Acme"
      threadKey={ticket?.id}
      firstOpenEntrance
      welcomeProject={{ id: "p1", name: "Acme" }}
      intro={
        ticket ? undefined : (
          <CustomerChatIntro
            projectId="p1"
            projectName="Acme"
            projectLogo={null}
            welcomeText={welcomeText}
            timestamp="09:40"
            rates={formatTicketRates(liveSettings)}
            isFree={isFreeSupport(liveSettings)}
            isAuthenticated
            ticketCreated={false}
            onSignIn={() => {}}
          />
        )
      }
      messages={messages}
      message=""
      onMessageChange={() => {}}
      onSend={() => {}}
    />
  )
}

function renderChat(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrap = (node: ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{node}</TooltipProvider>
    </QueryClientProvider>
  )
  const view = render(wrap(ui))
  return { ...view, rerenderChat: (node: ReactNode) => view.rerender(wrap(node)) }
}

const reveal = () =>
  act(() => {
    vi.advanceTimersByTime(FIRST_OPEN_DELAY_MS)
  })

/** Text of the thread's blocks, top to bottom: the welcome, each note, each message. */
function threadOrder(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll('[data-slot="chat-welcome"], [data-slot="system-note"], [data-slot="chat-message-row"]'),
  ).map((el) => {
    if (el.getAttribute("data-slot") === "chat-welcome") return "welcome"
    if (el.getAttribute("data-slot") === "system-note") return `note: ${el.textContent}`
    return "message"
  })
}

const EXPECTED_ORDER = [
  "welcome",
  `note: Note · ${START_NOTE}`,
  "message",
  "note: Note · Thank you for reaching out! A helper will get in touch with you as soon as possible.",
]

function expectRates(container: HTMLElement) {
  const block = container.querySelector('[data-slot="chat-welcome"]') as HTMLElement
  expect(block).not.toBeNull()
  expect(within(block).getByText("Acme Team")).toBeInTheDocument()
  expect(within(block).getByText(/Welcome to Acme's support chat\./)).toBeInTheDocument()
  expect(within(block).getByText("Rates")).toBeInTheDocument()
  expect(within(block).getByText("5.00")).toBeInTheDocument()
  expect(within(block).getByText("0.50")).toBeInTheDocument()
  expect(within(block).getByText("0.25")).toBeInTheDocument()
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  window.localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe.each([
  { name: "database with the welcome migration (rows are stored)", migrated: true },
  { name: "database without the welcome migration (nothing is stored)", migrated: false },
])("creating a ticket: $name", ({ migrated }) => {
  it("shows the welcome, the rates and the notes in order, from the first open to after the first message", () => {
    const db = new FakeDb(migrated)

    // 1. The chat opens: empty, then the welcome preview and the start note appear.
    const { container, rerenderChat } = renderChat(chatUi({ ticket: null, messagesData: undefined, liveSettings: RATES }))
    expect(container.querySelector('[data-slot="chat-welcome"]')).toBeNull()
    reveal()
    expectRates(container)
    expect(threadOrder(container)).toEqual(EXPECTED_ORDER.slice(0, 2))

    // 2. The first message creates the ticket; its messages have not loaded yet.
    const ticket = db.createTicket(RATES, CREATED_AT)
    rerenderChat(chatUi({ ticket, messagesData: undefined, liveSettings: RATES, pendingFirstMessage: "my question" }))
    expectRates(container)
    expect(threadOrder(container)).toEqual(EXPECTED_ORDER)

    // 3. The messages load. The project has changed its prices meanwhile: the
    //    ticket keeps the rates it was opened with.
    db.sendUserMessage(ticket, "my question", FIRST_MESSAGE_AT)
    const changed = { ticket_start_price: 9900, ticket_price_minute_first_60: 990, ticket_price_minute_after_60: 990 }
    rerenderChat(chatUi({ ticket, messagesData: db.messages(ticket.id), liveSettings: changed }))
    expectRates(container)
    expect(screen.queryByText("99.00")).not.toBeInTheDocument()
    expect(threadOrder(container)).toEqual(EXPECTED_ORDER)
    expect(screen.getByText("my question")).toBeInTheDocument()
    // Exactly one of each: a stored row replaces its stand-in, it never doubles.
    expect(container.querySelectorAll('[data-slot="chat-welcome"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-slot="system-note"]')).toHaveLength(2)
  })

  it("shows the free-support sentence instead of rates for a free project", () => {
    const db = new FakeDb(migrated)
    const ticket = db.createTicket(FREE, CREATED_AT)
    db.sendUserMessage(ticket, "my question", FIRST_MESSAGE_AT)
    const { container } = renderChat(chatUi({ ticket, messagesData: db.messages(ticket.id), liveSettings: FREE }))
    reveal()
    const block = container.querySelector('[data-slot="chat-welcome"]') as HTMLElement
    expect(within(block).getByText("Acme offers support for free - no payment method needed.")).toBeInTheDocument()
    expect(within(block).queryByText("0.00")).not.toBeInTheDocument()
    expect(threadOrder(container)[1]).toBe(`note: Note · ${START_NOTE_FREE}`)
  })
})

describe("creating a ticket: what the database stores (welcome migration applied)", () => {
  it("stores the welcome with the rate snapshot, the start note 1 ms later and the auto-reply after the first message", () => {
    const db = new FakeDb(true)
    const ticket = db.createTicket(RATES, CREATED_AT)
    db.sendUserMessage(ticket, "my question", FIRST_MESSAGE_AT)

    const rows = db.messages(ticket.id)
    expect(rows.map((r) => r.metadata?.kind ?? r.sender_type)).toEqual(["welcome", "start_note", "user", "auto_reply"])
    const [welcome, note, , reply] = rows
    expect(welcome.created_at).toBe(CREATED_AT)
    expect(new Date(note.created_at).getTime() - new Date(CREATED_AT).getTime()).toBe(1)
    expect(new Date(reply.created_at).getTime() - new Date(FIRST_MESSAGE_AT).getTime()).toBe(1)
    expect(welcome.metadata?.rates).toEqual({ ...RATES, currency: "usd", is_free: false })
    expect(reply.content).not.toContain("average response time")
    // Marked automatic, and kept out of previews, counts and read state.
    ;[welcome, note, reply].forEach((r) => {
      expect(r.is_automatic).toBe(true)
      expect(isAutomaticMessage(r)).toBe(true)
    })
    expect(latestReadableMessageId(rows)).toBe(rows[2].id)
  })
})

describe("creating a ticket: the entrance can never leave the welcome hidden", () => {
  const mockReducedMotion = () =>
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )

  it("still reveals it when the page re-renders, and the ticket is created, during the delay", () => {
    const db = new FakeDb(false)
    const { container, rerenderChat } = renderChat(chatUi({ ticket: null, messagesData: undefined, liveSettings: RATES }))
    act(() => {
      vi.advanceTimersByTime(FIRST_OPEN_DELAY_MS / 2)
    })
    // Re-renders (settings arriving, the visitor typing) and a very fast first
    // message, all before the delay has passed.
    rerenderChat(chatUi({ ticket: null, messagesData: undefined, liveSettings: RATES }))
    const ticket = db.createTicket(RATES, CREATED_AT)
    rerenderChat(chatUi({ ticket, messagesData: undefined, liveSettings: RATES, pendingFirstMessage: "my question" }))
    rerenderChat(chatUi({ ticket, messagesData: [], liveSettings: RATES, pendingFirstMessage: "my question" }))

    // The delay is not restarted by any of that.
    act(() => {
      vi.advanceTimersByTime(FIRST_OPEN_DELAY_MS / 2)
    })
    expectRates(container)
    expect(threadOrder(container)).toEqual(EXPECTED_ORDER)
  })

  it("shows it again after the chat is unmounted and mounted again (e.g. a loading state in between)", () => {
    const db = new FakeDb(true)
    const ticket = db.createTicket(RATES, CREATED_AT)
    db.sendUserMessage(ticket, "my question", FIRST_MESSAGE_AT)
    const ui = chatUi({ ticket, messagesData: db.messages(ticket.id), liveSettings: RATES })

    const first = renderChat(ui)
    reveal()
    first.unmount()
    const second = renderChat(ui)
    reveal()
    expectRates(second.container)
    expect(threadOrder(second.container)).toEqual(EXPECTED_ORDER)
  })

  it("shows it at once, without a delay, under prefers-reduced-motion", () => {
    mockReducedMotion()
    const db = new FakeDb(false)
    const { container, rerenderChat } = renderChat(chatUi({ ticket: null, messagesData: undefined, liveSettings: RATES }))
    expectRates(container)
    expect(threadOrder(container)).toEqual(EXPECTED_ORDER.slice(0, 2))

    const ticket = db.createTicket(RATES, CREATED_AT)
    rerenderChat(chatUi({ ticket, messagesData: [], liveSettings: RATES, pendingFirstMessage: "my question" }))
    expectRates(container)
    expect(threadOrder(container)).toEqual(EXPECTED_ORDER)
    expect(container.querySelector('[data-slot="chat-openers"]')).not.toHaveClass("animate-enter")
  })
})
