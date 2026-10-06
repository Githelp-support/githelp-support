"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { NotificationChannelsManager } from "@/components/settings/notification-channels-manager"
import { useUnsavedChangesGuard } from "@/contexts/unsaved-changes-context"
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
  type PreferenceEventGroup,
} from "@/hooks/useNotificationPreferences"

export interface EmailGroupOption {
  key: PreferenceEventGroup
  label: string
  description: string
}

interface PersonalNotificationSettingsProps {
  /** Role-specific copy for the email toggles (users and helpers get different events per group). */
  emailGroups: EmailGroupOption[]
}

type EmailToggles = Record<PreferenceEventGroup, boolean>

const DEFAULT_EMAIL_TOGGLES: EmailToggles = {
  tickets: true,
  messages: true,
  payments: true,
  membership: true,
  digest: true,
}

export function PersonalNotificationSettings({ emailGroups }: PersonalNotificationSettingsProps) {
  const { data: preferences, isLoading } = useNotificationPreferences()
  const savePreferences = useSaveNotificationPreferences()

  const [emailToggles, setEmailToggles] = useState<EmailToggles>(DEFAULT_EMAIL_TOGGLES)
  // Snapshot of the last saved/hydrated toggles, used to detect unsaved edits.
  const [savedToggles, setSavedToggles] = useState<EmailToggles>(DEFAULT_EMAIL_TOGGLES)
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
    setSavedToggles(next)
  }, [preferences])

  const isDirty = emailGroups.some((group) => emailToggles[group.key] !== savedToggles[group.key])
  useUnsavedChangesGuard(isDirty)

  const handleSave = async () => {
    try {
      await savePreferences.mutateAsync(
        emailGroups.map((group) => ({
          channel: "email" as const,
          event_group: group.key,
          enabled: emailToggles[group.key],
        })),
      )
      setSavedToggles(emailToggles)
      toast.success("Notification preferences saved")
    } catch {
      toast.error("Could not save preferences — please try again")
    }
  }

  const toggleEmail = (key: PreferenceEventGroup) => {
    setEmailToggles((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
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
          {emailGroups.map((group) => (
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
        variant="lavender"
        className="mt-[22px]"
      >
        {savePreferences.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          "Save preferences"
        )}
      </Button>
    </div>
  )
}
