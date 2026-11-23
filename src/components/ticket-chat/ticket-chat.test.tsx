import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"

// MarkdownContent → ChatImage → useTicketAttachments pulls in the client, which throws without env vars.
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
// The real Header needs the router and the user/project contexts; the chat only hands it props.
vi.mock("@/components/layout/header", () => ({
  Header: (props: { title: string; variant?: string; inlineRightContent?: ReactNode; actions?: ReactNode }) => (
    <header data-variant={props.variant}>
      <h1>{props.title}</h1>
      {props.inlineRightContent}
      <div data-testid="header-actions">{props.actions}</div>
    </header>
  ),
}))

import { FIRST_OPEN_DELAY_MS, TicketChat, type TicketChatMessage, type TicketChatProps } from "./ticket-chat"

/** Local time on Sunday 15 November 2026 (day dividers and times are local). */
const at = (day: number, hour: number, minute: number) => new Date(2026, 10, day, hour, minute).toISOString()

const message = (id: string, overrides: Partial<TicketChatMessage> = {}): TicketChatMessage => ({
  id,
  senderType: "user",
  senderName: "patrick",
  senderId: "u1",
  timestamp: "15.11.2026, 10:17",
  content: `message ${id}`,
  ...overrides,
})

const welcome = message("welcome", {
  senderType: "system",
  senderName: "Acme Team",
  senderId: null,
  content: "You are not charged anything before you confirm.",
})

function renderChat(overrides: Partial<TicketChatProps> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ui = (next: Partial<TicketChatProps>) => (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TicketChat
          headerTitle="Ticket with Acme"
          messages={[welcome]}
          message=""
          onMessageChange={() => {}}
          onSend={() => {}}
          {...next}
        />
      </TooltipProvider>
    </QueryClientProvider>
  )
  const view = render(ui(overrides))
  return { ...view, rerenderChat: (next: Partial<TicketChatProps>) => view.rerender(ui(next)) }
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  window.localStorage.clear()
})

describe("TicketChat thread", () => {
  it("puts a day divider above the intro and above the first message of each later day", () => {
    const { container } = renderChat({
      intro: <div data-testid="intro">Welcome to Acme</div>,
      messages: [
        welcome,
        message("a", { createdAt: at(15, 10, 17) }),
        message("b", { createdAt: at(16, 9, 0), content: "next day" }),
      ],
    })
    const dividers = screen.getAllByRole("separator")
    expect(dividers.map((d) => d.getAttribute("aria-label"))).toEqual(["Sunday 15 November", "Monday 16 November"])
    // The first divider comes before the intro, the second right before the next day's message.
    const intro = screen.getByTestId("intro")
    expect(dividers[0].compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(intro.compareDocumentPosition(dividers[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(dividers[1].compareDocumentPosition(screen.getByText("next day")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Short threads are anchored to the bottom of the scroll container.
    expect(container.querySelector('[data-slot="chat-scroll"]')?.firstElementChild).toHaveClass(
      "min-h-full",
      "flex",
      "flex-col",
      "justify-end",
    )
  })

  it("groups follow-ups from the same sender without avatar, name or time", () => {
    const { container } = renderChat({
      messages: [
        welcome,
        message("a", { createdAt: at(15, 10, 17), content: "first" }),
        message("b", { createdAt: at(15, 10, 18), content: "second" }),
        message("c", { createdAt: at(15, 10, 40), content: "later" }),
        message("d", { createdAt: at(15, 10, 41), content: "reply", senderType: "helper", senderName: "Ada", senderId: "h1" }),
      ],
    })
    const rows = Array.from(container.querySelectorAll('[data-slot="chat-message-row"]'))
    expect(rows).toHaveLength(4)
    expect(rows.map((r) => r.hasAttribute("data-group-start"))).toEqual([true, false, true, true])

    // Group start: name and time only (no date).
    expect(within(rows[0] as HTMLElement).getByText("patrick")).toBeInTheDocument()
    expect(within(rows[0] as HTMLElement).getByText("10:17")).toBeInTheDocument()
    expect(screen.queryByText(/15\.11\.2026/)).not.toBeInTheDocument()

    // Follow-up: the column stays, but it is empty and there is no meta line.
    const followUp = rows[1] as HTMLElement
    expect(within(followUp).getByText("second")).toBeInTheDocument()
    expect(within(followUp).queryByText("patrick")).not.toBeInTheDocument()
    expect(within(followUp).queryByText("10:18")).not.toBeInTheDocument()
    expect(followUp.querySelector('[data-slot="chat-avatar-slot"]')).toBeEmptyDOMElement()

    expect(within(rows[3] as HTMLElement).getByText("Ada")).toBeInTheDocument()
    expect(within(rows[3] as HTMLElement).getByText("10:41")).toBeInTheDocument()
  })

  it("renders grey system messages as notes and keeps the coloured status boxes", () => {
    const { container } = renderChat({
      messages: [
        welcome,
        message("a", { createdAt: at(15, 10, 17) }),
        message("logged", {
          senderType: "system",
          senderId: null,
          createdAt: at(15, 10, 30),
          content: "Ada logged 00:30 h",
          paymentMetadata: { kind: "time_logged" },
        }),
        message("authorized", {
          senderType: "system",
          senderId: null,
          createdAt: at(15, 10, 31),
          content: "Payment authorized",
          paymentMetadata: { kind: "payment_authorized" },
        }),
      ],
    })
    const notes = Array.from(container.querySelectorAll('[data-slot="system-note"]'))
    expect(notes).toHaveLength(2)
    expect(notes[0]).toHaveTextContent("Note · You are not charged anything before you confirm.")
    expect(notes[1]).toHaveTextContent("Note · Ada logged 00:30 h")
    // No grey box and no sender name on a note.
    expect(container.querySelector(".bg-muted.ml-11")).toBeNull()
    expect(screen.queryByText("Acme Team")).not.toBeInTheDocument()

    const status = container.querySelector('[data-slot="chat-status-row"]') as HTMLElement
    expect(status).toHaveTextContent("✓ Payment authorized")
    expect(status.querySelector(".bg-status-success-bg")).not.toBeNull()
    expect(status.querySelector('[data-slot="system-note"]')).toBeNull()
  })

  it("keeps the payment CTA on a payment_required note", () => {
    const onPaymentCtaClick = vi.fn()
    const required = message("required", {
      senderType: "system",
      senderId: null,
      createdAt: at(15, 10, 30),
      content: "Add a payment method to continue.",
      paymentMetadata: { kind: "payment_required" },
    })
    const { container } = renderChat({ messages: [welcome, required], onPaymentCtaClick })
    const note = container.querySelectorAll('[data-slot="system-note"]')[1] as HTMLElement
    fireEvent.click(within(note).getByRole("button", { name: "Add payment method" }))
    expect(onPaymentCtaClick).toHaveBeenCalledWith(required)
  })
})

describe("TicketChat stored welcome row", () => {
  const storedWelcome = (overrides: Partial<TicketChatMessage> = {}) =>
    message("w1", {
      senderType: "system",
      senderName: "Live Name Team",
      senderId: null,
      kind: "welcome",
      isAutomatic: true,
      createdAt: at(15, 9, 41),
      content: "Welcome to Acme Inc's support chat.",
      welcome: {
        projectName: "Acme Inc",
        rates: { startPrice: "25.00", first60Price: "1.50", after60Price: "1.00" },
        isFree: false,
        freeText: null,
      },
      ...overrides,
    })
  const project = { id: "p1", name: "Live Name" }

  it("renders the welcome in the thread from the stored row, timestamped from created_at", () => {
    const { container } = renderChat({
      welcomeProject: project,
      messages: [
        storedWelcome(),
        message("note", {
          senderType: "system",
          senderId: null,
          isAutomatic: true,
          createdAt: at(15, 9, 41),
          content: "You are not charged anything before you confirm.",
        }),
        message("a", { createdAt: at(16, 10, 17), content: "next day" }),
      ],
    })
    const row = container.querySelector('[data-slot="chat-welcome"]') as HTMLElement
    // Stored name, text, rates and time; not the live project name or "now".
    expect(within(row).getByText("Acme Inc Team")).toBeInTheDocument()
    expect(within(row).getByText("Project")).toBeInTheDocument()
    expect(within(row).getByText("09:41")).toBeInTheDocument()
    expect(within(row).getByText("Welcome to Acme Inc's support chat.")).toBeInTheDocument()
    expect(within(row).getByText("25.00")).toBeInTheDocument()
    expect(within(row).getByText("1.50")).toBeInTheDocument()
    expect(within(row).getByText("1.00")).toBeInTheDocument()
    expect(screen.queryByText("Live Name Team")).not.toBeInTheDocument()
    // Not a system note, and no sign-in state.
    expect(row.closest('[data-slot="system-note"]')).toBeNull()
    expect(within(row).queryByRole("button")).not.toBeInTheDocument()

    // Day dividers come from the rows: the welcome's day first, then the next day's.
    const dividers = screen.getAllByRole("separator")
    expect(dividers.map((d) => d.getAttribute("aria-label"))).toEqual(["Sunday 15 November", "Monday 16 November"])
    expect(dividers[0].compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const note = container.querySelector('[data-slot="system-note"]') as HTMLElement
    expect(row.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(note.compareDocumentPosition(dividers[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("shows the stored free-support line instead of rates", () => {
    renderChat({
      welcomeProject: project,
      messages: [
        storedWelcome({
          welcome: {
            projectName: "Acme Inc",
            rates: null,
            isFree: true,
            freeText: "Acme Inc offers support for free - no payment method needed.",
          },
        }),
      ],
    })
    expect(screen.getByText("Free support")).toBeInTheDocument()
    expect(screen.getByText("Acme Inc offers support for free - no payment method needed.")).toBeInTheDocument()
    expect(screen.queryByText("Start price (USD)")).not.toBeInTheDocument()
  })

  it("lists no rates when the row stored none, and falls back to the project name only for the heading", () => {
    renderChat({
      welcomeProject: project,
      messages: [storedWelcome({ welcome: { projectName: null, rates: null, isFree: false, freeText: null } })],
    })
    expect(screen.getByText("Live Name Team")).toBeInTheDocument()
    expect(screen.queryByText("Rates")).not.toBeInTheDocument()
    expect(screen.queryByText("Rates not configured")).not.toBeInTheDocument()
  })
})

describe("TicketChat header", () => {
  it("shows End session in the header and opens the request dialog", async () => {
    const onRequestEndSession = vi.fn()
    renderChat({ headerVariant: "chat", ticketId: "b435097a-1111-2222-3333-444444444444", onRequestEndSession })

    expect(screen.getByRole("banner")).toHaveAttribute("data-variant", "chat")
    expect(within(screen.getByRole("banner")).getByText("b435097a..")).toBeInTheDocument()

    const actions = screen.getByTestId("header-actions")
    const endSession = within(actions).getByRole("button", { name: "End session" })
    // Only in the header: the composer toolbar no longer carries it.
    expect(screen.getAllByRole("button", { name: "End session" })).toEqual([endSession])

    fireEvent.click(endSession)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(onRequestEndSession).not.toHaveBeenCalled()
  })

  it("disables End session while a request is in flight and hides it when it does not apply", () => {
    const { unmount } = renderChat({ onRequestEndSession: vi.fn(), endSessionRequestPending: true })
    expect(screen.getByRole("button", { name: "End session" })).toBeDisabled()
    unmount()

    // Already requested, ended, or no handler: no button.
    const variants: Partial<TicketChatProps>[] = [
      { onRequestEndSession: vi.fn(), endSessionRequestedAt: at(15, 11, 0) },
      { onRequestEndSession: vi.fn(), isEnded: true },
      {},
    ]
    for (const props of variants) {
      const view = renderChat(props)
      expect(screen.queryByRole("button", { name: "End session" })).not.toBeInTheDocument()
      view.unmount()
    }
  })

  it("toggles the right panel from the header", () => {
    const { container } = renderChat()
    const actions = screen.getByTestId("header-actions")
    const panel = container.querySelector('[data-slot="chat-right-panel"]') as HTMLElement
    expect(panel).toHaveClass("lg:w-80")
    expect(panel).toHaveClass("border-l")

    fireEvent.click(within(actions).getByRole("button", { name: "Hide ticket details" }))
    expect(panel).toHaveClass("lg:w-0")
    expect(window.localStorage.getItem("sidebar:right:collapsed")).toBe("true")
    fireEvent.click(within(actions).getByRole("button", { name: "Show ticket details" }))
    expect(panel).toHaveClass("lg:w-80")
  })
})

describe("TicketChat composer and right panel", () => {
  it("uses the placeholder passed by the page", () => {
    renderChat({ composerPlaceholder: "Ask #githelp-crm" })
    expect(screen.getByPlaceholderText("Ask #githelp-crm")).toBeInTheDocument()
  })

  it("says when no helper has joined, below the participant rows", () => {
    renderChat({
      participants: [{ id: "u1", name: "patrick", avatarInitial: "P", isCurrentUser: true }],
      helperJoined: false,
    })
    expect(screen.getByText("You")).toBeInTheDocument()
    expect(screen.getByText("No helper has joined yet.")).toBeInTheDocument()
    expect(screen.getByText("No other topics yet.")).toBeInTheDocument()
  })

  it("hides the no-helper text while loading and once a helper has joined", () => {
    const loading = renderChat({ participantsLoading: true, helperJoined: false })
    expect(screen.queryByText("No helper has joined yet.")).not.toBeInTheDocument()
    loading.unmount()

    renderChat({
      participants: [
        { id: "u1", name: "patrick", avatarInitial: "P", isCurrentUser: true },
        { id: "h1", name: "Ada", avatarInitial: "A" },
      ],
      helperJoined: true,
      topics: ["billing"],
    })
    expect(screen.getByText("Ada")).toBeInTheDocument()
    expect(screen.queryByText("No helper has joined yet.")).not.toBeInTheDocument()
    expect(screen.queryByText("No other topics yet.")).not.toBeInTheDocument()
  })
})

describe("TicketChat first-open entrance", () => {
  const intro = <div data-testid="intro">Welcome to Acme</div>
  const openers = (container: HTMLElement) => container.querySelector('[data-slot="chat-openers"]') as HTMLElement | null
  const storedWelcome = message("w1", {
    senderType: "system",
    senderId: null,
    kind: "welcome",
    isAutomatic: true,
    createdAt: at(15, 9, 41),
    content: "Welcome to Acme's support chat.",
  })
  const storedNote = message("n1", {
    senderType: "system",
    senderId: null,
    isAutomatic: true,
    createdAt: at(15, 9, 41),
    content: "You are not charged anything before you confirm.",
  })
  const mockReducedMotion = (matches: boolean) =>
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: matches && query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )

  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("starts with an empty thread and reveals the divider and welcome together after the delay", () => {
    const { container } = renderChat({ firstOpenEntrance: true, intro, messages: [] })
    // Empty conversation first: the composer is there, the openers are not.
    expect(screen.getByRole("textbox")).toBeInTheDocument()
    expect(screen.queryByRole("separator")).not.toBeInTheDocument()
    expect(screen.queryByTestId("intro")).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(FIRST_OPEN_DELAY_MS - 1)
    })
    expect(screen.queryByTestId("intro")).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    // One wrapper carries the animation for the divider and the welcome.
    const wrapper = openers(container) as HTMLElement
    expect(wrapper).toHaveClass("animate-enter")
    expect(within(wrapper).getByRole("separator")).toBeInTheDocument()
    expect(within(wrapper).getByTestId("intro")).toBeInTheDocument()
  })

  it("swaps the stored welcome and note in without re-animating, and animates the first message once", () => {
    const { container, rerenderChat } = renderChat({ firstOpenEntrance: true, intro, messages: [], threadKey: "" })
    act(() => {
      vi.advanceTimersByTime(FIRST_OPEN_DELAY_MS)
    })
    const wrapper = openers(container) as HTMLElement

    // Ticket created: the pending first message shows, then the stored rows arrive.
    rerenderChat({
      firstOpenEntrance: true,
      threadKey: "t1",
      messages: [message("pending-first", { content: "my question" })],
    })
    const pendingRow = screen.getByText("my question").closest(".animate-enter") as HTMLElement
    expect(pendingRow).not.toBeNull()

    rerenderChat({
      firstOpenEntrance: true,
      threadKey: "t1",
      messages: [storedWelcome, storedNote, message("m1", { content: "my question", createdAt: at(15, 9, 42) })],
    })
    // Same wrapper element, now holding the stored rows; they carry no animation of their own.
    expect(openers(container)).toBe(wrapper)
    expect(screen.queryByTestId("intro")).not.toBeInTheDocument()
    const welcomeRow = within(wrapper).getByText("Welcome to Acme's support chat.")
    const noteRow = within(wrapper).getByText("You are not charged anything before you confirm.")
    expect(welcomeRow.closest(".animate-enter")).toBe(wrapper)
    expect(noteRow.closest(".animate-enter")).toBe(wrapper)
    // The first message kept its element when the stored copy replaced the pending one.
    expect(screen.getByText("my question").closest(".animate-enter")).toBe(pendingRow)
    expect(wrapper).not.toContainElement(pendingRow)
  })

  it("renders an existing ticket immediately, without the entrance", () => {
    const { container } = renderChat({
      threadKey: "t1",
      messages: [storedWelcome, storedNote, message("m1", { createdAt: at(15, 9, 42) })],
    })
    expect(screen.getByRole("separator")).toBeInTheDocument()
    expect(screen.getByText("Welcome to Acme's support chat.")).toBeInTheDocument()
    expect(screen.getByText("message m1")).toBeInTheDocument()
    expect(container.querySelector(".animate-enter")).toBeNull()

    act(() => {
      vi.advanceTimersByTime(FIRST_OPEN_DELAY_MS * 2)
    })
    expect(container.querySelector(".animate-enter")).toBeNull()
  })

  it("shows everything at once when a first-open thread turns out to be an existing ticket", () => {
    const { container, rerenderChat } = renderChat({ firstOpenEntrance: true, intro, messages: [] })
    expect(screen.queryByRole("separator")).not.toBeInTheDocument()
    // E.g. a guest's open ticket is resumed before the delay has passed.
    rerenderChat({ firstOpenEntrance: false, messages: [storedWelcome, storedNote, message("m1", { createdAt: at(15, 9, 42) })] })
    expect(screen.getByText("Welcome to Acme's support chat.")).toBeInTheDocument()
    expect(screen.getByText("message m1")).toBeInTheDocument()
    expect(container.querySelector(".animate-enter")).toBeNull()
  })

  it("skips the delay and the animation under prefers-reduced-motion", () => {
    mockReducedMotion(true)
    const { container } = renderChat({ firstOpenEntrance: true, intro, messages: [] })
    expect(screen.getByRole("separator")).toBeInTheDocument()
    expect(screen.getByTestId("intro")).toBeInTheDocument()
    expect(openers(container)).not.toHaveClass("animate-enter")

    act(() => {
      vi.advanceTimersByTime(FIRST_OPEN_DELAY_MS * 2)
    })
    expect(openers(container)).not.toHaveClass("animate-enter")
  })
})
