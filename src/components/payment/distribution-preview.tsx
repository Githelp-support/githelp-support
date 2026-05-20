"use client"

/** Stripe fee: 2.9% + $0.30 per transaction (US) */
const STRIPE_PERCENT = 0.029
const STRIPE_FIXED_CENTS = 30

/**
 * Preview card showing how money is split between participants for 1 hour of support.
 * Matches the Figma design: "1 hour of support - Distribution"
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
    { label: "Stripe", amount: stripeFee },
  ]

  const sumMoney = formatCurrency(oneHourTotal)

  return (
    <div className="shrink-0 w-full sm:w-[280px] bg-muted/50 rounded-lg border border-border p-5">
      <h4 className="text-[13px] font-semibold text-foreground mb-4">
        1st hour of support - Distribution
      </h4>
      <div className="space-y-3">
        {rows.map(({ label, amount }) => {
          const money = formatCurrency(amount)
          return (
            <div
              key={label}
              className="grid grid-cols-3 items-center text-[13px]"
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
        <span className="col-span-2 text-[13px] font-bold text-brand-primary">Sum</span>
        <span className="text-[13px] font-bold text-brand-primary tabular-nums">
          <span className="mr-[3px]">{sumMoney.symbol}</span>
          {sumMoney.amount}
        </span>
      </div>
    </div>
  )
}
