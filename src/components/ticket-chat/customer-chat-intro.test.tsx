import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// ChatMessageMeta lives beside MarkdownContent → ChatImage → useTicketAttachments, which pulls in the client (throws without env vars).
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))

import { CustomerChatIntro } from "./customer-chat-intro"

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
