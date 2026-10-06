"use client"

import { useState } from "react"
import { Loader2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useProjectSelection } from "@/contexts/project-context"
import { ILLUSTRATIVE_BUTTON_TOOLTIP } from "@/lib/constants"
import { useUnsavedChangesGuard } from "@/contexts/unsaved-changes-context"

// TODO: Replace local state with backend-persisted settings once a helper_settings
// table (or equivalent) exists in the database schema.

interface AvailabilitySettings {
  available: boolean
  workingHoursEnabled: boolean
  workingHoursStart: string
  workingHoursEnd: string
}

const DEFAULT_AVAILABILITY: AvailabilitySettings = {
  available: true,
  workingHoursEnabled: false,
  workingHoursStart: "09:00",
  workingHoursEnd: "17:00",
}

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, "0")
  return { value: `${h}:00`, label: `${h}:00` }
})

export default function HelperSettingsPage() {
  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  const { data: helperId, isLoading: currentHelperLoading } = useCurrentHelper(projectId)

  // TODO: Load from backend
  const [availability, setAvailability] = useState<AvailabilitySettings>(DEFAULT_AVAILABILITY)
  // Snapshot of the last-saved settings, used to detect unsaved changes
  const [savedAvailability, setSavedAvailability] = useState<AvailabilitySettings>(DEFAULT_AVAILABILITY)

  const [isSavingAvailability, setIsSavingAvailability] = useState(false)

  // Warn before navigating away while availability differs from the last-saved snapshot
  const isDirty =
    availability.available !== savedAvailability.available ||
    availability.workingHoursEnabled !== savedAvailability.workingHoursEnabled ||
    availability.workingHoursStart !== savedAvailability.workingHoursStart ||
    availability.workingHoursEnd !== savedAvailability.workingHoursEnd
  useUnsavedChangesGuard(isDirty)

  const handleSaveAvailability = async () => {
    setIsSavingAvailability(true)
    // TODO: Persist availability settings to backend
    await new Promise((resolve) => setTimeout(resolve, 500)) // simulate async
    setSavedAvailability(availability)
    setIsSavingAvailability(false)
  }

  const isLoading = !projectId || currentHelperLoading

  if (!projectId) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Settings" subtitle="Helper settings" />
          <main className="flex-1 overflow-auto p-6">
            <p className="text-muted-foreground">Select a project to view your settings.</p>
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
          <Header title="Settings" subtitle="Helper settings" />
          <main className="flex-1 overflow-auto p-6">
            <p className="text-sm text-left pl-2 text-muted-foreground">You are not registered as a helper in this project.</p>
          </main>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Settings" subtitle="Helper settings" />
          <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Settings" subtitle="Manage your availability" />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
          {/* Availability */}
          <div className="bg-white rounded-lg p-6 mb-6">
            <h2 className="text-base font-semibold text-foreground mb-1">
              Availability
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Control whether you can be assigned new tickets.
            </p>

            <div className="flex items-center justify-between py-3 border-b border-[rgba(0,0,0,0.06)]">
              <div>
                <Label htmlFor="available" className="text-sm font-medium text-foreground">
                  Available for new tickets
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When off, new tickets will not be assigned to you.
                </p>
              </div>
              <Switch
                id="available"
                checked={availability.available}
                onCheckedChange={(checked) =>
                  setAvailability((prev) => ({ ...prev, available: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-[rgba(0,0,0,0.06)]">
              <div>
                <Label htmlFor="working-hours-enabled" className="text-sm font-medium text-foreground">
                  Set working hours
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Optionally restrict availability to a time window.
                </p>
              </div>
              <Switch
                id="working-hours-enabled"
                checked={availability.workingHoursEnabled}
                onCheckedChange={(checked) =>
                  setAvailability((prev) => ({ ...prev, workingHoursEnabled: checked }))
                }
              />
            </div>

            {availability.workingHoursEnabled && (
              <div className="pt-4 flex items-center gap-4 flex-wrap">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-muted-foreground w-10">From</Label>
                  <Select
                    value={availability.workingHoursStart}
                    onValueChange={(v) =>
                      setAvailability((prev) => ({ ...prev, workingHoursStart: v }))
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h.value} value={h.value}>
                          {h.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-muted-foreground w-10">To</Label>
                  <Select
                    value={availability.workingHoursEnd}
                    onValueChange={(v) =>
                      setAvailability((prev) => ({ ...prev, workingHoursEnd: v }))
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h.value} value={h.value}>
                          {h.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Button
              title={ILLUSTRATIVE_BUTTON_TOOLTIP}
              onClick={handleSaveAvailability}
              disabled={isSavingAvailability}
              variant="lavender"
              className="mt-[22px]"
            >
              {isSavingAvailability ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save availability"
              )}
            </Button>
          </div>
          </div>
        </main>
      </div>
    </div>
  )
}
