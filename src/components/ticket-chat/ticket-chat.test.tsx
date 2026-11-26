import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { WELCOME_REVEAL_DELAY_MS } from "@/lib/welcome-reveal"
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

// Read tracking: assert what the chat asks the hook for, not the RPC itself.
vi.mock("@/hooks/useTicketReadState", () => ({ useMarkTicketRead: vi.fn() }))

import { useMarkTicketRead } from "@/hooks/useTicketReadState"
import { TicketChat, type TicketChatMessage, type TicketChatProps } from "./ticket-chat"

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
  const props: TicketChatProps = {
    headerTitle: "Ticket with Acme",
    messages: [welcome],
    message: "",
    onMessageChange: () => {},
    onSend: () => {},
    ...overrides,
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TicketChat {...props} />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  window.localStorage.clear()
})

describe("TicketChat thread", () => {
  it("renders the intro in place of the stored welcome row, once, in created_at order", () => {
    renderChat({
      intro: <div data-testid="intro">Welcome to Acme</div>,
      messages: [
        message("w", {
          senderType: "system",
          senderId: null,
          kind: "welcome",
          content: "Welcome to Acme's support chat.",
          createdAt: at(15, 10, 16),
        }),
        message("d", { senderType: "system", senderId: null, content: "Not charged yet.", createdAt: at(15, 10, 16) }),
        message("a", { createdAt: at(15, 10, 17) }),
      ],
    })
    const intro = screen.getAllByTestId("intro")
    expect(intro).toHaveLength(1)
    // The stored welcome text is not repeated as a note; the disclaimer is one.
    expect(screen.queryByText("Welcome to Acme's support chat.")).toBeNull()
    const note = screen.getByText("Not charged yet.")
    expect(intro[0].compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(note.closest("[data-slot='system-note']")).not.toBeNull()
  })

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

describe("TicketChat welcome entrance", () => {
  const thread = [
    message("w", { senderType: "system", senderId: null, kind: "welcome", content: "Welcome.", createdAt: at(15, 10, 16) }),
    message("d", {
      senderType: "system",
      senderId: null,
      content: "Not charged yet.",
      createdAt: at(15, 10, 16),
      paymentMetadata: { kind: "welcome_disclaimer" },
    }),
  ]
  const intro = <div data-testid="intro">Welcome to Acme</div>

  beforeEach(() => {
    window.sessionStorage.clear()
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
  })

  it("reveals the welcome group once after a beat for a freshly created ticket", () => {
    vi.useFakeTimers()
    try {
      window.sessionStorage.setItem("welcome-reveal:t1", "1")
      renderChat({ intro, messages: thread, welcomeRevealId: "t1" })
      expect(screen.queryByTestId("intro")).toBeNull()
      expect(screen.queryByText("Not charged yet.")).toBeNull()
      expect(screen.getByRole("status", { name: "Loading welcome message" })).toBeInTheDocument()
      expect(screen.getByRole("separator")).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(WELCOME_REVEAL_DELAY_MS))
      expect(screen.getByTestId("intro").closest(".animate-fade-in")).not.toBeNull()
      expect(screen.getByText("Not charged yet.").closest(".animate-enter")).not.toBeNull()
      expect(window.sessionStorage.getItem("welcome-reveal:t1")).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("keeps an intro that was already on screen when the ticket is created from the chat", () => {
    vi.useFakeTimers()
    try {
      const wrap = (node: ReactNode) => (
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>{node}</TooltipProvider>
        </QueryClientProvider>
      )
      const base: Omit<TicketChatProps, "messages"> = { headerTitle: "Ticket with Acme", message: "", onMessageChange: () => {}, onSend: () => {}, intro }
      // Before the ticket exists: the intro above an empty thread.
      const { rerender } = render(wrap(<TicketChat {...base} messages={[]} />))
      expect(screen.getByTestId("intro")).toBeInTheDocument()

      // Created: the flag is set and the stored rows arrive.
      window.sessionStorage.setItem("welcome-reveal:t3", "1")
      rerender(wrap(<TicketChat {...base} messages={thread} welcomeRevealId="t3" />))
      expect(screen.getByTestId("intro")).toBeInTheDocument()
      expect(screen.getByTestId("intro").closest(".animate-fade-in")).toBeNull()
      expect(screen.queryByText("Not charged yet.")).toBeNull()

      act(() => vi.advanceTimersByTime(WELCOME_REVEAL_DELAY_MS))
      expect(screen.getByTestId("intro").closest(".animate-fade-in")).toBeNull()
      expect(screen.getByText("Not charged yet.").closest(".animate-enter")).not.toBeNull()
      expect(window.sessionStorage.getItem("welcome-reveal:t3")).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("shows everything immediately when the ticket is not flagged", () => {
    vi.useFakeTimers()
    try {
      renderChat({ intro, messages: thread, welcomeRevealId: "t1" })
      expect(screen.getByTestId("intro").closest(".animate-fade-in")).toBeNull()
      expect(screen.getByText("Not charged yet.")).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(WELCOME_REVEAL_DELAY_MS))
      expect(screen.getByTestId("intro").closest(".animate-fade-in")).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("ignores the flag on views without welcomeRevealId (helper/admin) and leaves it set", () => {
    window.sessionStorage.setItem("welcome-reveal:t1", "1")
    renderChat({ intro, messages: thread })
    expect(screen.getByTestId("intro").closest(".animate-fade-in")).toBeNull()
    expect(screen.getByText("Not charged yet.")).toBeInTheDocument()
    expect(window.sessionStorage.getItem("welcome-reveal:t1")).toBe("1")
  })

  it("is immediate under reduced motion and retires the flag", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    window.sessionStorage.setItem("welcome-reveal:t2", "1")
    renderChat({ intro, messages: thread, welcomeRevealId: "t2" })
    expect(screen.getByTestId("intro").closest(".animate-fade-in")).toBeNull()
    expect(screen.getByText("Not charged yet.").closest(".animate-enter")).toBeNull()
    expect(screen.getByRole("separator")).toBeInTheDocument()
    expect(window.sessionStorage.getItem("welcome-reveal:t2")).toBeNull()
  })
})

describe("TicketChat intro entrance on opening a fresh chat", () => {
  const intro = <div data-testid="intro">Welcome to Acme</div>
  const wrap = (node: ReactNode) => (
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>{node}</TooltipProvider>
    </QueryClientProvider>
  )
  const base: Omit<TicketChatProps, "messages"> = { headerTitle: "Ticket with Acme", message: "", onMessageChange: () => {}, onSend: () => {}, intro }

  beforeEach(() => {
    window.sessionStorage.clear()
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
  })

  it("renders the empty conversation first, then the day divider and intro enter after a beat", () => {
    vi.useFakeTimers()
    try {
      render(wrap(<TicketChat {...base} messages={[]} introEntrance />))
      expect(screen.queryByTestId("intro")).toBeNull()
      // The day divider and the welcome's skeleton are there from the start.
      expect(screen.getByRole("separator")).toBeInTheDocument()
      expect(screen.getByRole("status", { name: "Loading welcome message" })).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(WELCOME_REVEAL_DELAY_MS - 1))
      expect(screen.queryByTestId("intro")).toBeNull()

      act(() => vi.advanceTimersByTime(1))
      // The message replaces its skeleton with a fade.
      expect(screen.getByTestId("intro").closest(".animate-fade-in")).not.toBeNull()
      expect(screen.queryByRole("status", { name: "Loading welcome message" })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("stands down and shows everything at once when a ticket turns up before the beat", () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(wrap(<TicketChat {...base} messages={[]} introEntrance />))
      expect(screen.queryByTestId("intro")).toBeNull()
      // e.g. a guest's open ticket was resumed
      rerender(wrap(<TicketChat {...base} messages={[]} introEntrance={false} />))
      expect(screen.getByTestId("intro").closest(".animate-fade-in")).toBeNull()
      act(() => vi.advanceTimersByTime(WELCOME_REVEAL_DELAY_MS))
      expect(screen.getByTestId("intro").closest(".animate-fade-in")).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("keeps the intro in place once the ticket is created after the entrance", () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(wrap(<TicketChat {...base} messages={[]} introEntrance />))
      act(() => vi.advanceTimersByTime(WELCOME_REVEAL_DELAY_MS))
      expect(screen.getByTestId("intro")).toBeInTheDocument()
      rerender(wrap(<TicketChat {...base} messages={[message("u1", { content: "Help", createdAt: at(15, 10, 17) })]} introEntrance={false} />))
      expect(screen.getByTestId("intro")).toBeInTheDocument()
      expect(screen.getByText("Help")).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it("shows the intro at once without the prop (existing tickets, helper/admin) and under reduced motion", () => {
    const { unmount } = render(wrap(<TicketChat {...base} messages={[]} />))
    expect(screen.getByTestId("intro").closest(".animate-fade-in")).toBeNull()
    unmount()
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    render(wrap(<TicketChat {...base} messages={[]} introEntrance />))
    expect(screen.getByTestId("intro").closest(".animate-fade-in")).toBeNull()
    expect(screen.getByRole("separator")).toBeInTheDocument()
  })
})

describe("TicketChat read tracking", () => {
  const markRead = vi.mocked(useMarkTicketRead)
  let visibility: DocumentVisibilityState = "visible"
  let focused = true

  /** The last `enabled` the chat passed for this ticket and message. */
  const lastCall = () => {
    const call = markRead.mock.calls[markRead.mock.calls.length - 1]
    return { ticketId: call[0], messageId: call[1], enabled: call[2]?.enabled }
  }

  /** Give the scroll container a geometry (jsdom has no layout) and fire a scroll. */
  const scrollTo = (box: HTMLElement, { scrollHeight, clientHeight, scrollTop }: Record<string, number>) => {
    Object.defineProperty(box, "scrollHeight", { configurable: true, value: scrollHeight })
    Object.defineProperty(box, "clientHeight", { configurable: true, value: clientHeight })
    box.scrollTop = scrollTop
    fireEvent.scroll(box)
  }

  const readTracking = { ticketId: "t1", userId: "u1", latestMessageId: "m1" }
  const thread = [message("m1", { createdAt: at(15, 10, 17) })]

  beforeEach(() => {
    markRead.mockClear()
    visibility = "visible"
    focused = true
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility })
    vi.spyOn(document, "hasFocus").mockImplementation(() => focused)
  })

  it("marks the ticket read on open when the tab is visible, focused and at the bottom", () => {
    renderChat({ messages: thread, readTracking })
    expect(lastCall()).toEqual({ ticketId: "t1", messageId: "m1", enabled: true })
  })

  it("does not mark read while the tab is hidden, and does once it is visible again", () => {
    visibility = "hidden"
    renderChat({ messages: thread, readTracking })
    expect(lastCall().enabled).toBe(false)
    expect(markRead.mock.calls.some(([, , opts]) => opts?.enabled)).toBe(false)

    act(() => {
      visibility = "visible"
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(lastCall().enabled).toBe(true)
  })

  it("does not mark read while the window is blurred", () => {
    renderChat({ messages: thread, readTracking })
    act(() => {
      focused = false
      window.dispatchEvent(new Event("blur"))
    })
    expect(lastCall().enabled).toBe(false)
    act(() => {
      focused = true
      window.dispatchEvent(new Event("focus"))
    })
    expect(lastCall().enabled).toBe(true)
  })

  it("only marks read when scrolled to within 48px of the bottom", () => {
    const { container } = renderChat({ messages: thread, readTracking })
    const box = container.querySelector('[data-slot="chat-scroll"]') as HTMLElement

    act(() => scrollTo(box, { scrollHeight: 2000, clientHeight: 500, scrollTop: 1000 }))
    expect(lastCall().enabled).toBe(false)

    act(() => scrollTo(box, { scrollHeight: 2000, clientHeight: 500, scrollTop: 1460 }))
    expect(lastCall().enabled).toBe(true)
  })

  it("marks new realtime messages read while at the bottom, not while scrolled up", () => {
    const wrap = (props: Partial<TicketChatProps>) => (
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <TicketChat headerTitle="Ticket" message="" onMessageChange={() => {}} onSend={() => {}} messages={thread} {...props} />
        </TooltipProvider>
      </QueryClientProvider>
    )
    const { container, rerender } = render(wrap({ readTracking }))
    const box = container.querySelector('[data-slot="chat-scroll"]') as HTMLElement

    rerender(
      wrap({
        messages: [...thread, message("m2", { createdAt: at(15, 10, 18) })],
        readTracking: { ...readTracking, latestMessageId: "m2" },
      }),
    )
    expect(lastCall()).toEqual({ ticketId: "t1", messageId: "m2", enabled: true })

    act(() => scrollTo(box, { scrollHeight: 2000, clientHeight: 500, scrollTop: 200 }))
    markRead.mockClear()
    rerender(
      wrap({
        messages: [...thread, message("m2", { createdAt: at(15, 10, 18) }), message("m3", { createdAt: at(15, 10, 19) })],
        readTracking: { ...readTracking, latestMessageId: "m3" },
      }),
    )
    expect(lastCall().messageId).toBe("m3")
    expect(markRead.mock.calls.some(([, , opts]) => opts?.enabled)).toBe(false)
  })

  it("skips guests without a user id and chats without read tracking", () => {
    const guest = renderChat({ messages: thread, readTracking: { ...readTracking, userId: null } })
    expect(markRead.mock.calls.every(([, , opts]) => opts?.enabled === false)).toBe(true)
    guest.unmount()

    markRead.mockClear()
    renderChat({ messages: thread })
    expect(markRead.mock.calls.every(([, , opts]) => opts?.enabled === false)).toBe(true)
  })

  it("does not mark read while the details sheet covers the chat below lg", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as typeof window.matchMedia
    renderChat({ messages: thread, readTracking })
    expect(lastCall().enabled).toBe(true)
    fireEvent.click(within(screen.getByTestId("header-actions")).getByRole("button", { name: "Ticket details" }))
    expect(lastCall().enabled).toBe(false)
  })
})
