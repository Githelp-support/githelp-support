"use client"

/**
 * Stripe fee: 2.9% + $0.30 per transaction (US). Charged on every card
 * transaction, not once per ticket — see the note rendered under the preview.
 */
const STRIPE_PERCENT = 0.029
const STRIPE_FIXED_CENTS = 30

/**
 * Preview card showing how money is split between participants for 1 hour of support.
 * Matches the Figma design: "1 hour of support - Distribution"
 *
 * The preview assumes the whole hour is collected in a single card
 * transaction. A ticket can be charged more than once (the hold capture,
 * a separate charge for time beyond the hold, one capture per week on
 * long-running tickets, a retry after a decline), and each transaction pays
 * Stripe's fee — including the fixed $0.30 — on its own. The backend deducts
 * the actual fee per charge before splitting that charge, so the helper and
 * project shares shrink by one extra fee for every additional transaction.
 */
export function DistributionPreview({
  helperPercentage,
  oneHourTotal,
}: {
  helperPercentage: number
  oneHourTotal: number
}) {
  const stripeFee = oneHourTotal * STRIPE_PERCENT + STRIPE_FIXED_CENTS / 100
  const amountToSplit = Math.max(0, oneHourTotal - stripeFee)
  const helperAmount = (amountToSplit * helperPercentage) / 100
  const projectAmount = amountToSplit - helperAmount
  const githelpAmount = 0

  /** Splits a currency value into its symbol and numeric parts so they can be spaced apart. */
  const formatCurrency = (value: number) => {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(value)
    const symbol = parts
      .filter((p) => p.type === "currency")
      .map((p) => p.value)
      .join("")
    const amount = parts
      .filter((p) => p.type !== "currency")
      .map((p) => p.value)
      .join("")
    return { symbol, amount }
  }

  const rows = [
    { label: "Helper", amount: helperAmount },
    { label: "Project", amount: projectAmount },
    { label: "Githelp", amount: githelpAmount },
    { label: "Stripe (per transaction)", amount: stripeFee },
  ]

  const sumMoney = formatCurrency(oneHourTotal)

  return (
    <div className="shrink-0 w-full sm:w-[280px] bg-muted/50 rounded-lg border border-border p-5">
      <h4 className="text-[14px] font-semibold text-foreground mb-4">
        1st hour of support - Distribution
      </h4>
      <div className="space-y-3">
        {rows.map(({ label, amount }) => {
          const money = formatCurrency(amount)
          return (
            <div
              key={label}
              className="grid grid-cols-3 items-center text-[14px]"
            >
              <span className="col-span-2 pl-[10px] text-muted-foreground">{label}</span>
              <span className="text-foreground font-medium tabular-nums">
                <span className="mr-[3px]">{money.symbol}</span>
                {money.amount}
              </span>
            </div>
          )
        })}
      </div>
      <div className="border-t border-border mt-3 pt-3 grid grid-cols-3 items-center">
        <span className="col-span-2 text-[14px] font-bold text-brand-primary">Sum</span>
        <span className="text-[14px] font-bold text-brand-primary tabular-nums">
          <span className="mr-[3px]">{sumMoney.symbol}</span>
          {sumMoney.amount}
        </span>
      </div>
      <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
        Stripe charges a fee (typically 2.9% + $0.30 for US cards) on every
        card transaction. This preview
        assumes one transaction; a ticket charged in several transactions
        (extra time beyond the hold, weekly captures on long tickets, a retry
        after a declined card) pays the Stripe fee on each of them, which is
        deducted from that charge before the helper and project split.
      </p>
    </div>
  )
}
