"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Info, Landmark } from "lucide-react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Logo } from "@/components/brand/logo"
import { useProject, useProjectPaymentSettings, useUpdateProjectPaymentSettings } from "@/hooks/useProject"
import { useStartPaymentConnect } from "@/hooks/usePaymentConnect"
import { usePaymentStatus } from "@/hooks/usePaymentStatus"
import { useOrgSpendingCaps, useUpdateOrgSpendingCaps } from "@/hooks/useOrgSpendingCaps"
import { connectStatusLabel } from "@/lib/payment-status"
import { formatCapDollars, parseCapDollars } from "@/lib/cap-format"
import { DistributionPreview } from "@/components/payment/distribution-preview"
import { useProjectSelection } from "@/contexts/project-context"
import { useUnsavedChangesGuard } from "@/contexts/unsaved-changes-context"
import { getFunctionErrorMessage } from "@/lib/functions-error"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { SQUIRCLE_RADIUS } from "@/lib/constants"

// Org-level spending caps are temporarily hidden from the admin Payments page.
// The section and its wiring are kept intact below — flip this to re-enable.
const SHOW_SPENDING_CAPS = false

// Ticket prices are stored as smallint cents (NOT NULL), so the largest
// representable price is 327.67 and empty / negative inputs must never be sent.
const MAX_PRICE_DOLLARS = 327.67

const errorMessage = (error: unknown, fallback: string) =>
  (error instanceof Error && error.message) ||
  (typeof (error as { message?: unknown } | null)?.message === "string"
    ? (error as { message: string }).message
    : fallback)

/** Dollar input → cents; null when empty, non-numeric, negative or above the column limit. */
function parsePriceCents(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed === ".") return null
  if (!/^\d*\.?\d*$/.test(trimmed)) return null
  const dollars = Number(trimmed)
  if (!Number.isFinite(dollars) || dollars < 0 || dollars > MAX_PRICE_DOLLARS) return null
  return Math.round(dollars * 100)
}

function priceError(value: string): string | null {
  if (!value.trim()) return "Enter a price (0 for free)."
  if (parsePriceCents(value) === null) return `Enter an amount between 0 and ${MAX_PRICE_DOLLARS.toFixed(2)}.`
  return null
}

const isValidPercentage = (value: number) => Number.isInteger(value) && value >= 0 && value <= 100

export default function PaymentSettingsPage() {
  const [activeTab, setActiveTab] = useState<"helper" | "user">("user")

  const { selectedProjectId: projectId } = useProjectSelection()

  // Fetch payment settings from database
  const { data: paymentSettings, isLoading: settingsLoading } = useProjectPaymentSettings(projectId || "")
  const updatePaymentSettings = useUpdateProjectPaymentSettings()

  // Project (used for organization_id when starting Connect onboarding)
  const { data: project } = useProject(projectId || "")
  const startConnect = useStartPaymentConnect()
  const orgId = project?.organization_id ?? ""
  const orgStatus = usePaymentStatus({ scope: "organization", scopeId: orgId, projectId: projectId || undefined })
  const orgStatusLabel = orgStatus.data
    ? connectStatusLabel(orgStatus.data).label
    : "Not set up"

  // Spending caps state — bound to inputs as dollar strings; "" = no cap.
  const orgCaps = useOrgSpendingCaps(orgId)
  const updateCaps = useUpdateOrgSpendingCaps()
  const [orgMonthlyCap, setOrgMonthlyCap] = useState("")
  const [defaultUserCap, setDefaultUserCap] = useState("")
  const [capsOriginal, setCapsOriginal] = useState<{ org: string; user: string } | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (orgCaps.data) {
      const org = formatCapDollars(orgCaps.data.monthly_spend_cap_smallest_unit)
      const user = formatCapDollars(orgCaps.data.default_user_monthly_cap_smallest_unit)
      setOrgMonthlyCap(org)
      setDefaultUserCap(user)
      setCapsOriginal({ org, user })
    }
  }, [orgCaps.data])
  /* eslint-enable react-hooks/set-state-in-effect */

  const hasCapsChanges = capsOriginal !== null &&
    (orgMonthlyCap !== capsOriginal.org || defaultUserCap !== capsOriginal.user)

  const handleSaveCaps = async () => {
    if (!orgId) return
    try {
      await updateCaps.mutateAsync({
        organizationId: orgId,
        monthlySpendCapSmallestUnit: parseCapDollars(orgMonthlyCap),
        defaultUserMonthlyCapSmallestUnit: parseCapDollars(defaultUserCap),
      })
      setCapsOriginal({ org: orgMonthlyCap, user: defaultUserCap })
      toast.success("Spending caps saved")
    } catch (err) {
      console.error("Failed to save spending caps:", err)
      toast.error(errorMessage(err, "Couldn't save spending caps. Please try again."))
    }
  }

  const handleSetupPayouts = async () => {
    if (!project?.organization_id || !projectId) return
    try {
      const { url } = await startConnect.mutateAsync({
        organizationId: project.organization_id,
        projectId,
      })
      window.location.assign(url)
    } catch (err) {
      console.error("Failed to start Connect onboarding:", err)
      toast.error(await getFunctionErrorMessage(err, "Couldn't start payout setup. Please try again."))
    }
  }

  // Team sharing ratios (core_helper_percentage)
  const [teamMemberRatio, setTeamMemberRatio] = useState([100])
  const [teamProjectRatio, setTeamProjectRatio] = useState([0])

  // Community sharing ratios (community_helper_percentage)
  const [communityHelperRatio, setCommunityHelperRatio] = useState([100])
  const [communityProjectRatio, setCommunityProjectRatio] = useState([0])

  // External consultant settings (consultant_helper_percentage, extended_contract_type)
  const [contractType, setContractType] = useState<"ticket" | "outside">("outside")
  const [consultantRatio, setConsultantRatio] = useState([100])
  const [consultantProjectRatio, setConsultantProjectRatio] = useState([0])

  // Track original values to detect changes
  const [originalValues, setOriginalValues] = useState<{
    core_helper_percentage: number | null
    community_helper_percentage: number | null
    consultant_helper_percentage: number | null
    extended_contract_type: "ticket" | "outside" | null
    ticket_start_price: number | null
    ticket_price_minute_first_60: number | null
    ticket_price_minute_after_60: number | null
    tickets_enabled: boolean | null
    sla_enabled: boolean | null
  }>({
    core_helper_percentage: null,
    community_helper_percentage: null,
    consultant_helper_percentage: null,
    extended_contract_type: null,
    ticket_start_price: null,
    ticket_price_minute_first_60: null,
    ticket_price_minute_after_60: null,
    tickets_enabled: null,
    sla_enabled: null,
  })

  // User payment settings (declare before useEffect that uses setters)
  const [paymentByTicket, setPaymentByTicket] = useState(false)
  const [paymentBySLA, setPaymentBySLA] = useState(false)
  const [startPrice, setStartPrice] = useState("0.00")
  const [costPerMinuteFirst60, setCostPerMinuteFirst60] = useState("0.00")
  const [costPerMinuteAfter60, setCostPerMinuteAfter60] = useState("0.00")

  // Initialize form state from API (one-time sync when settings load)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (paymentSettings) {
      const corePercentage = paymentSettings.core_helper_percentage
      const communityPercentage = paymentSettings.community_helper_percentage
      const consultantPercentage = paymentSettings.consultant_helper_percentage
      const contractTypeValue = paymentSettings.extended_contract_type || "outside"
      const ticketsEnabled = paymentSettings.tickets_enabled ?? false
      const slaEnabled = paymentSettings.sla_enabled ?? false

      // Convert cents to dollars for display (database stores in cents)
      const startPriceCents = paymentSettings.ticket_start_price ?? 0
      const first60Cents = paymentSettings.ticket_price_minute_first_60 ?? 0
      const after60Cents = paymentSettings.ticket_price_minute_after_60 ?? 0

      setTeamMemberRatio([corePercentage])
      setTeamProjectRatio([100 - corePercentage])
      setCommunityHelperRatio([communityPercentage])
      setCommunityProjectRatio([100 - communityPercentage])
      setConsultantRatio([consultantPercentage])
      setConsultantProjectRatio([100 - consultantPercentage])
      setContractType(contractTypeValue)

      // User payment options
      setPaymentByTicket(ticketsEnabled)
      setPaymentBySLA(slaEnabled)

      // Set ticket pricing (convert cents to dollars)
      setStartPrice((startPriceCents / 100).toFixed(2))
      setCostPerMinuteFirst60((first60Cents / 100).toFixed(2))
      setCostPerMinuteAfter60((after60Cents / 100).toFixed(2))

      // Store original values
      setOriginalValues({
        core_helper_percentage: corePercentage,
        community_helper_percentage: communityPercentage,
        consultant_helper_percentage: consultantPercentage,
        extended_contract_type: contractTypeValue,
        ticket_start_price: startPriceCents,
        ticket_price_minute_first_60: first60Cents,
        ticket_price_minute_after_60: after60Cents,
        tickets_enabled: ticketsEnabled,
        sla_enabled: slaEnabled,
      })
    }
  }, [paymentSettings])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Check if each section has changes
  const hasTeamChanges = originalValues.core_helper_percentage !== null &&
    teamMemberRatio[0] !== originalValues.core_helper_percentage

  const hasCommunityChanges = originalValues.community_helper_percentage !== null &&
    communityHelperRatio[0] !== originalValues.community_helper_percentage

  const hasConsultantChanges = originalValues.consultant_helper_percentage !== null &&
    (consultantRatio[0] !== originalValues.consultant_helper_percentage ||
     contractType !== originalValues.extended_contract_type)

  // Ticket pricing: validate before comparing / saving. An invalid field
  // (empty, negative, above the smallint limit) blocks Save instead of
  // sending NaN / out-of-range cents.
  const parsedStartCents = parsePriceCents(startPrice)
  const parsedFirst60Cents = parsePriceCents(costPerMinuteFirst60)
  const parsedAfter60Cents = parsePriceCents(costPerMinuteAfter60)
  const priceErrors = {
    start: priceError(startPrice),
    first60: priceError(costPerMinuteFirst60),
    after60: priceError(costPerMinuteAfter60),
  }
  const pricesValid = !priceErrors.start && !priceErrors.first60 && !priceErrors.after60

  // Check if user payment settings (ticket pricing) have changes
  const hasUserChanges = originalValues.ticket_start_price !== null && (
    parsedStartCents !== originalValues.ticket_start_price ||
    parsedFirst60Cents !== originalValues.ticket_price_minute_first_60 ||
    parsedAfter60Cents !== originalValues.ticket_price_minute_after_60
  )

  const teamPercentageValid = isValidPercentage(teamMemberRatio[0])
  const communityPercentageValid = isValidPercentage(communityHelperRatio[0]) && communityHelperRatio[0] >= 85
  const consultantPercentageValid = isValidPercentage(consultantRatio[0])

  // Check if user payment options (SLA / ticket enabled) have changes
  const hasUserOptionsChanges =
    originalValues.tickets_enabled !== null &&
    originalValues.sla_enabled !== null &&
    (paymentByTicket !== originalValues.tickets_enabled ||
      paymentBySLA !== originalValues.sla_enabled)

  // Warn before navigating away while any payment section has unsaved edits
  useUnsavedChangesGuard(
    hasTeamChanges ||
      hasCommunityChanges ||
      hasConsultantChanges ||
      hasUserChanges ||
      hasUserOptionsChanges ||
      hasCapsChanges
  )

  // Compute 1-hour support cost for distribution preview (start price + 60 min at first-60 rate)
  const oneHourTotal = (() => {
    const start = parseFloat(startPrice) || 0
    const perMin = parseFloat(costPerMinuteFirst60) || 0
    return Math.max(0, start + 60 * perMin)
  })()

  const handleTeamMemberChange = (value: number[]) => {
    setTeamMemberRatio(value)
    setTeamProjectRatio([100 - value[0]])
  }

  const handleTeamProjectChange = (value: number[]) => {
    setTeamProjectRatio(value)
    setTeamMemberRatio([100 - value[0]])
  }

  const handleCommunityHelperChange = (value: number[]) => {
    const newValue = Math.max(85, value[0]) // Minimum 85%
    setCommunityHelperRatio([newValue])
    setCommunityProjectRatio([100 - newValue])
  }

  const handleCommunityProjectChange = (value: number[]) => {
    const newValue = Math.min(15, value[0]) // Maximum 15%
    setCommunityProjectRatio([newValue])
    setCommunityHelperRatio([100 - newValue])
  }

  const handleConsultantChange = (value: number[]) => {
    setConsultantRatio(value)
    setConsultantProjectRatio([100 - value[0]])
  }

  const handleConsultantProjectChange = (value: number[]) => {
    setConsultantProjectRatio(value)
    setConsultantRatio([100 - value[0]])
  }

  const handleSaveTeamSettings = async () => {
    if (!projectId) return
    if (!teamPercentageValid) {
      toast.error("The team sharing ratio must be a whole number between 0 and 100.")
      return
    }
    try {
      await updatePaymentSettings.mutateAsync({
        projectId,
        updates: {
          core_helper_percentage: teamMemberRatio[0],
        },
      })
      // Update original values after successful save
      setOriginalValues(prev => ({
        ...prev,
        core_helper_percentage: teamMemberRatio[0],
      }))
      toast.success("Team sharing ratio saved")
    } catch (error) {
      console.error("Failed to save team settings:", error)
      toast.error(errorMessage(error, "Couldn't save the team sharing ratio. Please try again."))
    }
  }

  const handleSaveCommunitySettings = async () => {
    if (!projectId) return
    if (!communityPercentageValid) {
      toast.error("The community helper share must be a whole number between 85 and 100.")
      return
    }
    try {
      await updatePaymentSettings.mutateAsync({
        projectId,
        updates: {
          community_helper_percentage: communityHelperRatio[0],
        },
      })
      // Update original values after successful save
      setOriginalValues(prev => ({
        ...prev,
        community_helper_percentage: communityHelperRatio[0],
      }))
      toast.success("Community sharing ratio saved")
    } catch (error) {
      console.error("Failed to save community settings:", error)
      toast.error(errorMessage(error, "Couldn't save the community sharing ratio. Please try again."))
    }
  }

  const handleSaveConsultantSettings = async () => {
    if (!projectId) return
    if (!consultantPercentageValid) {
      toast.error("The consultant sharing ratio must be a whole number between 0 and 100.")
      return
    }
    try {
      await updatePaymentSettings.mutateAsync({
        projectId,
        updates: {
          consultant_helper_percentage: consultantRatio[0],
          extended_contract_type: contractType,
        },
      })
      // Update original values after successful save
      setOriginalValues(prev => ({
        ...prev,
        consultant_helper_percentage: consultantRatio[0],
        extended_contract_type: contractType,
      }))
      toast.success("Consultant settings saved")
    } catch (error) {
      console.error("Failed to save consultant settings:", error)
      toast.error(errorMessage(error, "Couldn't save the consultant settings. Please try again."))
    }
  }

  const handleSaveUserSettings = async () => {
    if (!projectId) return
    // Re-validate at save time: the button is disabled while invalid, but
    // never send NaN / negative / out-of-range cents to the smallint columns.
    if (parsedStartCents === null || parsedFirst60Cents === null || parsedAfter60Cents === null) {
      toast.error(`Prices must be between 0 and ${MAX_PRICE_DOLLARS.toFixed(2)} USD.`)
      return
    }
    const startPriceCents = parsedStartCents
    const first60Cents = parsedFirst60Cents
    const after60Cents = parsedAfter60Cents
    try {
      await updatePaymentSettings.mutateAsync({
        projectId,
        updates: {
          ticket_start_price: startPriceCents,
          ticket_price_minute_first_60: first60Cents,
          ticket_price_minute_after_60: after60Cents,
        },
      })
      // Update original values after successful save
      setOriginalValues(prev => ({
        ...prev,
        ticket_start_price: startPriceCents,
        ticket_price_minute_first_60: first60Cents,
        ticket_price_minute_after_60: after60Cents,
      }))
      // Normalise the inputs to two decimals so the form reflects what was stored
      setStartPrice((startPriceCents / 100).toFixed(2))
      setCostPerMinuteFirst60((first60Cents / 100).toFixed(2))
      setCostPerMinuteAfter60((after60Cents / 100).toFixed(2))
      toast.success("Ticket prices saved")
    } catch (error) {
      console.error("Failed to save user settings:", error)
      toast.error(errorMessage(error, "Couldn't save ticket prices. Please try again."))
    }
  }

  const handleSaveUserOptions = async () => {
    if (!projectId) return
    try {
      await updatePaymentSettings.mutateAsync({
        projectId,
        updates: {
          tickets_enabled: paymentByTicket,
          sla_enabled: paymentBySLA,
        },
      })
      setOriginalValues(prev => ({
        ...prev,
        tickets_enabled: paymentByTicket,
        sla_enabled: paymentBySLA,
      }))
      toast.success("Payment options saved")
    } catch (error) {
      console.error("Failed to save user payment options:", error)
      toast.error(errorMessage(error, "Couldn't save payment options. Please try again."))
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden [&>header]:pl-14">
      <Header title="Payment Settings" subtitle="Manage rates and sharing ratios" info="Configure what users pay for support, and how each payment is split between your project and its helpers." />
      <main className="flex-1 px-8 py-6 overflow-y-auto">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex gap-1 pl-6">

            <button
              onClick={() => setActiveTab("user")}
              className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 cursor-pointer ${
                activeTab === "user"
                  ? "text-brand-primary border-brand-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              User
            </button>
                          <button
              onClick={() => setActiveTab("helper")}
              className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 cursor-pointer ${
                activeTab === "helper"
                  ? "text-brand-primary border-brand-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              Helper
            </button>
          </div>
          {/* Full-width line below tabs */}
          <div className="h-px bg-border -mx-8"></div>
        </div>

        <div className="max-w-5xl">
          {activeTab === "helper" && (
            <div className="space-y-6">
              {/* Team Section */}
              <div className="bg-card rounded-lg p-6">
                <div className="flex flex-col sm:flex-row gap-10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-foreground">Team</h2>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <Button
                        variant="lavender"
                        size="sm"
                        onClick={handleSaveTeamSettings}
                        disabled={!hasTeamChanges || !teamPercentageValid || updatePaymentSettings.isPending || settingsLoading}
                      >
                        {updatePaymentSettings.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-ui font-semibold text-foreground">Sharing ratio</h3>

                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-muted-foreground">Payment to team-member</span>
                            <span className="text-sm font-semibold text-foreground">{teamMemberRatio[0]}%</span>
                          </div>
                          <div className="relative">
                            <Slider
                              value={teamMemberRatio}
                              onValueChange={handleTeamMemberChange}
                              max={100}
                              step={1}
                              className="w-full [&_[data-slot='slider-thumb']]:border-brand-primary [&_[data-slot='slider-thumb']]:bg-brand-primary [&_[data-slot='slider-range']]:bg-brand-primary"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-muted-foreground">Payment to project</span>
                            <span className="text-sm font-semibold text-foreground">{teamProjectRatio[0]}%</span>
                          </div>
                          <div className="relative">
                            <Slider
                              value={teamProjectRatio}
                              onValueChange={handleTeamProjectChange}
                              max={100}
                              step={1}
                              className="w-full [&_[data-slot='slider-thumb']]:border-brand-primary [&_[data-slot='slider-thumb']]:bg-brand-primary [&_[data-slot='slider-range']]:bg-brand-primary"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DistributionPreview
                    helperPercentage={teamMemberRatio[0]}
                    oneHourTotal={oneHourTotal}
                  />
                </div>
              </div>

              {/* Community Section */}
              <div className="bg-card rounded-lg p-6">
                <div className="flex flex-col sm:flex-row gap-10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-foreground">Community</h2>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <Button
                        variant="lavender"
                        size="sm"
                        onClick={handleSaveCommunitySettings}
                        disabled={!hasCommunityChanges || !communityPercentageValid || updatePaymentSettings.isPending || settingsLoading}
                      >
                        {updatePaymentSettings.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-ui font-semibold text-foreground">Sharing ratio</h3>

                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-muted-foreground">Payment to community helper</span>
                            <span className="text-sm font-semibold text-foreground">{communityHelperRatio[0]}%</span>
                          </div>
                          <div className="relative">
                            <Slider
                              value={communityHelperRatio}
                              onValueChange={handleCommunityHelperChange}
                              min={85}
                              max={100}
                              step={1}
                              className="w-full [&_[data-slot='slider-thumb']]:border-brand-primary [&_[data-slot='slider-thumb']]:bg-brand-primary [&_[data-slot='slider-range']]:bg-brand-primary"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-muted-foreground">Payment to project</span>
                            <span className="text-sm font-semibold text-foreground">{communityProjectRatio[0]}%</span>
                          </div>
                          <div className="relative">
                            <Slider
                              value={communityProjectRatio}
                              onValueChange={handleCommunityProjectChange}
                              min={0}
                              max={15}
                              step={1}
                              className="w-full [&_[data-slot='slider-thumb']]:border-brand-primary [&_[data-slot='slider-thumb']]:bg-brand-primary [&_[data-slot='slider-range']]:bg-brand-primary"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-muted rounded-md px-5 py-3 mt-4">
                        <p className="text-ui text-muted-foreground">Payment to community helper can&apos;t be below 85%</p>
                      </div>
                    </div>
                  </div>
                  <DistributionPreview
                    helperPercentage={communityHelperRatio[0]}
                    oneHourTotal={oneHourTotal}
                  />
                </div>
              </div>

              {/* External Consultants Section */}
              <div className="bg-card rounded-lg p-6">
                <div className="flex flex-col sm:flex-row gap-10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-foreground">External Consultants and Companies</h2>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <Button
                        variant="lavender"
                        size="sm"
                        onClick={handleSaveConsultantSettings}
                        disabled={!hasConsultantChanges || !consultantPercentageValid || updatePaymentSettings.isPending || settingsLoading}
                      >
                        {updatePaymentSettings.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-ui font-semibold text-foreground mb-4">Type of contract</h3>
                        <div className="space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="contractType"
                              value="ticket"
                              checked={contractType === "ticket"}
                              onChange={(e) => setContractType(e.target.value as "ticket")}
                              className="w-4 h-4 text-brand-primary border-border-control focus:outline-none focus-visible:outline-none focus-visible:ring-0 cursor-pointer"
                            />
                            <span className="text-sm text-muted-foreground">By the ticket</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="contractType"
                              value="outside"
                              checked={contractType === "outside"}
                              onChange={(e) => setContractType(e.target.value as "outside")}
                              className="w-4 h-4 text-brand-primary border-border-control focus:outline-none focus-visible:outline-none focus-visible:ring-0 cursor-pointer"
                            />
                            <span className="text-sm text-muted-foreground">Payment outside Githelp</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-ui font-semibold text-foreground mb-4">Sharing ratio</h3>
                        <div className="space-y-6">
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm text-muted-foreground">Payment to consultant/company</span>
                              <span className="text-sm font-semibold text-foreground">{consultantRatio[0]}%</span>
                            </div>
                            <div className="relative">
                              <Slider
                                value={consultantRatio}
                                onValueChange={handleConsultantChange}
                                max={100}
                                step={1}
                                className="w-full [&_[data-slot='slider-thumb']]:border-brand-primary [&_[data-slot='slider-thumb']]:bg-brand-primary [&_[data-slot='slider-range']]:bg-brand-primary"
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm text-muted-foreground">Payment to project</span>
                              <span className="text-sm font-semibold text-foreground">{consultantProjectRatio[0]}%</span>
                            </div>
                            <div className="relative">
                              <Slider
                                value={consultantProjectRatio}
                                onValueChange={handleConsultantProjectChange}
                                max={100}
                                step={1}
                                className="w-full [&_[data-slot='slider-thumb']]:border-brand-primary [&_[data-slot='slider-thumb']]:bg-brand-primary [&_[data-slot='slider-range']]:bg-brand-primary"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DistributionPreview
                    helperPercentage={consultantRatio[0]}
                    oneHourTotal={oneHourTotal}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "user" && (
            <div className="space-y-6">
              {/* Users of support Section */}
              <div className="bg-card rounded-lg p-6">
                <div className="flex items-center gap-2 mb-6">
                  <h2 className="text-base font-semibold text-foreground">Payment options</h2>
                  <InfoTooltip
                    label="About payment options"
                    content="Choose how users can pay for support. With pay per ticket, users pay for each ticket that gets claimed. With SLAs, users get support under the terms of an agreement. You can offer one or both."
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <label
                      htmlFor="by-ticket"
                      className={cn(
                        "flex items-start gap-3 rounded-md border border-border-control p-4 cursor-pointer transition-colors hover:bg-muted/40",
                        paymentByTicket && "border-brand-primary bg-brand-primary/5"
                      )}
                    >
                      <Checkbox
                        id="by-ticket"
                        checked={paymentByTicket}
                        onCheckedChange={(checked) => setPaymentByTicket(checked === true)}
                        className="mt-0.5 data-[state=checked]:bg-brand-primary data-[state=checked]:border-brand-primary"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">By the ticket</span>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Users pay per support ticket based on the configured ticket cost below.
                        </p>
                      </div>
                    </label>

                    <label
                      htmlFor="sla"
                      className={cn(
                        "flex items-start gap-3 rounded-md border border-border-control p-4 cursor-pointer transition-colors hover:bg-muted/40",
                        paymentBySLA && "border-brand-primary bg-brand-primary/5"
                      )}
                    >
                      <Checkbox
                        id="sla"
                        checked={paymentBySLA}
                        onCheckedChange={(checked) => setPaymentBySLA(checked === true)}
                        className="mt-0.5 data-[state=checked]:bg-brand-primary data-[state=checked]:border-brand-primary"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">SLA</span>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Users subscribe to a service-level agreement with guaranteed response times.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex mt-6">
                  <Button
                    variant="lavender"
                    size="sm"
                    onClick={handleSaveUserOptions}
                    disabled={!hasUserOptionsChanges || updatePaymentSettings.isPending || settingsLoading}
                  >
                    {updatePaymentSettings.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>

              {/* Ticket cost Section */}
              <div className="bg-card rounded-lg p-6">
                <div className="flex items-center gap-2 mb-6">
                  <h2 className="text-base font-semibold text-foreground">Ticket cost</h2>
                  <InfoTooltip
                    label="About Stripe fees"
                    className="max-w-sm"
                    content={
                      <>
                        <span className="block font-semibold">Stripe fee</span>
                        When a ticket opens, an authorization hold for the estimated time is placed on the
                        user&apos;s card and captured when the ticket ends. Time beyond the hold is charged
                        as a separate transaction, long-running tickets are captured once a week, and a declined
                        card is retried as a new charge. Each of these is its own card transaction, and Stripe&apos;s
                        fee (typically 2.9% + $0.30 for US cards) applies to every one of them. The fee is deducted
                        from that charge before the helper and project shares above are applied, so a ticket paid in
                        two transactions gives up the fixed $0.30 twice. Stripe&apos;s fees are never added on top of
                        what the user is charged.
                      </>
                    }
                  />
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-ui font-semibold text-foreground">Start price</span>
                      <InfoTooltip
                        label="About start price"
                        content="A fixed fee charged when a helper claims a ticket, added on top of any per-minute cost."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={MAX_PRICE_DOLLARS}
                        step="0.01"
                        inputMode="decimal"
                        value={startPrice}
                        onChange={(e) => setStartPrice(e.target.value)}
                        aria-invalid={!!priceErrors.start}
                        className={cn(
                          "w-[230px] text-right pr-1 border-border-control [&::-webkit-inner-spin-button]:ml-1.5 [&::-webkit-outer-spin-button]:ml-1.5",
                          priceErrors.start && "border-destructive"
                        )}
                        placeholder="10.00"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">USD/ticket</span>
                    </div>
                    {priceErrors.start && <p className="text-xs text-destructive">{priceErrors.start}</p>}
                  </div>

                  <div className="flex flex-wrap gap-10">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-ui font-semibold text-foreground">Cost/minute - first 60 minutes</span>
                        <InfoTooltip
                          label="About cost per minute for the first 60 minutes"
                          content="Per-minute rate for the first 60 minutes of support on a ticket."
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={MAX_PRICE_DOLLARS}
                          step="0.01"
                          inputMode="decimal"
                          value={costPerMinuteFirst60}
                          onChange={(e) => setCostPerMinuteFirst60(e.target.value)}
                          aria-invalid={!!priceErrors.first60}
                          className={cn(
                            "w-[230px] text-right pr-1 border-border-control [&::-webkit-inner-spin-button]:ml-1.5 [&::-webkit-outer-spin-button]:ml-1.5",
                            priceErrors.first60 && "border-destructive"
                          )}
                          placeholder="1.50"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">USD/minute</span>
                      </div>
                      {priceErrors.first60 && <p className="text-xs text-destructive">{priceErrors.first60}</p>}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-ui font-semibold text-foreground">Cost/minute - after 60 minutes</span>
                        <InfoTooltip
                          label="About cost per minute after 60 minutes"
                          content="Per-minute rate for support on a ticket after the first 60 minutes."
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={MAX_PRICE_DOLLARS}
                          step="0.01"
                          inputMode="decimal"
                          value={costPerMinuteAfter60}
                          onChange={(e) => setCostPerMinuteAfter60(e.target.value)}
                          aria-invalid={!!priceErrors.after60}
                          className={cn(
                            "w-[230px] text-right pr-1 border-border-control [&::-webkit-inner-spin-button]:ml-1.5 [&::-webkit-outer-spin-button]:ml-1.5",
                            priceErrors.after60 && "border-destructive"
                          )}
                          placeholder="1.00"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">USD/minute</span>
                      </div>
                      {priceErrors.after60 && <p className="text-xs text-destructive">{priceErrors.after60}</p>}
                    </div>
                  </div>

                  <div className="flex mt-6">
                    <Button
                      variant="lavender"
                      size="sm"
                      onClick={handleSaveUserSettings}
                      disabled={!hasUserChanges || !pricesValid || updatePaymentSettings.isPending || settingsLoading}
                    >
                      {updatePaymentSettings.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Spending caps Section (temporarily hidden — see SHOW_SPENDING_CAPS) */}
              {SHOW_SPENDING_CAPS && (
              <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">Spending caps</h2>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <Button
                    variant="lavender"
                    size="sm"
                    onClick={handleSaveCaps}
                    disabled={!orgId || !hasCapsChanges || updateCaps.isPending}
                  >
                    {updateCaps.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground mb-6">
                  Monthly limits enforced when employer-billed tickets are
                  authorized. Leave blank for no cap.
                </p>

                <div className="flex flex-wrap gap-10">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-ui font-semibold text-foreground">Org-wide monthly cap</span>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={orgMonthlyCap}
                        onChange={(e) => setOrgMonthlyCap(e.target.value)}
                        className={cn(
                          "w-[230px] text-right pr-1 border-border"
                        )}
                        placeholder="No cap"
                        disabled={!orgId}
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">USD/month</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-ui font-semibold text-foreground">Default per-user monthly cap</span>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={defaultUserCap}
                        onChange={(e) => setDefaultUserCap(e.target.value)}
                        className={cn(
                          "w-[230px] text-right pr-1 border-border"
                        )}
                        placeholder="No cap"
                        disabled={!orgId}
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">USD/user/month</span>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Set up payouts Section */}
              <div className="bg-card rounded-lg p-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">Set up payouts</h2>
                  <InfoTooltip
                    label="About setting up payouts"
                    content="Payouts are set up through Stripe. You will be sent to Stripe's own website to complete the set up."
                  />
                </div>

                <div className="mt-8 flex flex-col gap-10">
                  {/* GitHub → Stripe connection */}
                  <div className="flex items-center gap-1">
                    {/* Third-party brand colour (GitHub); kept on purpose, not a token. */}
                    <div className={`flex size-[42px] shrink-0 items-center justify-center bg-[#24292f] ${SQUIRCLE_RADIUS[42]}`}>
                      <Logo className="size-6 text-[#24292f]" variant="dark" />
                    </div>
                    <div className="flex items-center gap-1.5 px-0.5">
                      <span className="size-1 rounded-full bg-muted-foreground/40" />
                      <span className="size-1 rounded-full bg-muted-foreground/40" />
                      <span className="size-1 rounded-full bg-muted-foreground/40" />
                    </div>
                    {/* Third-party brand colour (Stripe); kept on purpose, not a token. */}
                    <div className={`flex size-[42px] shrink-0 items-center justify-center bg-[#635bff] ${SQUIRCLE_RADIUS[42]}`}>
                      <img
                        src="/images/stripe-svg.svg"
                        alt="Stripe"
                        className="size-[22px] object-contain"
                      />
                    </div>
                  </div>

                  <p className="max-w-[502px] text-sm leading-normal tracking-tight text-text-muted">
                    All payouts to the repository are processed with Stripe. Set up payouts, so you can receive any
                    payouts from support.
                  </p>

                  <div className="flex items-center gap-3">
                    <Button
                      className="w-fit px-5 py-2.5 text-ui font-medium bg-[#635bff] text-white hover:bg-[#5851e5]"
                      onClick={handleSetupPayouts}
                      disabled={!project?.organization_id || startConnect.isPending}
                    >
                      <Landmark className="w-4 h-4" />
                      {startConnect.isPending ? "Starting..." : "Set up payouts"}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Status: <span className="font-medium text-foreground">{orgStatusLabel}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// Small info icon with a tooltip. Controlled open state so it works on tap as
// well as on hover (mirrors the employer tooltip in top-bar.tsx).
function InfoTooltip({
  content,
  label = "More information",
  className,
}: {
  content: React.ReactNode
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={label}
            className="inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground"
            onClick={() => setOpen((v) => !v)}
          >
            <Info className="w-4 h-4 text-muted-foreground" />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            sideOffset={6}
            className={cn(
              "z-[60] max-w-xs rounded-md bg-foreground px-3 py-2 font-sans text-xs leading-relaxed text-white shadow-md",
              className
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-foreground" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
