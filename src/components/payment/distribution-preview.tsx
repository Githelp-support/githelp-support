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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)

  const rows = [
    { label: "Helper", amount: helperAmount },
    { label: "Project", amount: projectAmount },
    { label: "Githelp", amount: githelpAmount },
    { label: "Stripe", amount: stripeFee },
  ]

  return (
    <div className="shrink-0 w-full sm:w-[280px] bg-muted/50 rounded-lg border border-border p-5">
      <h4 className="text-sm font-semibold text-foreground mb-4">
        1st hour of support - Distribution
      </h4>
      <div className="space-y-3">
        {rows.map(({ label, amount }) => (
          <div
            key={label}
            className="grid grid-cols-3 items-center text-sm"
          >
            <span className="col-span-2 pl-[10px] text-muted-foreground">{label}</span>
            <span className="text-foreground font-medium tabular-nums">
              {formatCurrency(amount)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-border mt-3 pt-3 grid grid-cols-3 items-center">
        <span className="col-span-2 text-sm font-bold text-brand-primary">Sum</span>
        <span className="text-sm font-bold text-brand-primary tabular-nums">
          {formatCurrency(oneHourTotal)}
        </span>
      </div>
    </div>
  )
}
