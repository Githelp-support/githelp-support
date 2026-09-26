import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TransactionLine, TransactionsPanel, TransactionsToggle, transactionsPanelId } from "./ticket-transactions"

describe("TransactionsToggle", () => {
  it("renders nothing for a ticket with a single transaction", () => {
    const { container } = render(<TransactionsToggle count={1} expanded={false} onToggle={() => {}} panelId="p" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("says how many transactions the ticket has and toggles them", () => {
    const onToggle = vi.fn()
    render(<TransactionsToggle count={2} expanded={false} onToggle={onToggle} panelId="panel-1" noun="payout" />)
    const button = screen.getByRole("button", { name: "2 payouts" })
    expect(button).toHaveAttribute("aria-expanded", "false")
    expect(button).toHaveAttribute("aria-controls", "panel-1")
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledOnce()
  })
})

describe("TransactionsPanel", () => {
  it("lists each transaction with its position", () => {
    render(
      <TransactionsPanel id={transactionsPanelId("ticket:abc")}>
        <TransactionLine index={0} count={2} date="11/08/2026" description="Charge" amount="USD 42.00" status="Paid" />
        <TransactionLine index={1} count={2} date="19/08/2026" description="Charge" amount="USD 12.00" status="Paid" />
      </TransactionsPanel>,
    )
    expect(screen.getByRole("list")).toHaveAttribute("id", "transactions-ticket-abc")
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(2)
    expect(items[1]).toHaveTextContent("2 of 2")
    expect(items[1]).toHaveTextContent("USD 12.00")
  })
})
