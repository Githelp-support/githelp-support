"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Info, Landmark } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { useProject, useProjectPaymentSettings, useUpdateProjectPaymentSettings } from "@/hooks/useProject"
import { useStartPaymentConnect } from "@/hooks/usePaymentConnect"
import { usePaymentStatus } from "@/hooks/usePaymentStatus"
import { useOrgSpendingCaps, useUpdateOrgSpendingCaps } from "@/hooks/useOrgSpendingCaps"
import { connectStatusLabel } from "@/lib/payment-status"
import { formatCapDollars, parseCapDollars } from "@/lib/cap-format"
import { DistributionPreview } from "@/components/payment/distribution-preview"
import { useProjectSelection } from "@/contexts/project-context"
import { cn } from "@/lib/utils"

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
  const orgStatus = usePaymentStatus({ scope: "organization", scopeId: orgId })
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
    } catch (err) {
      console.error("Failed to save spending caps:", err)
    }
  }

  const handleSetupPayouts = async () => {
    if (!project?.organization_id) return
    try {
      const { url } = await startConnect.mutateAsync({
        organizationId: project.organization_id,
      })
      window.location.assign(url)
    } catch (err) {
      console.error("Failed to start Connect onboarding:", err)
    }
  }

  // Team sharing ratios (core_helper_percentage)
  const [teamMemberRatio, setTeamMemberRatio] = useState([50])
  const [teamProjectRatio, setTeamProjectRatio] = useState([50])

  // Community sharing ratios (community_helper_percentage)
  const [communityHelperRatio, setCommunityHelperRatio] = useState([85])
  const [communityProjectRatio, setCommunityProjectRatio] = useState([15])

  // External consultant settings (consultant_helper_percentage, extended_contract_type)
  const [contractType, setContractType] = useState<"ticket" | "outside">("ticket")
  const [consultantRatio, setConsultantRatio] = useState([70])
  const [consultantProjectRatio, setConsultantProjectRatio] = useState([30])

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
      const contractTypeValue = paymentSettings.extended_contract_type || "ticket"
      const ticketsEnabled = paymentSettings.tickets_enabled ?? false
      const slaEnabled = paymentSettings.sla_enabled ?? false

      // Convert cents to dollars for display (database stores in cents)
      const startPriceCents = paymentSettings.ticket_start_price ?? 1000
      const first60Cents = paymentSettings.ticket_price_minute_first_60 ?? 150
      const after60Cents = paymentSettings.ticket_price_minute_after_60 ?? 100

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

  // Check if user payment settings (ticket pricing) have changes
  const hasUserChanges = originalValues.ticket_start_price !== null && (
    Math.round(parseFloat(startPrice) * 100) !== originalValues.ticket_start_price ||
    Math.round(parseFloat(costPerMinuteFirst60) * 100) !== originalValues.ticket_price_minute_first_60 ||
    Math.round(parseFloat(costPerMinuteAfter60) * 100) !== originalValues.ticket_price_minute_after_60
  )

  // Check if user payment options (SLA / ticket enabled) have changes
  const hasUserOptionsChanges =
    originalValues.tickets_enabled !== null &&
    originalValues.sla_enabled !== null &&
    (paymentByTicket !== originalValues.tickets_enabled ||
      paymentBySLA !== originalValues.sla_enabled)

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
    } catch (error) {
      console.error("Failed to save team settings:", error)
    }
  }

  const handleSaveCommunitySettings = async () => {
    if (!projectId) return
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
    } catch (error) {
      console.error("Failed to save community settings:", error)
    }
  }

  const handleSaveConsultantSettings = async () => {
    if (!projectId) return
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
    } catch (error) {
      console.error("Failed to save consultant settings:", error)
    }
  }

  const handleSaveUserSettings = async () => {
    if (!projectId) return
    try {
      // Convert dollars to cents for database storage
      const startPriceCents = Math.round(parseFloat(startPrice) * 100)
      const first60Cents = Math.round(parseFloat(costPerMinuteFirst60) * 100)
      const after60Cents = Math.round(parseFloat(costPerMinuteAfter60) * 100)

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
    } catch (error) {
      console.error("Failed to save user settings:", error)
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
    } catch (error) {
      console.error("Failed to save user payment options:", error)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Payment Settings" subtitle="Manage rates and sharing ratios" info="This is a test info" />
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Tab Navigation */}
          <div className="mb-8">
            <div className="flex gap-1">

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
            <div className="h-px bg-border -mx-6"></div>
          </div>

          <div className="max-w-5xl">
            {activeTab === "helper" && (
              <div className="space-y-6">
                {/* Team Section */}
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex flex-col sm:flex-row gap-10">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-semibold text-foreground">Team</h2>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-muted-foreground border-border bg-transparent"
                          onClick={handleSaveTeamSettings}
                          disabled={!hasTeamChanges || updatePaymentSettings.isPending || settingsLoading}
                        >
                          {updatePaymentSettings.isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-[13px] font-semibold text-foreground">Sharing ratio</h3>

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
                                className="w-full [&_[data-slot='slider-thumb']]:border-[#554abf] [&_[data-slot='slider-thumb']]:bg-[#554abf] [&_[data-slot='slider-range']]:bg-[#554abf]"
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
                                className="w-full [&_[data-slot='slider-thumb']]:border-[#554abf] [&_[data-slot='slider-thumb']]:bg-[#554abf] [&_[data-slot='slider-range']]:bg-[#554abf]"
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
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex flex-col sm:flex-row gap-10">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-semibold text-foreground">Community</h2>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-muted-foreground border-border bg-transparent"
                          onClick={handleSaveCommunitySettings}
                          disabled={!hasCommunityChanges || updatePaymentSettings.isPending || settingsLoading}
                        >
                          {updatePaymentSettings.isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-[13px] font-semibold text-foreground">Sharing ratio</h3>

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
                                className="w-full [&_[data-slot='slider-thumb']]:border-[#554abf] [&_[data-slot='slider-thumb']]:bg-[#554abf] [&_[data-slot='slider-range']]:bg-[#554abf]"
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
                                className="w-full [&_[data-slot='slider-thumb']]:border-[#554abf] [&_[data-slot='slider-thumb']]:bg-[#554abf] [&_[data-slot='slider-range']]:bg-[#554abf]"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted rounded-md px-5 py-3 mt-4">
                          <p className="text-[13px] text-muted-foreground">Payment to community helper can&apos;t be below 85%</p>
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
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex flex-col sm:flex-row gap-10">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-semibold text-foreground">External Consultants and Companies</h2>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-muted-foreground border-border bg-transparent"
                          onClick={handleSaveConsultantSettings}
                          disabled={!hasConsultantChanges || updatePaymentSettings.isPending || settingsLoading}
                        >
                          {updatePaymentSettings.isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <h3 className="text-[13px] font-semibold text-foreground mb-4">Type of contract</h3>
                          <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="radio"
                                name="contractType"
                                value="ticket"
                                checked={contractType === "ticket"}
                                onChange={(e) => setContractType(e.target.value as "ticket")}
                                className="w-4 h-4 text-[#554abf] border-border focus:outline-none focus-visible:outline-none focus-visible:ring-0 cursor-pointer"
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
                                className="w-4 h-4 text-[#554abf] border-border focus:outline-none focus-visible:outline-none focus-visible:ring-0 cursor-pointer"
                              />
                              <span className="text-sm text-muted-foreground">Payment outside Githelp</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-[13px] font-semibold text-foreground mb-4">Sharing ratio</h3>
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
                                  className="w-full [&_[data-slot='slider-thumb']]:border-[#554abf] [&_[data-slot='slider-thumb']]:bg-[#554abf] [&_[data-slot='slider-range']]:bg-[#554abf]"
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
                                  className="w-full [&_[data-slot='slider-thumb']]:border-[#554abf] [&_[data-slot='slider-thumb']]:bg-[#554abf] [&_[data-slot='slider-range']]:bg-[#554abf]"
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
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">Payment options</h2>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-muted-foreground border-border bg-transparent"
                      onClick={handleSaveUserOptions}
                      disabled={!hasUserOptionsChanges || updatePaymentSettings.isPending || settingsLoading}
                    >
                      {updatePaymentSettings.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label
                        htmlFor="by-ticket"
                        className={cn(
                          "flex items-start gap-3 rounded-md border border-border p-4 cursor-pointer transition-colors hover:bg-muted/40",
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
                          "flex items-start gap-3 rounded-md border border-border p-4 cursor-pointer transition-colors hover:bg-muted/40",
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
                </div>

                {/* Ticket cost Section */}
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-base font-semibold text-foreground">Ticket cost</h2>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-muted-foreground border-border bg-transparent"
                      onClick={handleSaveUserSettings}
                      disabled={!hasUserChanges || updatePaymentSettings.isPending || settingsLoading}
                    >
                      {updatePaymentSettings.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-foreground">Start price</span>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={startPrice}
                          onChange={(e) => setStartPrice(e.target.value)}
                          className={cn(
                            "w-[230px] text-right pr-[3px] border-border [&::-webkit-inner-spin-button]:ml-[6px] [&::-webkit-outer-spin-button]:ml-[6px]"
                          )}
                          placeholder="10.00"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">USD/ticket</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-10">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-foreground">Cost/minute - first 60 minutes</span>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={costPerMinuteFirst60}
                            onChange={(e) => setCostPerMinuteFirst60(e.target.value)}
                            className={cn(
                              "w-[230px] text-right pr-[3px] border-border [&::-webkit-inner-spin-button]:ml-[6px] [&::-webkit-outer-spin-button]:ml-[6px]"
                            )}
                            placeholder="1.50"
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">USD/minute</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-foreground">Cost/minute - after 60 minutes</span>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={costPerMinuteAfter60}
                            onChange={(e) => setCostPerMinuteAfter60(e.target.value)}
                            className={cn(
                              "w-[230px] text-right pr-[3px] border-border [&::-webkit-inner-spin-button]:ml-[6px] [&::-webkit-outer-spin-button]:ml-[6px]"
                            )}
                            placeholder="1.00"
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">USD/minute</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Spending caps Section */}
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">Spending caps</h2>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-muted-foreground border-border bg-transparent"
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
                        <span className="text-[13px] font-semibold text-foreground">Org-wide monthly cap</span>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={orgMonthlyCap}
                          onChange={(e) => setOrgMonthlyCap(e.target.value)}
                          className={cn(
                            "w-[230px] text-right pr-[3px] border-border"
                          )}
                          placeholder="No cap"
                          disabled={!orgId}
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">USD/month</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-foreground">Default per-user monthly cap</span>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={defaultUserCap}
                          onChange={(e) => setDefaultUserCap(e.target.value)}
                          className={cn(
                            "w-[230px] text-right pr-[3px] border-border"
                          )}
                          placeholder="No cap"
                          disabled={!orgId}
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">USD/user/month</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Set up payouts Section */}
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">Set up payouts</h2>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </div>

                  <div className="mt-8 flex flex-col gap-10">
                    {/* GitHub → Stripe connection */}
                    <div className="flex items-center gap-1">
                      <div className="flex size-[42px] shrink-0 items-center justify-center bg-[#24292f] rounded-[14px]">
                        <Logo className="size-6 text-[#24292f]" variant="dark" />
                      </div>
                      <div className="flex items-center gap-1.5 px-0.5">
                        <span className="size-1 rounded-full bg-muted-foreground/40" />
                        <span className="size-1 rounded-full bg-muted-foreground/40" />
                        <span className="size-1 rounded-full bg-muted-foreground/40" />
                      </div>
                      <div className="flex size-[42px] shrink-0 items-center justify-center bg-[#635bff] rounded-[14px]">
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
                        className="w-fit px-5 py-2.5 text-[13px] font-medium bg-[#635bff] text-white hover:bg-[#5851e5]"
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
    </div>
  )
}
