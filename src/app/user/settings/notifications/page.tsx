"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import {
  PersonalNotificationSettings,
  type EmailGroupOption,
} from "@/components/settings/personal-notification-settings"

const EMAIL_GROUPS: EmailGroupOption[] = [
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

export default function UserNotificationsSettingsPage() {
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
