import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

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

describe("CustomerChatIntro header line", () => {
  it("shows the team name in 14px semibold, the time only, and the welcome text in the foreground colour", () => {
    render(<CustomerChatIntro {...baseProps} timestamp="15.11.2026, 10:16" />)
    expect(screen.getByText("Acme Team")).toHaveClass("text-sm", "font-semibold")
    expect(screen.getByText("10:16")).toBeInTheDocument()
    expect(screen.queryByText(/15\.11\.2026/)).not.toBeInTheDocument()
    expect(screen.getByText("Welcome!")).toHaveClass("text-foreground")
    expect(screen.getByText("Welcome!")).not.toHaveClass("text-muted-foreground")
  })

  it("renders the project avatar at 30px, as a tile or as the logo", () => {
    const { unmount } = render(<CustomerChatIntro {...baseProps} />)
    expect(screen.getByText("A")).toHaveClass("size-7.5")
    unmount()
    render(<CustomerChatIntro {...baseProps} projectLogo="https://example.com/logo.png" />)
    expect(screen.getByAltText("Acme logo")).toHaveClass("size-7.5")
  })
})
