import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

// ChatMessageMeta lives beside MarkdownContent → ChatImage → useTicketAttachments, which pulls in the client (throws without env vars).
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))

import { CustomerChatIntro } from "./customer-chat-intro"
import { WelcomeMessage } from "./welcome-message"

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

describe("CustomerChatIntro sign-in state", () => {
  it("offers sign-in with the extra action while signed out, inside the welcome's column", () => {
    const onSignIn = vi.fn()
    const { container } = render(
      <CustomerChatIntro
        {...baseProps}
        isAuthenticated={false}
        onSignIn={onSignIn}
        signedOutExtra={<span>Continue without signing in</span>}
      >
        <p>2 free hours left on your SLA</p>
      </CustomerChatIntro>,
    )
    const column = container.querySelector('[data-slot="chat-welcome"] > .space-y-4') as HTMLElement
    fireEvent.click(within(column).getByRole("button", { name: "Sign in" }))
    expect(onSignIn).toHaveBeenCalled()
    expect(within(column).getByText("Continue without signing in")).toBeInTheDocument()
    expect(screen.queryByText(/signed in as/)).not.toBeInTheDocument()
    // SLA children sit between the welcome line and the rates.
    const sla = screen.getByText("2 free hours left on your SLA")
    expect(screen.getByText("Welcome!").compareDocumentPosition(sla) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(sla.compareDocumentPosition(screen.getByText("Rates")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("shows neither sign-in block once a ticket exists", () => {
    render(<CustomerChatIntro {...baseProps} ticketCreated />)
    expect(screen.queryByText(/signed in as/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument()
  })
})

describe("WelcomeMessage", () => {
  const welcomeProps = {
    projectId: "p1",
    projectName: "Acme",
    projectLogo: null,
    welcomeText: "Welcome!",
    timestamp: "09:41",
    rates: { startPrice: "25.00", first60Price: "1.50", after60Price: "1.00" },
  }

  it("renders the team name, badge, time, welcome line and rates without any sign-in state", () => {
    render(<WelcomeMessage {...welcomeProps} />)
    expect(screen.getByText("Acme Team")).toBeInTheDocument()
    expect(screen.getByText("Project")).toBeInTheDocument()
    expect(screen.getByText("09:41")).toBeInTheDocument()
    expect(screen.getByText("Welcome!")).toBeInTheDocument()
    expect(screen.getByText("25.00")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("uses the project logo when there is one", () => {
    render(<WelcomeMessage {...welcomeProps} projectLogo="https://example.com/logo.png" />)
    expect(screen.getByAltText("Acme logo")).toHaveAttribute("src", "https://example.com/logo.png")
  })

  it("says support is free, with the default sentence or the one passed in", () => {
    const { unmount } = render(<WelcomeMessage {...welcomeProps} rates={null} isFree />)
    expect(screen.getByText("Acme offers support for free - no payment method needed.")).toBeInTheDocument()
    unmount()
    render(<WelcomeMessage {...welcomeProps} rates={null} isFree freeText="Acme Inc offers support for free." />)
    expect(screen.getByText("Acme Inc offers support for free.")).toBeInTheDocument()
    expect(screen.queryByText(/no payment method needed/)).not.toBeInTheDocument()
  })

  it("shows 'Rates not configured' without rates, or no Rates section when told to hide it", () => {
    const { unmount } = render(<WelcomeMessage {...welcomeProps} rates={null} />)
    expect(screen.getByText("Rates not configured")).toBeInTheDocument()
    unmount()
    render(<WelcomeMessage {...welcomeProps} rates={null} missingRates="hidden" />)
    expect(screen.queryByText("Rates")).not.toBeInTheDocument()
    expect(screen.queryByText("Rates not configured")).not.toBeInTheDocument()
    expect(screen.getByText("Welcome!")).toBeInTheDocument()
  })
})
