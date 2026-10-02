"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { isNotStaffError, useStaffOverview } from "@/hooks/useStaff"
import { OutreachQueue } from "@/components/staff/outreach-queue"
import { HelperApplications } from "@/components/staff/helper-applications"
import { UnclaimedProjects } from "@/components/staff/unclaimed-projects"
import { PlatformSettingsForm } from "@/components/staff/platform-settings-form"

type Tab = "outreach" | "applications" | "unclaimed" | "settings"

/** GitHelp staff console; everyone else sees "Staff only". */
export function StaffConsole() {
  const { data: overview, isLoading, error } = useStaffOverview()
  const [tab, setTab] = useState<Tab>("outreach")

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error) {
    return (
      <div className="bg-white rounded-lg p-6" data-testid="staff-denied">
        <h2 className="text-base font-semibold text-foreground">Staff only</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isNotStaffError(error)
            ? "This area is for GitHelp staff."
            : error instanceof Error ? error.message : "Could not check your access."}
        </p>
      </div>
    )
  }
  if (!overview) {
    return (
      <div className="bg-white rounded-lg p-6" data-testid="staff-denied">
        <h2 className="text-base font-semibold text-foreground">Staff only</h2>
        <p className="text-sm text-muted-foreground mt-1">This area is for GitHelp staff.</p>
      </div>
    )
  }

  const tabs: Array<[Tab, string]> = [
    ["outreach", `Outreach (${overview.pending_outreach})`],
    ["applications", `Helper applications (${overview.pending_applications})`],
    ["unclaimed", `Unclaimed projects (${overview.unclaimed_projects})`],
    ["settings", "Settings"],
  ]

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6" role="tablist">
        {tabs.map(([key, label]) => (
          <Button
            key={key}
            role="tab"
            aria-selected={tab === key}
            variant={tab === key ? "lavender" : "outline"}
            className="cursor-pointer"
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === "outreach" && <OutreachQueue />}
      {tab === "applications" && <HelperApplications />}
      {tab === "unclaimed" && <UnclaimedProjects />}
      {tab === "settings" && <PlatformSettingsForm />}
    </div>
  )
}
