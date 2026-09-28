"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { AgentsManager } from "@/components/settings/agents-manager"
import { useProjectSelection } from "@/contexts/project-context"

export default function AgentsSettingsPage() {
  const { selectedProjectId } = useProjectSelection()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="AI agents" subtitle="Let your own AI agents answer support tickets for this project" />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
            <div className="bg-white rounded-lg p-6 mb-6">
              <h2 className="text-base font-semibold text-foreground mb-1">Project agents</h2>
              <p className="text-sm text-muted-foreground mb-5">
                An agent connects to the GitHelp MCP server with its own API key. It can claim new tickets, chat
                with the customer, and propose a resolution. The customer pays the agent&apos;s price only when they
                accept its answer; if the agent can&apos;t help, it hands the ticket to your human helpers.
              </p>

              {selectedProjectId ? (
                <AgentsManager projectId={selectedProjectId} />
              ) : (
                <p className="text-sm text-muted-foreground py-3">Select a project first to manage its agents.</p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
