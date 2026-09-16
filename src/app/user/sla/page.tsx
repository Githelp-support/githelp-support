"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { useUser } from "@/contexts/user-context"
import {
  useCreateSlaSubscription,
  useJoinSla,
  useMySLAs,
  useRealtimeSla,
  useSlaUsage,
  type MySla,
} from "@/hooks/useSLAs"
import { usePaymentStatus } from "@/hooks/usePaymentStatus"
import { useSetupPaymentMethod } from "@/hooks/useSetupPaymentMethod"
import {
  SLA_STATUS_BADGE_CLASS,
  SLA_STATUS_LABELS,
  formatSlaAmount,
  formatSlaDate,
  formatSlaMinutes,
  frequencyPerLabel,
  isUnlimitedSla,
  normalizeSlaAccessCode,
} from "@/lib/sla"

const RETURN_PATH = "/user/sla"

function formatCodeInput(raw: string): string {
  const compact = raw.replace(/[^0-9a-z]/gi, "").toUpperCase().slice(0, 12)
  return compact.replace(/(.{4})(?=.)/g, "$1-")
}

function JoinSlaCard() {
  const [code, setCode] = useState("")
  const joinSla = useJoinSla()
  const normalized = normalizeSlaAccessCode(code)

  const handleJoin = async () => {
    if (!normalized) {
      toast.error("The SLA code has 12 characters, like ABCD-1234-EFGH.")
      return
    }
    try {
      const result = await joinSla.mutateAsync({ accessCode: normalized })
      toast.success(`You're linked to ${result.name ?? "the SLA"} with ${result.projectName ?? "the project"}.`)
      setCode("")
    } catch (error) {
      console.error("Failed to join SLA:", error)
      toast.error(error instanceof Error ? error.message : "Could not link that SLA code.")
    }
  }

  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <h2 className="text-base font-semibold text-foreground">Join an SLA with a code</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The project team shares a 12-character code with every agreement. Enter it to link your organization.
        </p>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            void handleJoin()
          }}
        >
          <Input
            value={code}
            onChange={(e) => setCode(formatCodeInput(e.target.value))}
            placeholder="ABCD-1234-EFGH"
            autoComplete="off"
            spellCheck={false}
            className="font-mono tracking-widest uppercase sm:max-w-xs"
            aria-label="SLA code"
          />
          <Button type="submit" variant="lavender" disabled={!normalized || joinSla.isPending}>
            {joinSla.isPending ? "Linking…" : "Link SLA"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function SlaCard({ sla }: { sla: MySla }) {
  const router = useRouter()
  useRealtimeSla(sla.id)
  const usage = useSlaUsage(sla.id)
  const createSubscription = useCreateSlaSubscription()
  const setupCard = useSetupPaymentMethod()
  const projectId = sla.project?.project_id ?? sla.project_id
  const cardStatus = usePaymentStatus({
    scope: "organization",
    scopeId: sla.organization_id ?? "",
    projectId,
  })
  const hasCard = !!cardStatus.data?.default_payment_method_id
  const unlimited = isUnlimitedSla(sla)
  const period = usage.data?.period
  const percent =
    period && period.minutesAvailable > 0
      ? Math.min(100, Math.round((period.minutesConsumed / period.minutesAvailable) * 100))
      : 0
  const overageCost = period && usage.data
    ? period.overageMinutes * usage.data.overagePricePerMinuteSmallestUnit
    : 0
  const chatHref = `/support/chat?project=${encodeURIComponent(projectId)}&sla=${encodeURIComponent(sla.id)}`

  const handleActivate = async () => {
    try {
      await createSubscription.mutateAsync({ slaId: sla.id })
      toast.success("Subscription started. The first invoice is being processed by Stripe.")
    } catch (error) {
      console.error("Failed to start SLA subscription:", error)
      toast.error(error instanceof Error ? error.message : "Could not start the subscription.")
    }
  }

  const handleAddCard = async () => {
    if (!sla.organization_id) return
    try {
      const out = await setupCard.mutateAsync({
        scope: "organization",
        organizationId: sla.organization_id,
        projectId,
        returnPath: RETURN_PATH,
      })
      window.location.assign(out.checkoutUrl)
    } catch (error) {
      console.error("Failed to start card setup:", error)
      toast.error(error instanceof Error ? error.message : "Could not open Stripe to add a card.")
    }
  }

  return (
    <Card className="border-border">
      <CardContent className="p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{sla.project?.name ?? "Project"}</p>
            <h2 className="text-lg font-semibold text-foreground truncate">{sla.name ?? "Service-level agreement"}</h2>
            <p className="text-sm text-muted-foreground">
              {formatSlaAmount(sla.subscription_amount_smallest_unit, sla.currency)} {frequencyPerLabel(sla.payment_frequency)}
              {" · "}
              {unlimited ? "Unlimited support time" : `${formatSlaMinutes(sla.minutes_included)} included ${frequencyPerLabel(sla.payment_frequency)}`}
              {sla.minutes_rollover && !unlimited ? " · unused time rolls over" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={SLA_STATUS_BADGE_CLASS[sla.status]}>
              {SLA_STATUS_LABELS[sla.status]}
            </Badge>
            <Badge variant="outline">
              {sla.stripe_subscription_id ? "Subscription active" : "No subscription yet"}
            </Badge>
          </div>
        </div>

        {/* Usage */}
        {usage.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading usage…</p>
        ) : usage.error ? (
          <p className="text-sm text-red-700">Could not load usage: {usage.error.message}</p>
        ) : period ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-foreground">
                {unlimited
                  ? `${formatSlaMinutes(period.minutesConsumed)} used this period`
                  : `${formatSlaMinutes(period.minutesRemaining)} of ${formatSlaMinutes(period.minutesAvailable)} left`}
              </span>
              <span className="text-muted-foreground">
                {formatSlaDate(period.periodStart)} – {formatSlaDate(period.periodEnd)}
              </span>
            </div>
            {!unlimited && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className={`h-full rounded-full ${period.overageMinutes > 0 ? "bg-amber-500" : "bg-brand-primary"}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {period.minutesRolledOver > 0 && <span>{formatSlaMinutes(period.minutesRolledOver)} rolled over</span>}
              {period.overageMinutes > 0 && (
                <span className="text-amber-700">
                  {formatSlaMinutes(period.overageMinutes)} over the included time
                  {overageCost > 0 ? ` · about ${formatSlaAmount(overageCost, usage.data?.currency)} on the next invoice` : ""}
                </span>
              )}
              {sla.end_date && <span>Ends {formatSlaDate(sla.end_date)}</span>}
            </div>
          </div>
        ) : null}

        {usage.data && !usage.data.covered && (
          <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This agreement is not covering new tickets right now
            {usage.data.coverageReason === "expired" ? " because it has ended." : usage.data.coverageReason === "inactive" ? " until its payment goes through." : "."}
            {" "}Contact {sla.project?.name ?? "the project"} if you think this is wrong.
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="lavender" disabled={!usage.data?.covered && sla.status !== "active"} onClick={() => router.push(chatHref)}>
            Open support chat
          </Button>
          {!sla.stripe_subscription_id && sla.organization_id && (
            hasCard ? (
              <Button variant="outline" onClick={handleActivate} disabled={createSubscription.isPending}>
                {createSubscription.isPending ? "Starting…" : "Activate subscription"}
              </Button>
            ) : (
              <Button variant="outline" onClick={handleAddCard} disabled={setupCard.isPending || cardStatus.isLoading}>
                {setupCard.isPending ? "Opening Stripe…" : "Add a card to activate"}
              </Button>
            )
          )}
          <Button asChild variant="ghost" size="sm">
            <Link href="/support/tickets">My tickets</Link>
          </Button>
        </div>
        {!sla.stripe_subscription_id && sla.organization_id && !hasCard && !cardStatus.isLoading && (
          <p className="text-xs text-muted-foreground">
            The subscription is billed to your organization&apos;s card. Add one first, then activate.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function UserSlaPage() {
  const { user, isLoading: userLoading } = useUser()
  const userId = user?.id
  const isAuthenticated = !!userId
  const { data: slas, isLoading, error } = useMySLAs(userId)

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Service-level agreements" subtitle="Your organization's support plans and how much time is left." />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {!isAuthenticated && !userLoading && (
            <Card className="border-border">
              <CardContent className="p-6">
                <p className="text-muted-foreground">
                  Sign in to see the agreements your organization has with the projects you get support from.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-4 border-brand-primary text-brand-primary hover:bg-brand-primary/10"
                >
                  <Link href={`/auth/signin?redirect=${encodeURIComponent(RETURN_PATH)}`}>Sign in</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {isAuthenticated && (
            <>
              <JoinSlaCard />

              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  Could not load your agreements. Please try again later.
                </div>
              )}

              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading your agreements…</p>
              ) : (slas ?? []).length === 0 ? (
                <Card className="border-dashed border-border">
                  <CardContent className="p-6 space-y-2">
                    <h2 className="text-base font-semibold text-foreground">No agreements yet</h2>
                    <p className="text-sm text-muted-foreground">
                      A service-level agreement gives your organization a block of included support time each
                      period, guaranteed response times and one recurring invoice instead of paying per ticket.
                      Agreements are set up by the project team. Once they create one for you, they share a code
                      that you enter above. Until then, support works per ticket as usual.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {(slas ?? []).map((sla) => (
                    <SlaCard key={sla.id} sla={sla} />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
