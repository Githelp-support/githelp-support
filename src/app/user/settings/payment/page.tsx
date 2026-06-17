"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Info } from "lucide-react"
import { toast } from "sonner"
import { useUser } from "@/contexts/user-context"
import { useProjectSelection } from "@/contexts/project-context"
import { useSetupPaymentMethod } from "@/hooks/useSetupPaymentMethod"
import { usePaymentStatus } from "@/hooks/usePaymentStatus"

const RETURN_PATH = "/user/settings/payment"

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
  const status = usePaymentStatus({ scope: "user", scopeId: userId })
  const hasCardOnFile = !!status.data?.default_payment_method_id

  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Surface the result of returning from Stripe Checkout, then drop the query
  // params and refresh the card status (the setup_intent.succeeded webhook
  // persists the new card; refetch so it shows without a hard reload).
  const cardParam = searchParams.get("card")
  useEffect(() => {
    if (!cardParam) return
    if (cardParam === "added") {
      toast.success("Card saved")
      queryClient.invalidateQueries({ queryKey: ["payment-status", "user", userId] })
    } else if (cardParam === "cancelled") {
      toast.info("Card setup cancelled")
    }
    router.replace(RETURN_PATH)
  }, [cardParam, queryClient, router, userId])

  const handleAddOrReplaceCard = async () => {
    if (!userId) return
    try {
      const { checkoutUrl } = await setupCard.mutateAsync({
        scope: "user",
        projectId: selectedProjectId ?? undefined,
        returnPath: RETURN_PATH,
      })
      window.location.assign(checkoutUrl)
    } catch (err) {
      console.error("Failed to start card setup:", err)
      toast.error("Couldn't start card setup. Please try again.")
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden [&>header]:pl-14">
        <Header title="Payment" subtitle="Manage how you pay for support" />
        <main className="flex-1 px-8 py-6 overflow-y-auto">
          <div className="max-w-3xl space-y-6">
            <div className="bg-card rounded-lg border border-border p-6">
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
                  disabled={!userId || setupCard.isPending}
                >
                  {setupCard.isPending
                    ? "Starting..."
                    : hasCardOnFile ? "Replace card" : "Add card"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {status.isLoading
                    ? "Checking…"
                    : hasCardOnFile
                      ? <span className="font-medium text-foreground">Card on file</span>
                      : "No card yet"}
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
