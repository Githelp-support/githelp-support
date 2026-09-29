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
    // The panel isn't rendered while collapsed, so nothing to point at yet.
    expect(button).not.toHaveAttribute("aria-controls")
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it("points at the panel once it is open", () => {
    render(<TransactionsToggle count={3} expanded onToggle={() => {}} panelId="panel-2" />)
    expect(screen.getByRole("button", { name: "3 transactions" })).toHaveAttribute("aria-controls", "panel-2")
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

  it("keeps its own indented layout by default", () => {
    render(
      <TransactionsPanel id="p">
        <TransactionLine index={0} count={2} date="11/08/2026" description="Charge" amount="USD 42.00" status="Paid" />
      </TransactionsPanel>,
    )
    const panel = screen.getByRole("list")
    expect(panel).toHaveClass("ml-8", "border", "border-border")
    expect(panel).not.toHaveClass("-mx-4")
    expect(panel).toHaveAttribute("data-align", "default")

    const line = screen.getByRole("listitem")
    expect(line).toHaveClass("min-w-[36rem]", "px-4", "gap-4")
    expect(line).toHaveStyle({
      gridTemplateColumns: "3.5rem 6rem minmax(0, 1fr) 8rem 9rem minmax(0, auto)",
    })
    expect(line.children).toHaveLength(6)
    expect(line.children[0]).toHaveTextContent("1 of 2")
    expect(line.children[1]).toHaveTextContent("11/08/2026")
  })

  it("merges a className into the panel", () => {
    render(
      <TransactionsPanel id="p" className="mt-0">
        <TransactionLine index={0} count={2} date="11/08/2026" description="Charge" amount="USD 42.00" status="Paid" />
      </TransactionsPanel>,
    )
    expect(screen.getByRole("list")).toHaveClass("mt-0", "ml-8")
  })
})

describe("table-aligned transactions", () => {
  const TABLE_COLUMNS = "2rem 12rem 8rem 10rem minmax(0, 1fr) 8rem 5rem"

  function renderAligned() {
    render(
      <TransactionsPanel id="p" align="table">
        <TransactionLine
          align="table"
          columns={TABLE_COLUMNS}
          index={1}
          count={2}
          date="19/08/2026"
          description="REF-123"
          amount="12.00"
          status="Paid"
          actions={<a href="/statement">Statement</a>}
        />
      </TransactionsPanel>,
    )
  }

  it("drops the panel's indent and border so the tracks match the table row", () => {
    renderAligned()
    const panel = screen.getByRole("list")
    expect(panel).toHaveAttribute("data-align", "table")
    expect(panel).toHaveClass("-mx-4", "ring-1")
    expect(panel).not.toHaveClass("ml-8")
    expect(panel).not.toHaveClass("border")
  })

  it("uses the table's grid template, with no minimum width of its own", () => {
    renderAligned()
    const line = screen.getByRole("listitem")
    expect(line).toHaveStyle({ gridTemplateColumns: TABLE_COLUMNS })
    expect(line).toHaveClass("px-4", "gap-4")
    expect(line).not.toHaveClass("min-w-[36rem]")
  })

  it("puts each value in the table's column", () => {
    renderAligned()
    const cells = Array.from(screen.getByRole("listitem").children)
    expect(cells).toHaveLength(7)
    // checkbox | ticket id | date | helper | earnings | status | kebab
    expect(cells[0]).toBeEmptyDOMElement()
    expect(cells[0]).toHaveAttribute("aria-hidden", "true")
    expect(cells[1]).toHaveTextContent("2 of 2")
    expect(cells[2]).toHaveTextContent("19/08/2026")
    expect(cells[3]).toHaveTextContent("REF-123")
    expect(cells[4]).toHaveTextContent("12.00")
    expect(cells[5]).toHaveTextContent("Paid")
    expect(cells[6]).toHaveTextContent("Statement")
    expect(cells[6]).toHaveClass("justify-end")
  })

  it("accepts a columns override without the table layout", () => {
    render(
      <TransactionsPanel id="p">
        <TransactionLine
          columns="1fr 1fr 1fr 1fr 1fr 1fr"
          index={0}
          count={2}
          date="11/08/2026"
          description="Charge"
          amount="USD 42.00"
          status="Paid"
        />
      </TransactionsPanel>,
    )
    const line = screen.getByRole("listitem")
    expect(line).toHaveStyle({ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr" })
    expect(line.children).toHaveLength(6)
    expect(line).toHaveClass("min-w-[36rem]")
  })
})
