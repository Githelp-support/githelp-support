import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { GithelpFunctionError } from "@/hooks/useUnlisted"

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))

let overviewState: { data?: unknown; isLoading: boolean; error: unknown } = { isLoading: true, error: null }
vi.mock("@/hooks/useStaff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useStaff")>()
  return { ...actual, useStaffOverview: () => overviewState }
})
vi.mock("@/components/staff/outreach-queue", () => ({ OutreachQueue: () => <div>outreach-queue</div> }))
vi.mock("@/components/staff/helper-applications", () => ({ HelperApplications: () => <div>applications</div> }))
vi.mock("@/components/staff/unclaimed-projects", () => ({ UnclaimedProjects: () => <div>unclaimed</div> }))
vi.mock("@/components/staff/platform-settings-form", () => ({ PlatformSettingsForm: () => <div>settings</div> }))

import { StaffConsole } from "./staff-console"
import { isNotStaffError } from "@/hooks/useStaff"

describe("StaffConsole", () => {
  it("shows 'Staff only' when the server says the user isn't staff", () => {
    overviewState = { isLoading: false, error: new GithelpFunctionError("Forbidden", "not_staff", 403) }
    render(<StaffConsole />)
    expect(screen.getByTestId("staff-denied").textContent).toContain("This area is for GitHelp staff.")
  })

  it("shows 'Staff only' for a cached not-staff answer (null overview)", () => {
    overviewState = { isLoading: false, error: null, data: null }
    render(<StaffConsole />)
    expect(screen.getByTestId("staff-denied").textContent).toContain("This area is for GitHelp staff.")
  })

  it("shows the queues with their counts for staff", () => {
    overviewState = { isLoading: false, error: null, data: { pending_outreach: 2, pending_applications: 5, unclaimed_projects: 7 } }
    render(<StaffConsole />)
    expect(screen.getByRole("tab", { name: "Outreach (2)" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Helper applications (5)" })).toBeTruthy()
    expect(screen.getByText("outreach-queue")).toBeTruthy()
  })

  it("recognises not-staff errors by code or status", () => {
    expect(isNotStaffError(new GithelpFunctionError("x", "not_staff", null))).toBe(true)
    expect(isNotStaffError(new GithelpFunctionError("x", null, 403))).toBe(true)
    expect(isNotStaffError(new Error("network"))).toBe(false)
  })
})
