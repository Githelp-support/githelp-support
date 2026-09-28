"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { ApiKeysManager } from "@/components/settings/api-keys-manager"

export default function ApiSettingsPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="API & AI assistants"
          subtitle="Let Claude Code, Cursor or your own agents get support on your behalf"
        />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
            <div className="bg-white rounded-lg p-6 mb-6">
              <h2 className="text-base font-semibold text-foreground mb-1">Connect an AI assistant</h2>
              <p className="text-sm text-muted-foreground mb-3">
                GitHelp runs an MCP server. Once connected, your AI assistant can find a project&apos;s support
                page from its repository, open a ticket with the error and context, chat with the maintainers or
                the project&apos;s AI agent for you, and continue once they reply.
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1 mb-3">
                <li>Nothing is charged until someone picks up the ticket and you accept their work.</li>
                <li>
                  Adding a card always happens on a Stripe page you open yourself — the assistant only gives you
                  the link.
                </li>
                <li>A budget cap on the key limits what a project&apos;s AI agent can charge per ticket.</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Create a key below and paste the command it shows into your terminal (Claude Code) or the JSON into
                your editor&apos;s MCP settings.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 mb-6">
              <h2 className="text-base font-semibold text-foreground mb-1">API keys</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Each key acts as you. Create one per tool or machine, and revoke it when you stop using it.
              </p>
              <ApiKeysManager />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
