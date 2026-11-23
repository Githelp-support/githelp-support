import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"

// ChatMessageMeta lives beside MarkdownContent → ChatImage → useTicketAttachments, which pulls in the client (throws without env vars).
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
// TicketChat's Header needs the router and contexts; the reveal tests only need the thread.
vi.mock("@/components/layout/header", () => ({ Header: () => null }))

import { CustomerChatIntro } from "./customer-chat-intro"
import { TicketChat, type TicketChatMessage } from "./ticket-chat"
import { WELCOME_REVEAL_DELAY_MS, markWelcomeReveal } from "@/lib/welcome-reveal"

const baseProps = {
  projectId: "p1",
  projectName: "Acme",
  projectLogo: null,
  welcomeText: "Welcome!",
  timestamp: "12:00",
  rates: { startPrice: "10.00", first60Price: "1.50", after60Price: "1.00" },
  isAuthenticated: true,
  ticketCreated: false,
  userName: "Alice",
  onSignIn: vi.fn(),
}

describe("CustomerChatIntro header row", () => {
  it("shows the team name, the Project badge and a time-only stamp on a 30px avatar", () => {
    const { container } = render(<CustomerChatIntro {...baseProps} />)
    expect(screen.getByText("Acme Team")).toBeInTheDocument()
    expect(screen.getByText("Project")).toBeInTheDocument()
    expect(screen.getByText("12:00")).toBeInTheDocument()
    expect(container.querySelector(".size-7\\.5")).toHaveTextContent("A")
    // The welcome line reads as message text, not as secondary text.
    expect(screen.getByText("Welcome!")).toHaveClass("text-foreground")
    expect(screen.getByText("Welcome!")).not.toHaveClass("text-muted-foreground")
  })
})

describe("CustomerChatIntro rates", () => {
  it("lists the three rates for a paid project", () => {
    render(<CustomerChatIntro {...baseProps} />)
    expect(screen.getByText("10.00")).toBeInTheDocument()
    expect(screen.getByText("Start price (USD)")).toBeInTheDocument()
    expect(screen.getByText("1.50")).toBeInTheDocument()
    expect(screen.getByText("First 60 min (USD/min)")).toBeInTheDocument()
    expect(screen.getByText("1.00")).toBeInTheDocument()
    expect(screen.getByText("After 60 min (USD/min)")).toBeInTheDocument()
    expect(screen.queryByText("Free support")).not.toBeInTheDocument()
  })

  it("says support is free instead of listing $0 rates", () => {
    render(
      <CustomerChatIntro
        {...baseProps}
        rates={{ startPrice: "0.00", first60Price: "0.00", after60Price: "0.00" }}
        isFree
      />,
    )
    expect(screen.getByText("Free support")).toBeInTheDocument()
    expect(screen.getByText(/Acme offers support for free/)).toBeInTheDocument()
    expect(screen.queryByText("0.00")).not.toBeInTheDocument()
    expect(screen.queryByText("Start price (USD)")).not.toBeInTheDocument()
    // The rest of the intro is unaffected.
    expect(screen.getByText("Welcome!")).toBeInTheDocument()
    expect(screen.getByText(/signed in as Alice/)).toBeInTheDocument()
  })
})

describe("CustomerChatIntro entrance in a new ticket's chat", () => {
  const createdAt = new Date(2026, 10, 15, 10, 16).toISOString()
  const thread: TicketChatMessage[] = [
    {
      id: "w",
      senderType: "system",
      senderName: "Acme Team",
      senderId: null,
      timestamp: "10:16",
      createdAt,
      content: "Welcome to Acme's support chat.",
      kind: "welcome",
    },
  ]

  const renderInChat = (welcomeRevealId?: string) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <TicketChat
            headerTitle="Ticket with Acme"
            intro={<CustomerChatIntro {...baseProps} ticketCreated />}
            messages={thread}
            message=""
            onMessageChange={() => {}}
            onSend={() => {}}
            welcomeRevealId={welcomeRevealId}
          />
        </TooltipProvider>
      </QueryClientProvider>,
    )

  const setReducedMotion = (reduce: boolean) => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia
  }

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    window.sessionStorage.clear()
    setReducedMotion(false)
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it("appears after the delay, animated, when the ticket was just created", () => {
    markWelcomeReveal("t1")
    renderInChat("t1")
    expect(screen.queryByText("Welcome!")).toBeNull()
    expect(screen.queryByText("Start price (USD)")).toBeNull()

    act(() => vi.advanceTimersByTime(WELCOME_REVEAL_DELAY_MS - 1))
    expect(screen.queryByText("Welcome!")).toBeNull()

    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByText("Welcome!").closest(".animate-enter")).not.toBeNull()
    expect(screen.getByText("Start price (USD)")).toBeInTheDocument()
  })

  it("appears at once without the flag (reload, later visit)", () => {
    renderInChat("t1")
    expect(screen.getByText("Welcome!").closest(".animate-enter")).toBeNull()
    expect(screen.getByText("Start price (USD)")).toBeInTheDocument()
  })

  it("appears at once under reduced motion, even when flagged", () => {
    setReducedMotion(true)
    markWelcomeReveal("t1")
    renderInChat("t1")
    expect(screen.getByText("Welcome!").closest(".animate-enter")).toBeNull()
    act(() => vi.advanceTimersByTime(WELCOME_REVEAL_DELAY_MS))
    expect(screen.getByText("Welcome!").closest(".animate-enter")).toBeNull()
  })
})
