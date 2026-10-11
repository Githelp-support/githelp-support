"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { NotificationChannelsManager } from "@/components/settings/notification-channels-manager"
import { useProjectSelection } from "@/contexts/project-context"

export default function IntegrationsSettingsPage() {
  const { selectedProjectId } = useProjectSelection()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Integrations"
          subtitle="Send this project's activity to Slack, Discord, or your own systems"
        />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
            <div className="bg-white rounded-lg p-6 mb-6">
              <h2 className="text-base font-semibold text-foreground mb-1">
                Delivery channels
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                Notifications about this project (new tickets, payments, membership changes) are
                posted to every enabled channel. Paste a Slack incoming-webhook URL, a Discord
                channel-webhook URL, or connect any system with a signed custom webhook.
              </p>

              {selectedProjectId ? (
                <NotificationChannelsManager scope="project" projectId={selectedProjectId} />
              ) : (
                <p className="text-sm text-muted-foreground py-3">
                  Select a project first to manage its channels.
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
