"use client"

import { useEffect, useRef, useState } from "react"
import { Info } from "lucide-react"

import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * Stripe fee: 2.9% + $0.30 per transaction (US). Charged on every card
 * transaction, not once per ticket — see the info popover on the Stripe row.
 */
const STRIPE_PERCENT = 0.029
const STRIPE_FIXED_CENTS = 30

/** Delay before a hover-opened popover closes, so the pointer can reach it. */
const HOVER_CLOSE_DELAY_MS = 150

/**
 * Info button + popover explaining the Stripe fee. Opens on hover and on
 * click; a click pins it open until Esc or a click outside.
 */
function StripeFeeInfo() {
  const [open, setOpen] = useState(false)
  const pinnedRef = useRef(false)
  const closedByHoverRef = useRef(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  useEffect(() => cancelClose, [])

  const scheduleClose = () => {
    cancelClose()
    if (pinnedRef.current) return
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      if (pinnedRef.current) return
      closedByHoverRef.current = true
      setOpen(false)
    }, HOVER_CLOSE_DELAY_MS)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Esc / click outside (the trigger click is handled below).
        cancelClose()
        if (!next) pinnedRef.current = false
        closedByHoverRef.current = false
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="About the Stripe fee"
          className="mt-[3px] inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
          onMouseEnter={() => {
            cancelClose()
            closedByHoverRef.current = false
            setOpen(true)
          }}
          onMouseLeave={scheduleClose}
          onClick={(event) => {
            // Take over Radix's toggle: hover has usually opened the popover
            // already, so a plain toggle would close it on the first click.
            event.preventDefault()
            cancelClose()
            closedByHoverRef.current = false
            if (open && pinnedRef.current) {
              pinnedRef.current = false
              setOpen(false)
            } else {
              pinnedRef.current = true
              setOpen(true)
            }
          }}
        >
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={6}
        // Same dark style as the Radix tooltips elsewhere in the app
        // (see InfoTooltip in settings/payment/page.tsx).
        className="z-[60] w-auto max-w-xs rounded-md border-0 bg-foreground px-3 py-2 font-sans text-xs leading-relaxed text-white shadow-md"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        onOpenAutoFocus={(event) => {
          // Don't pull focus into the popover when it was only hovered open.
          if (!pinnedRef.current) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          // Don't move focus to the trigger when the pointer merely left.
          if (closedByHoverRef.current) event.preventDefault()
          closedByHoverRef.current = false
        }}
      >
        <h5 className="mb-1 text-[14px] font-semibold">
          About the Stripe fee
        </h5>
        <p>
          Stripe charges about 2,9% + $0.30 per card transaction (US cards).
        </p>
        <p className="mt-2">
          This preview assumes one transaction. Tickets charged several times
          - extra time beyond the hold, weekly captures, a retry after a
          declined card - pay the fee on each charge, before the
          helper/project split.
        </p>
        <PopoverArrow className="fill-foreground" />
      </PopoverContent>
    </Popover>
  )
}

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

  const rows: { label: string; amount: number; info?: boolean }[] = [
    { label: "Helper", amount: helperAmount },
    { label: "Project", amount: projectAmount },
    { label: "Githelp", amount: githelpAmount },
    { label: "Stripe (per transaction)", amount: stripeFee, info: true },
  ]

  const sumMoney = formatCurrency(oneHourTotal)

  return (
    <div className="shrink-0 w-full sm:w-[280px] bg-muted/50 rounded-lg border border-border p-5">
      <h4 className="text-[14px] font-semibold text-foreground mb-4">
        1st hour of support - Distribution
      </h4>
      <div className="space-y-3">
        {rows.map(({ label, amount, info }) => {
          const money = formatCurrency(amount)
          return (
            <div
              key={label}
              className="grid grid-cols-3 items-center text-[14px]"
            >
              {info ? (
                <span className="col-span-2 pl-[10px] text-muted-foreground inline-flex items-start gap-1.5">
                  <StripeFeeInfo />
                  {label}
                </span>
              ) : (
                <span className="col-span-2 pl-[10px] text-muted-foreground">{label}</span>
              )}
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
        Assumes one transaction.
      </p>
    </div>
  )
}
