"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import {
  PersonalNotificationSettings,
  type EmailGroupOption,
} from "@/components/settings/personal-notification-settings"

// Only the groups helpers actually receive email for. New-ticket alerts reach
// helpers in-app and via their delivery channels ("Tickets"), not by email.
const EMAIL_GROUPS: EmailGroupOption[] = [
  {
    key: "messages",
    label: "Chat messages",
    description: "New messages on tickets you've claimed (batched, ~5 min)",
  },
  {
    key: "payments",
    label: "Payouts",
    description: "Earnings transferred to you, failed payouts",
  },
]

export default function HelperNotificationsSettingsPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Notification preferences" subtitle="Manage how you want to be notified" />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
            <PersonalNotificationSettings emailGroups={EMAIL_GROUPS} />
          </div>
        </main>
      </div>
    </div>
  )
}
