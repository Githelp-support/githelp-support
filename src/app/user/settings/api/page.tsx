"use client"

import Link from "next/link"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { ApiKeysManager, CopyBlock, McpInstallButtons } from "@/components/settings/api-keys-manager"
import { ConnectedApps } from "@/components/settings/connected-apps"
import { mcpInstallLinks } from "@/hooks/useApiAccess"

export default function ApiSettingsPage() {
  const links = mcpInstallLinks()

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
                <li>Charges above your auto-approve amount always need your own approval in GitHelp.</li>
              </ul>
              <p className="text-sm">
                <Link href="/docs/mcp" className="underline text-foreground">
                  Read the guide
                </Link>{" "}
                <span className="text-muted-foreground">for the full flow, tools and webhooks.</span>
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 mb-6">
              <h2 className="text-base font-semibold text-foreground mb-1">Connect without a key (recommended)</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Add the server, then sign in to GitHelp when your assistant asks. You approve the connection once
                on a GitHelp page; no key to copy or rotate.
              </p>
              <div className="space-y-3">
                <CopyBlock label="Claude Code — then run /mcp and choose githelp to sign in" value={links.claudeCode} />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">One-click install</p>
                  <McpInstallButtons />
                </div>
                <CopyBlock label="Server URL (any MCP client with sign-in support)" value={links.url} />
              </div>
              <h3 className="text-sm font-semibold text-foreground mt-6 mb-1">Connected apps</h3>
              <ConnectedApps />
            </div>

            <div className="bg-white rounded-lg p-6 mb-6">
              <h2 className="text-base font-semibold text-foreground mb-1">API keys</h2>
              <p className="text-sm text-muted-foreground mb-5">
                For clients without sign-in support, CI jobs or scripts. Each key acts as you — create one per
                tool or machine, and revoke it when you stop using it.
              </p>
              <ApiKeysManager />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
