"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

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

export default function UserNotificationsSettingsPage() {
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

  const [isSavingNotifications, setIsSavingNotifications] = useState(false)

  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true)
    // TODO: Persist notification settings to backend
    await new Promise((resolve) => setTimeout(resolve, 500)) // simulate async
    setIsSavingNotifications(false)
  }

  const toggleNotification = (key: keyof NotificationSettings) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Notification preferences" subtitle="Manage how you want to be notified" />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
            {/* Notification preferences */}
            <div className="bg-white rounded-lg border border-border p-6 mb-6">
              <h2 className="text-base font-semibold text-foreground mb-1">
                Channels
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                Choose how you want to be notified about replies
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
