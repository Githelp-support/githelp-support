"use client"

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

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
    <Card className="shrink-0 w-full sm:w-[280px] py-0 gap-0 shadow-none bg-muted/40">
      <CardHeader className="px-4 pt-4 pb-3">
        <CardTitle className="text-sm">
          1 hour of support &mdash; Distribution
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-0">
        <div className="space-y-2.5">
          {rows.map(({ label, amount }) => (
            <div
              key={label}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{label}</span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  amount === 0
                    ? "text-muted-foreground/60"
                    : "text-foreground"
                )}
              >
                {formatCurrency(amount)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="border-t px-4 pt-3 pb-4 mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-brand-primary">Total</span>
        <span className="text-sm font-semibold text-brand-primary tabular-nums">
          {formatCurrency(oneHourTotal)}
        </span>
      </CardFooter>
    </Card>
  )
}
