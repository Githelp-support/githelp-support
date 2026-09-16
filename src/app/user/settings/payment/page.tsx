"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Info, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { useUser } from "@/contexts/user-context"
import { useProjectSelection } from "@/contexts/project-context"
import { useSetupPaymentMethod, useSyncPaymentMethod } from "@/hooks/useSetupPaymentMethod"
import { usePaymentStatus, type PaymentStatusData } from "@/hooks/usePaymentStatus"

const RETURN_PATH = "/user/settings/payment"

// If persisting the card from the Checkout session fails on return, poll the
// card status this often, for this long, while the setup_intent.succeeded
// webhook catches up. After that we give up and ask the user to refresh.
const CARD_POLL_INTERVAL_MS = 2_000
const CARD_POLL_TIMEOUT_MS = 30_000

// sessionStorage: the card id on file when we sent the user to Stripe, so
// polling after "Replace card" can tell the old row from the saved one.
const CARD_BEFORE_SETUP_KEY = "payment:card-before-setup"

const rememberCardBeforeSetup = (cardId: string | null) => {
  try {
    sessionStorage.setItem(CARD_BEFORE_SETUP_KEY, cardId ?? "")
  } catch {
    // Storage unavailable (private mode, blocked). Polling then treats any
    // card on file as the new one, which is only wrong for "Replace card".
  }
}

const takeCardBeforeSetup = (): string | null => {
  try {
    const value = sessionStorage.getItem(CARD_BEFORE_SETUP_KEY)
    sessionStorage.removeItem(CARD_BEFORE_SETUP_KEY)
    return value || null
  } catch {
    return null
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Stripe card `brand` values → display names. Falls back to a Title-cased
// version of whatever Stripe sends so a new/unknown brand still reads sensibly.
const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
}

const formatCardBrand = (brand: string | null): string => {
  if (!brand || brand === "unknown") return "Card"
  return CARD_BRAND_LABELS[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1)
}

/**
 * Individual user's payment settings: manage the card used to pay for support
 * tickets. Scoped to the authenticated user (`scope: "user"`). The same
 * infrastructure backs organization-billed payments (`scope: "organization"`),
 * but that surface lives in the admin settings; here we focus on the user
 * paying for their own support.
 */
export default function UserPaymentSettingsPage() {
  const { user } = useUser()
  const userId = user?.id ?? ""
  // The selected project decides the Stripe mode (sandbox → test, else live)
  // so the card is created in the same environment the user gets support in.
  const { selectedProjectId } = useProjectSelection()
  const setupCard = useSetupPaymentMethod()
  const { mutateAsync: syncCardAsync } = useSyncPaymentMethod()
  const status = usePaymentStatus({ scope: "user", scopeId: userId, projectId: selectedProjectId ?? undefined })
  const currentCardId = status.data?.default_payment_method_id ?? null
  const hasCardOnFile = !!currentCardId
  const cardLast4 = status.data?.card_last4 ?? null
  const cardBrandLabel = formatCardBrand(status.data?.card_brand ?? null)

  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Captured once at mount. Card setup navigates the whole window to Stripe
  // and back, so a mount with these set is exactly "just returned from
  // Checkout"; the params are stripped from the URL right after.
  const [checkoutReturn] = useState(() => ({
    outcome: searchParams.get("card"),
    sessionId: searchParams.get("session_id"),
  }))
  const handledReturn = useRef(false)
  const mounted = useRef(true)
  // True from the moment we land back with card=added until the new card is
  // on screen (or we gave up). Drives the "Confirming…" label so the stale
  // "No card yet" never flashes while the sync is in flight.
  const [confirmingCard, setConfirmingCard] = useState(checkoutReturn.outcome === "added")

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Handle the return from Stripe Checkout. The card itself is written by
  // the setup_intent.succeeded webhook, which is asynchronous and can land
  // after we are already back here — so first persist it ourselves from the
  // session id (payments-sync-setup-method), and only if that fails poll the
  // card status until the webhook has caught up.
  useEffect(() => {
    if (!checkoutReturn.outcome || !userId || handledReturn.current) return
    handledReturn.current = true
    router.replace(RETURN_PATH)

    if (checkoutReturn.outcome === "cancelled") {
      toast.info("Card setup cancelled")
      return
    }
    if (checkoutReturn.outcome !== "added") return

    const previousCardId = takeCardBeforeSetup()
    const projectId = selectedProjectId ?? undefined

    const confirmCard = async () => {
      if (checkoutReturn.sessionId) {
        try {
          const result = await syncCardAsync({ scope: "user", projectId, sessionId: checkoutReturn.sessionId })
          if (result.synced) {
            if (mounted.current) {
              setConfirmingCard(false)
              toast.success("Card saved")
            }
            return
          }
          console.warn("Card not synced yet; SetupIntent status:", result.setupIntentStatus)
        } catch (err) {
          console.error("Failed to sync new card from Stripe:", err)
        }
      }

      // Fallback: wait for the webhook. Refetch on an interval and stop as
      // soon as the row shows a card that is not the one we started with.
      if (!mounted.current) return
      toast.info("Card saved with Stripe. Confirming…")
      const queryKey = ["payment-status", "user", userId]
      const deadline = Date.now() + CARD_POLL_TIMEOUT_MS
      try {
        while (mounted.current && Date.now() < deadline) {
          await sleep(CARD_POLL_INTERVAL_MS)
          if (!mounted.current) return
          await queryClient.invalidateQueries({ queryKey })
          const cardId = queryClient
            .getQueriesData<PaymentStatusData | null>({ queryKey })
            .map(([, data]) => data?.default_payment_method_id ?? null)
            .find((id) => id !== null) ?? null
          if (cardId && cardId !== previousCardId) {
            if (mounted.current) toast.success("Card saved")
            return
          }
        }
        if (mounted.current) {
          toast.error("We couldn't confirm your new card yet. Please refresh in a moment.")
        }
      } finally {
        if (mounted.current) setConfirmingCard(false)
      }
    }
    void confirmCard()
  }, [checkoutReturn, userId, router, syncCardAsync, selectedProjectId, queryClient])

  const handleAddOrReplaceCard = async () => {
    if (!userId) return
    try {
      const { checkoutUrl } = await setupCard.mutateAsync({
        scope: "user",
        projectId: selectedProjectId ?? undefined,
        returnPath: RETURN_PATH,
      })
      rememberCardBeforeSetup(currentCardId)
      window.location.assign(checkoutUrl)
    } catch (err) {
      console.error("Failed to start card setup:", err)
      toast.error("Couldn't start card setup. Please try again.")
    }
  }

  const syncingCard = confirmingCard

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden [&>header]:pl-14">
        <Header title="Payment" subtitle="Manage how you pay for support" />
        <main className="flex-1 px-8 py-6 overflow-y-auto">
          <div className="max-w-3xl space-y-6">
            <div className="bg-card rounded-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-base font-semibold text-foreground">Card and payment</h2>
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Add a card to pay for support tickets. When you open a ticket, we
                place a temporary authorization hold and only charge you for the
                time spent helping you. Your card is stored securely with Stripe.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Button
                  className="w-fit px-5 py-2.5 text-[13px] font-medium bg-[#635bff] text-white hover:bg-[#5851e5]"
                  onClick={handleAddOrReplaceCard}
                  disabled={!userId || setupCard.isPending || syncingCard}
                >
                  {setupCard.isPending
                    ? "Starting..."
                    : hasCardOnFile ? "Replace card" : "Add card"}
                </Button>
                {status.isLoading || syncingCard ? (
                  <span className="text-sm text-muted-foreground">
                    {syncingCard ? "Confirming your card…" : "Checking…"}
                  </span>
                ) : hasCardOnFile ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {cardBrandLabel}
                      {cardLast4 ? (
                        <span className="text-muted-foreground font-normal">
                          {" "}•••• {cardLast4}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">No card yet</span>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
