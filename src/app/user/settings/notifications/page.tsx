"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { NotificationChannelsManager } from "@/components/settings/notification-channels-manager"
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
  type PreferenceEventGroup,
} from "@/hooks/useNotificationPreferences"

const EMAIL_GROUPS: Array<{ key: PreferenceEventGroup; label: string; description: string }> = [
  {
    key: "tickets",
    label: "Ticket activity",
    description: "Your ticket is claimed or completed",
  },
  {
    key: "messages",
    label: "Chat messages",
    description: "New messages while you're away (batched, ~5 min)",
  },
  {
    key: "payments",
    label: "Payments & payouts",
    description: "Payouts to you, failed payments, SLA billing",
  },
  {
    key: "membership",
    label: "Membership & invites",
    description: "Invites you sent are accepted, helper requests",
  },
]

type EmailToggles = Record<PreferenceEventGroup, boolean>

const DEFAULT_EMAIL_TOGGLES: EmailToggles = {
  tickets: true,
  messages: true,
  payments: true,
  membership: true,
  digest: true,
}

export default function UserNotificationsSettingsPage() {
  const { data: preferences, isLoading } = useNotificationPreferences()
  const savePreferences = useSaveNotificationPreferences()

  const [emailToggles, setEmailToggles] = useState<EmailToggles>(DEFAULT_EMAIL_TOGGLES)
  const hydratedRef = useRef(false)

  // Hydrate from saved global overrides ONCE (no row = default on). Later
  // background refetches must not clobber unsaved local edits.
  useEffect(() => {
    if (!preferences || hydratedRef.current) return
    hydratedRef.current = true
    const next = { ...DEFAULT_EMAIL_TOGGLES }
    for (const pref of preferences) {
      if (pref.channel === "email" && pref.project_id === null && pref.event_group in next) {
        next[pref.event_group] = pref.enabled
      }
    }
    setEmailToggles(next)
  }, [preferences])

  const handleSave = async () => {
    try {
      await savePreferences.mutateAsync(
        EMAIL_GROUPS.map((group) => ({
          channel: "email" as const,
          event_group: group.key,
          enabled: emailToggles[group.key],
        })),
      )
      toast.success("Notification preferences saved")
    } catch {
      toast.error("Could not save preferences — please try again")
    }
  }

  const toggleEmail = (key: PreferenceEventGroup) => {
    setEmailToggles((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Notification preferences" subtitle="Manage how you want to be notified" />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
            <div className="bg-white rounded-lg p-6 mb-6">
              <h2 className="text-base font-semibold text-foreground mb-1">
                Channels
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                Choose how you want to be notified. In-app notifications (the bell) are always on.
              </p>

              {/* Email */}
              <div className="mb-5">
                <h3 className="text-[13px] font-semibold text-foreground mb-3">
                  Email
                </h3>
                <div className="space-y-0 divide-y divide-[rgba(0,0,0,0.06)]">
                  {EMAIL_GROUPS.map((group) => (
                    <div key={group.key} className="flex items-center justify-between py-3">
                      <div className="pl-1.5">
                        <Label
                          htmlFor={`email-${group.key}`}
                          className="text-sm text-[#737373] cursor-pointer"
                        >
                          {group.label}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
                      </div>
                      <Switch
                        id={`email-${group.key}`}
                        checked={emailToggles[group.key]}
                        disabled={isLoading}
                        onCheckedChange={() => toggleEmail(group.key)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Personal delivery destinations (Slack / Discord / custom webhook) */}
              <div className="mb-5">
                <h3 className="text-[13px] font-semibold text-foreground mb-1">
                  My delivery channels
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Route your notifications to Slack, Discord, or any system of yours via a signed
                  webhook. Each channel picks which notification types it receives.
                </p>
                <NotificationChannelsManager scope="user" />
              </div>

              <Button
                onClick={handleSave}
                disabled={savePreferences.isPending || isLoading}
                variant="outline"
                className="border-[rgba(0,0,0,0.1)] mt-[22px]"
              >
                {savePreferences.isPending ? (
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
