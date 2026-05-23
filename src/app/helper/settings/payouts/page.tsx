"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Landmark, Info } from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { useStartHelperPaymentConnect } from "@/hooks/usePaymentConnect"
import { useSetupPaymentMethod } from "@/hooks/useSetupPaymentMethod"
import { usePaymentStatus } from "@/hooks/usePaymentStatus"
import { connectStatusLabel } from "@/lib/payment-status"

export default function HelperPayoutsPage() {
  const { user } = useUser()
  const userId = user?.id ?? ""
  const startConnect = useStartHelperPaymentConnect()
  const status = usePaymentStatus({ scope: "user", scopeId: userId })
  const setupCard = useSetupPaymentMethod()
  const hasCardOnFile = !!status.data?.default_payment_method_id

  const handleSetupPayouts = async () => {
    try {
      const { url } = await startConnect.mutateAsync()
      window.location.assign(url)
    } catch (err) {
      console.error("Failed to start helper Connect onboarding:", err)
    }
  }

  const handleAddOrReplaceCard = async () => {
    if (!userId) return
    try {
      const { checkoutUrl } = await setupCard.mutateAsync({ scope: "user" })
      window.location.assign(checkoutUrl)
    } catch (err) {
      console.error("Failed to start card setup:", err)
    }
  }

  const label = status.data
    ? connectStatusLabel(status.data).label
    : "Not set up"

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Payouts" subtitle="Set up payouts to your Stripe account" />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-3xl space-y-6">
            <div className="bg-card rounded-lg border border-border p-6">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-base font-semibold text-foreground">Set up payouts</h2>
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Connect your Stripe account so we can send your payouts when you
                help on tickets. We use Stripe for all payouts.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Button
                  className="w-fit px-5 py-2.5 text-[13px] font-medium bg-[#635bff] text-white hover:bg-[#5851e5]"
                  onClick={handleSetupPayouts}
                  disabled={!userId || startConnect.isPending}
                >
                  <Landmark className="w-4 h-4" />
                  {startConnect.isPending ? "Starting..." : "Set up payouts"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  Status: <span className="font-medium text-foreground">{label}</span>
                </span>
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border p-6">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-base font-semibold text-foreground">Card on file</h2>
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Used to place authorization holds when you open a support ticket
                you pay for yourself. Stored securely with Stripe.
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
                  {hasCardOnFile
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
