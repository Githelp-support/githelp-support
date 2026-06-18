"use client"

import { Info, Landmark, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { useHelper } from "@/hooks/useHelpers"
import { getAvatarColorHexForId } from "@/lib/constants"
import { useProjectSelection } from "@/contexts/project-context"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useUser } from "@/contexts/user-context"
import { useStartHelperPaymentConnect } from "@/hooks/usePaymentConnect"
import { usePaymentStatus } from "@/hooks/usePaymentStatus"
import { connectStatusLabel } from "@/lib/payment-status"

export default function HelperPayoutPage() {
  const { user } = useUser()
  const userId = user?.id ?? ""
  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  const { data: helperId, isLoading: currentHelperLoading } = useCurrentHelper(projectId)
  const { data: helperData, isLoading: helperLoading } = useHelper(helperId ?? "")

  // Stripe Connect onboarding is user-scoped (not tied to a single project).
  const startConnect = useStartHelperPaymentConnect()
  const status = usePaymentStatus({ scope: "user", scopeId: userId })
  const statusLabel = status.data ? connectStatusLabel(status.data).label : "Not set up"

  const handleSetupPayout = async () => {
    try {
      const { url } = await startConnect.mutateAsync()
      window.location.assign(url)
    } catch (err) {
      console.error("Failed to start helper Connect onboarding:", err)
    }
  }

  const isLoading = currentHelperLoading || (!!projectId && !!helperId && helperLoading)

  if (!projectId) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Payout" subtitle="Set up payout details for support" />
          <main className="flex-1 overflow-auto p-6">
            <p className="text-muted-foreground">Select a project to view and edit your payout details.</p>
          </main>
        </div>
      </div>
    )
  }

  if (!currentHelperLoading && projectId && helperId === null) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Payout" subtitle="Set up payout details for support" />
          <main className="flex-1 overflow-auto p-6">
            <p className="text-sm text-left pl-2 text-muted-foreground">You are not registered as a helper in this project.</p>
          </main>
        </div>
      </div>
    )
  }

  if (isLoading || !helperData) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Payout" subtitle="Set up payout details for support" />
          <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </main>
        </div>
      </div>
    )
  }

  const displayName = helperData.user?.name || "Unknown"
  const displayAvatar = (displayName || "U")[0].toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Payout" subtitle="Set up payout details for support" />

        <main className="flex-1 overflow-auto py-6 px-8">
          <div className="bg-card rounded-lg py-6 pr-6">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Payout details</h2>
              <Info className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="mt-8 flex flex-col gap-10">
              {/* Stripe → helper avatar connection */}
              <div className="flex items-center gap-1">
                <div className="flex size-[42px] shrink-0 items-center justify-center bg-[#635bff] rounded-[14px]">
                  <img
                    src="/images/stripe-svg.svg"
                    alt="Stripe"
                    className="size-[22px] object-contain"
                  />
                </div>
                <div className="flex items-center gap-1.5 px-0.5">
                  <span className="size-1 rounded-full bg-muted-foreground/40" />
                  <span className="size-1 rounded-full bg-muted-foreground/40" />
                  <span className="size-1 rounded-full bg-muted-foreground/40" />
                </div>
                <div
                  className="flex size-[42px] shrink-0 items-center justify-center rounded-[14px] text-foreground font-medium"
                  style={{ backgroundColor: getAvatarColorHexForId(helperData.user_id ?? helperData.helper_id) }}
                >
                  {displayAvatar}
                </div>
              </div>

              <p className="max-w-[502px] text-sm leading-normal tracking-tight text-text-muted">
                Go to Stripe to set up your payout details. This is the account where you will receive all funds from any support activities.
              </p>

              <div className="flex items-center gap-3">
                <Button
                  className="w-fit px-5 py-2.5 text-[13px] font-medium bg-[#635bff] text-white hover:bg-[#5851e5]"
                  onClick={handleSetupPayout}
                  disabled={!userId || startConnect.isPending}
                >
                  <Landmark className="w-4 h-4" />
                  {startConnect.isPending ? "Starting..." : "Set up payout with Stripe"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  Status: <span className="font-medium text-foreground">{statusLabel}</span>
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
