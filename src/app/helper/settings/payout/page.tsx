"use client"

import { Info, Landmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/layout/header"
import { useHelper } from "@/hooks/useHelpers"
import { getAvatarColorHexForId, SQUIRCLE_RADIUS } from "@/lib/constants"
import { useProjectSelection } from "@/contexts/project-context"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useUser } from "@/contexts/user-context"
import { useStartHelperPaymentConnect } from "@/hooks/usePaymentConnect"
import { usePaymentStatus } from "@/hooks/usePaymentStatus"
import { connectStatusLabel } from "@/lib/payment-status"
import { ListSkeleton } from "@/components/ui/skeleton"

export default function HelperPayoutPage() {
  const { user } = useUser()
  const userId = user?.id ?? ""
  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  const { data: helperId, isLoading: currentHelperLoading } = useCurrentHelper(projectId)
  const { data: helperData, isLoading: helperLoading } = useHelper(helperId ?? "")

  // Connect onboarding is user-scoped but mode follows the selected project:
  // a sandbox project onboards a test-mode account, a real project a live one,
  // kept strictly separate server-side.
  const startConnect = useStartHelperPaymentConnect()
  const status = usePaymentStatus({ scope: "user", scopeId: userId, projectId })
  const statusLabel = status.data ? connectStatusLabel(status.data).label : "Not set up"

  const handleSetupPayout = async () => {
    try {
      const { url } = await startConnect.mutateAsync({ projectId })
      window.location.assign(url)
    } catch (err) {
      console.error("Failed to start helper Connect onboarding:", err)
    }
  }

  const isLoading = currentHelperLoading || (!!projectId && !!helperId && helperLoading)

  if (!projectId) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Payout" subtitle="Set up payout details for support" />
        <main className="flex-1 overflow-auto px-8 py-6">
          <div className="max-w-3xl divide-y divide-border-subtle">
            <p className="text-muted-foreground">Select a project to view and edit your payout details.</p>
          </div>
        </main>
      </div>
    )
  }

  if (!currentHelperLoading && projectId && helperId === null) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Payout" subtitle="Set up payout details for support" />
        <main className="flex-1 overflow-auto px-8 py-6">
          <div className="max-w-3xl divide-y divide-border-subtle">
            <p className="text-sm text-left pl-2 text-muted-foreground">You are not registered as a helper in this project.</p>
          </div>
        </main>
      </div>
    )
  }

  if (isLoading || !helperData) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Payout" subtitle="Set up payout details for support" />
        <main className="flex-1 overflow-auto px-8 py-6">
          <ListSkeleton rows={4} avatar={false} badge={false} className="max-w-3xl divide-y-0" />
        </main>
      </div>
    )
  }

  const displayName = helperData.user?.name || "Unknown"
  const displayAvatar = (displayName || "U")[0].toUpperCase()

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Payout" subtitle="Set up payout details for support" />

      <main className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-3xl divide-y divide-border-subtle">
          <div className="bg-card rounded-lg py-6 pr-6">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Payout details</h2>
              <Info className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="mt-8 flex flex-col gap-10">
              {/* Stripe → helper avatar connection */}
              <div className="flex items-center gap-1">
                {/* Third-party brand colour (Stripe); kept on purpose, not a token. */}
                <div className={`flex size-[42px] shrink-0 items-center justify-center bg-[#635bff] ${SQUIRCLE_RADIUS[42]}`}>
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
                  className={`flex size-[42px] shrink-0 items-center justify-center ${SQUIRCLE_RADIUS[42]} text-foreground font-medium`}
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
                  className="w-fit px-5 py-2.5 text-ui font-medium bg-[#635bff] text-white hover:bg-[#5851e5]"
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
        </div>
      </main>
    </div>
  )
}
