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

// TODO: Replace local state with backend-persisted settings once a helper_settings
// table (or equivalent) exists in the database schema.

interface NotificationSettings {
  emailNewTickets: boolean
  emailAssignments: boolean
  emailMentions: boolean
  slackNewTickets: boolean
  slackAssignments: boolean
  slackMentions: boolean
  discordNewTickets: boolean
  discordAssignments: boolean
  discordMentions: boolean
}

interface AvailabilitySettings {
  available: boolean
  workingHoursEnabled: boolean
  workingHoursStart: string
  workingHoursEnd: string
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
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailNewTickets: true,
    emailAssignments: true,
    emailMentions: true,
    slackNewTickets: false,
    slackAssignments: false,
    slackMentions: false,
    discordNewTickets: false,
    discordAssignments: false,
    discordMentions: false,
  })

  // TODO: Load from backend
  const [availability, setAvailability] = useState<AvailabilitySettings>({
    available: true,
    workingHoursEnabled: false,
    workingHoursStart: "09:00",
    workingHoursEnd: "17:00",
  })

  const [isSavingAvailability, setIsSavingAvailability] = useState(false)
  const [isSavingNotifications, setIsSavingNotifications] = useState(false)

  const handleSaveAvailability = async () => {
    setIsSavingAvailability(true)
    // TODO: Persist availability settings to backend
    await new Promise((resolve) => setTimeout(resolve, 500)) // simulate async
    setIsSavingAvailability(false)
  }

  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true)
    // TODO: Persist notification settings to backend
    await new Promise((resolve) => setTimeout(resolve, 500)) // simulate async
    setIsSavingNotifications(false)
  }

  const toggleNotification = (key: keyof NotificationSettings) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))
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
            <p className="text-muted-foreground">You are not registered as a helper in this project.</p>
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
        <Header title="Settings" subtitle="Manage your notification and availability preferences" />

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
              onClick={handleSaveAvailability}
              disabled={isSavingAvailability}
              variant="outline"
              className="border-[rgba(0,0,0,0.1)] mt-[22px]"
            >
              {isSavingAvailability ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save availability"
              )}
            </Button>
          </div>

          {/* Notification preferences */}
          <div className="bg-white rounded-lg border border-border p-6 mb-6">
            <h2 className="text-base font-semibold text-foreground mb-1">
              Notification preferences
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Choose how you want to be notified about activity.
            </p>

            {/* Email */}
            <div className="mb-5">
              <h3 className="text-[13px] font-semibold text-foreground mb-3">
                Email
              </h3>
              <div className="space-y-0 divide-y divide-gray-100">
                <div className="flex items-center justify-between py-3">
                  <Label htmlFor="email-new-tickets" className="text-sm text-[#737373] cursor-pointer pl-1.5">
                    New tickets
                  </Label>
                  <Switch
                    id="email-new-tickets"
                    checked={notifications.emailNewTickets}
                    onCheckedChange={() => toggleNotification("emailNewTickets")}
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <Label htmlFor="email-assignments" className="text-sm text-[#737373] cursor-pointer pl-1.5">
                    Ticket assignments
                  </Label>
                  <Switch
                    id="email-assignments"
                    checked={notifications.emailAssignments}
                    onCheckedChange={() => toggleNotification("emailAssignments")}
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <Label htmlFor="email-mentions" className="text-sm text-[#737373] cursor-pointer pl-1.5">
                    Mentions
                  </Label>
                  <Switch
                    id="email-mentions"
                    checked={notifications.emailMentions}
                    onCheckedChange={() => toggleNotification("emailMentions")}
                  />
                </div>
              </div>
            </div>

            {/* Slack */}
            <div className="mb-5">
              <h3 className="text-[13px] font-semibold text-foreground mb-3">
                Slack
              </h3>
              <div className="space-y-0 divide-y divide-gray-100">
                <div className="flex items-center justify-between py-3">
                  <Label htmlFor="slack-new-tickets" className="text-sm text-[#737373] cursor-pointer pl-1.5">
                    New tickets
                  </Label>
                  <Switch
                    id="slack-new-tickets"
                    checked={notifications.slackNewTickets}
                    onCheckedChange={() => toggleNotification("slackNewTickets")}
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <Label htmlFor="slack-assignments" className="text-sm text-[#737373] cursor-pointer pl-1.5">
                    Ticket assignments
                  </Label>
                  <Switch
                    id="slack-assignments"
                    checked={notifications.slackAssignments}
                    onCheckedChange={() => toggleNotification("slackAssignments")}
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <Label htmlFor="slack-mentions" className="text-sm text-[#737373] cursor-pointer pl-1.5">
                    Mentions
                  </Label>
                  <Switch
                    id="slack-mentions"
                    checked={notifications.slackMentions}
                    onCheckedChange={() => toggleNotification("slackMentions")}
                  />
                </div>
              </div>
            </div>

            {/* Discord */}
            <div>
              <h3 className="text-[13px] font-semibold text-foreground mb-3">
                Discord
              </h3>
              <div className="space-y-0 divide-y divide-gray-100">
                <div className="flex items-center justify-between py-3">
                  <Label htmlFor="discord-new-tickets" className="text-sm text-[#737373] cursor-pointer pl-1.5">
                    New tickets
                  </Label>
                  <Switch
                    id="discord-new-tickets"
                    checked={notifications.discordNewTickets}
                    onCheckedChange={() => toggleNotification("discordNewTickets")}
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <Label htmlFor="discord-assignments" className="text-sm text-[#737373] cursor-pointer pl-1.5">
                    Ticket assignments
                  </Label>
                  <Switch
                    id="discord-assignments"
                    checked={notifications.discordAssignments}
                    onCheckedChange={() => toggleNotification("discordAssignments")}
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <Label htmlFor="discord-mentions" className="text-sm text-[#737373] cursor-pointer pl-1.5">
                    Mentions
                  </Label>
                  <Switch
                    id="discord-mentions"
                    checked={notifications.discordMentions}
                    onCheckedChange={() => toggleNotification("discordMentions")}
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleSaveNotifications}
              disabled={isSavingNotifications}
              variant="outline"
              className="border-border mt-[22px]"
            >
              {isSavingNotifications ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save preferences"
              )}
            </Button>
          </div>
          </div>
        </main>
      </div>
    </div>
  )
}
