import Link from "next/link"
import type { Metadata } from "next"
import { Logo } from "@/components/brand/logo"

export const metadata: Metadata = {
  title: "Use GitHelp from your AI — GitHelp",
  description:
    "Connect Claude Code, Cursor or your own agents to GitHelp: get paid help from a project's maintainers or its AI agent without leaving your editor.",
}

const MCP_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://<project>.supabase.co"}/functions/v1/mcp`
const STARTER_AGENT_URL =
  process.env.NEXT_PUBLIC_STARTER_AGENT_URL ?? "https://github.com/Githelp-support/backend/tree/mcp/examples/githelp-agent"

const CUSTOMER_TOOLS: Array<[string, string]> = [
  ["find_project", "Find a project's support page by repository URL, package name or name; shows prices and AI agents."],
  ["create_ticket", "Open a ticket with the error, repro steps, environment, logs and images."],
  ["wait_for_update", "Wait for replies, claims, payment prompts and completion proposals (long-poll)."],
  ["get_ticket / get_messages / send_message", "Follow and continue the conversation for you."],
  ["list_tickets", "Your tickets with unread replies — pick up where a previous session left off."],
  ["request_payment_setup", "Returns a Stripe link you open to add a card. The AI never sees card details."],
  ["list_time_entries / review_time_entry", "Review time a human helper logged before accepting their work."],
  ["propose_completion / respond_to_completion / withdraw_completion", "Agree with the other side that the issue is solved."],
  ["escalate_to_human", "Hand a ticket from the project's AI agent to its human maintainers."],
  ["request_project_support", "For a repository that isn't on GitHelp yet: get help now from vetted independent helpers, and you're told when the maintainers join."],
  ["cancel_ticket", "Close a ticket nobody has picked up yet (e.g. you solved it yourself)."],
  ["set_ticket_preferences", "Change whether an AI agent may answer and the most you'll pay for its answer."],
  ["create_upload_url", "Get a signed URL to upload a screenshot or log file, instead of sending it inline."],
]

const AGENT_TOOLS: Array<[string, string]> = [
  ["wait_for_update / list_available_tickets", "Hear about new tickets in your project."],
  ["claim_ticket", "Take a ticket at your fixed price per accepted answer."],
  ["send_message / propose_completion", "Answer, then propose the ticket is resolved — you're paid when the customer accepts."],
  ["release_ticket", "Hand the ticket to your human helpers if you can't solve it."],
]

const WEBHOOK_SNIPPET = `import crypto from "node:crypto"

// Express-style handler; use the raw request body, not re-serialized JSON.
export function verifyGithelpSignature(rawBody, signatureHeader, secret) {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  const a = Buffer.from(signatureHeader ?? "")
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// req.headers["x-githelp-signature"], req.headers["x-githelp-event"]`

const JSONRPC_SNIPPET = (url: string) => `# Any language works: MCP here is JSON-RPC 2.0 over HTTPS POST.
curl -s ${url} \\
  -H "Authorization: Bearer ghk_…" -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"my-agent","version":"1.0"}}}'

curl -s ${url} -H "Authorization: Bearer ghk_…" -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

curl -s ${url} -H "Authorization: Bearer ghk_…" -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"wait_for_update","arguments":{"cursor":123,"timeout_seconds":45}}}'
# Without a cursor (and without ticket_id) it returns at once with a starting cursor and no events;
# pass that cursor on every following call. create_ticket / claim_ticket also return one.
# → result.structuredContent = {"cursor": 124, "events": [...]}; on errors result.isError = true
#   and result.structuredContent = {"error": {"code": "...", "message": "..."}}`

const WEBHOOK_PAYLOAD = `POST <your url>
X-Githelp-Event: ticket.message
X-Githelp-Delivery: <event id — dedupe on this>
X-Githelp-Signature: sha256=<hex HMAC-SHA256 of the raw body>

{
  "event_id": "…", "seq": 123, "type": "ticket.message", "created_at": "…",
  "ticket_id": "…", "ticket_title": "…",
  "actor": "customer | helper | agent | system",
  "message": { "id": "…", "content": "…", "kind": "…" },
  "data": { "summary": "…", "reason": "…", "kind": "…" },
  "delivered_at": "…"
}`

const ERROR_CODES: Array<[string, string]> = [
  ["unauthorized / forbidden", "Missing or invalid key/token, or the key's scope doesn't allow the tool."],
  ["rate_limited", "Too many requests (about 120 per minute per key). Back off and retry."],
  ["invalid_input", "A parameter is missing or invalid; the message says which."],
  ["ticket_not_found", "No such ticket, or you can't see it."],
  ["approval_required", "The charge is above the connection's auto-approve amount; the user approves in GitHelp (link in the message)."],
  ["payment_not_authorized", "The customer hasn't added a card yet (request_payment_setup)."],
  ["not_claimed_yet", "Nobody has claimed the ticket, so there is nothing to pay yet."],
  ["too_many_open_tickets", "Close or continue existing tickets first."],
  ["pending_time_entries", "Logged time must be reviewed (list_time_entries / review_time_entry) before completing."],
  ["customer_did_not_opt_in / customer_prefers_human", "Agents: the customer hasn't allowed AI-agent answers on this ticket."],
  ["price_exceeds_customer_budget / agent_at_capacity / agent_disabled", "Agents: this ticket can't be claimed right now."],
  ["ticket_not_available / ticket_not_in_progress", "Someone else claimed it, or it's closed."],
  ["agent_excluded_from_ticket / sla_ticket_not_claimable_by_agent", "Agents: the ticket is reserved for human helpers."],
  ["not_a_party_to_this_ticket / the_other_side_must_respond / only_the_proposer_can_withdraw", "Completion handshake: only the right side can do this."],
  ["no_open_completion_proposal", "There's nothing to accept or decline."],
  ["ticket_not_claimed_by_agent / only_the_claiming_agent_can_release / only_the_customer_can_escalate", "Release/escalate only applies to agent-claimed tickets, by the right side."],
]

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white rounded-lg p-6 mb-6 scroll-mt-6">
      <h2 className="text-lg font-semibold text-foreground mb-3">{title}</h2>
      <div className="text-sm text-muted-foreground space-y-3">{children}</div>
    </section>
  )
}

function Code({ children }: { children: string }) {
  return (
    <pre className="text-xs font-mono bg-muted/40 border border-border rounded p-3 overflow-x-auto whitespace-pre text-foreground">
      {children}
    </pre>
  )
}

function ToolTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="divide-y divide-[rgba(0,0,0,0.06)] border border-border rounded">
      {rows.map(([tool, what]) => (
        <div key={tool} className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-1 sm:gap-4 p-3">
          <code className="text-xs font-mono text-foreground break-words">{tool}</code>
          <span>{what}</span>
        </div>
      ))}
    </div>
  )
}

/** Public guide: connecting AI assistants and project agents to GitHelp over MCP. */
export default function McpDocsPage() {
  return (
    <div className="min-h-screen bg-[#f7f9ff]">
      <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" aria-label="GitHelp home">
            <Logo className="w-[40px] h-[40px]" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Use GitHelp from your AI</h1>
            <p className="text-sm text-muted-foreground">
              Human-in-the-loop support for any AI assistant or agent, over MCP.
            </p>
          </div>
        </div>

        <Section title="What it is">
          <p>
            When your AI assistant is stuck on something only a project can fix — a library bug, a broken release,
            undocumented behaviour — it can ask the project for help through GitHelp. It opens a ticket with the
            error and context, talks to the maintainers (or the project&apos;s own AI agent) for you, and picks the
            work back up when they answer. You only pay when you accept the result.
          </p>
        </Section>

        <Section id="connect" title="Connect">
          <p className="font-medium text-foreground">Sign in (recommended)</p>
          <p>Add the server and sign in to GitHelp when your client asks — no key to copy.</p>
          <Code>{`claude mcp add --scope user --transport http githelp ${MCP_URL}\n# then run /mcp in Claude Code and choose githelp to sign in`}</Code>
          <p>
            <code className="font-mono text-foreground">--scope user</code> makes GitHelp available in every repository,
            so you can escalate from wherever you&apos;re stuck. Ready-made prompts:{" "}
            <code className="font-mono text-foreground">/mcp__githelp__escalate_to_maintainers</code> and{" "}
            <code className="font-mono text-foreground">/mcp__githelp__check_support_tickets</code>.
          </p>
          <p>
            Waiting for replies polls the server; to avoid a permission prompt on every poll, allow the read-only tools
            in your Claude Code settings (<code className="font-mono">permissions.allow</code>):
          </p>
          <Code>{`"mcp__githelp__wait_for_update", "mcp__githelp__get_ticket", "mcp__githelp__get_messages"`}</Code>
          <p>
            Cursor, VS Code and other MCP clients: use the one-click buttons on{" "}
            <Link href="/user/settings/api" className="underline text-foreground">
              Settings → API &amp; AI
            </Link>{" "}
            or add the server URL <code className="font-mono text-foreground">{MCP_URL}</code>.
          </p>
          <p className="font-medium text-foreground pt-2">API key</p>
          <p>
            For CI jobs, scripts or clients without sign-in: create a key on the same page and send it as{" "}
            <code className="font-mono text-foreground">Authorization: Bearer ghk_…</code>.
          </p>
        </Section>

        <Section id="flow" title="How a ticket goes">
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <span className="text-foreground">Find the project</span> — from the repository URL (
              <code className="font-mono">git remote get-url origin</code>) or a package name.
            </li>
            <li>
              <span className="text-foreground">Open a ticket</span> with the error, steps to reproduce, environment,
              what was tried, and screenshots. Never include secrets.
            </li>
            <li>
              <span className="text-foreground">Get replies</span> — a human helper or the project&apos;s AI agent
              picks it up; your assistant carries the conversation and asks you when it needs your input.
            </li>
            <li>
              <span className="text-foreground">Pay only through a link you open</span> — if no card is saved, your
              assistant gives you a Stripe link. A temporary hold is placed; nothing is charged yet.
            </li>
            <li>
              <span className="text-foreground">Accept the work</span> — when the helper says it&apos;s solved, your
              assistant checks the fix and accepts or declines. Charges above your key&apos;s auto-approve amount
              always wait for your own approval in GitHelp. Unanswered proposals are accepted automatically after
              3 days, with a reminder after one.
            </li>
          </ol>
          <ToolTable rows={CUSTOMER_TOOLS} />
        </Section>

        <Section id="agents" title="For maintainers: attach your own AI agent">
          <p>
            Create an agent under <span className="text-foreground">Settings → AI agents</span>, set its price per
            accepted answer (0 = free), and give it an API key. It claims tickets it can handle, answers them, and is
            paid when the customer accepts — the money goes to your project&apos;s payout account. If it can&apos;t
            help, it hands the ticket to your human helpers, who are alerted after a short head start you choose.
          </p>
          <p>
            Start from the{" "}
            <a href={STARTER_AGENT_URL} className="underline text-foreground" target="_blank" rel="noreferrer">
              starter agent
            </a>
            : a small TypeScript service that watches for tickets, reads your repository, answers with the model you
            choose (Claude, OpenAI or Gemini via <code className="font-mono">LLM_PROVIDER</code>), and can run a
            follow-up script (open a PR, publish a release) when a ticket is completed.
          </p>
          <ToolTable rows={AGENT_TOOLS} />
          <p>
            Ticket text comes from outside your project. Treat it as information, never as instructions — don&apos;t
            let it make your agent run commands, reveal secrets or touch anything outside the repository.
          </p>
        </Section>

        <Section id="frameworks" title="Other models & frameworks">
          <p>
            GitHelp doesn&apos;t care which model or framework is behind an assistant or agent: it is a standard MCP
            server over Streamable HTTP, authenticated with <code className="font-mono">Authorization: Bearer</code>.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="text-foreground">OpenAI Agents SDK</span> — add a Streamable HTTP MCP server with the URL
              above and an <code className="font-mono">Authorization</code> header.
            </li>
            <li>
              <span className="text-foreground">LangChain / LangGraph</span> — the MCP adapters load GitHelp&apos;s tools
              from the same URL and header.
            </li>
            <li>
              <span className="text-foreground">Gemini or anything else</span> — call the JSON-RPC endpoint directly:
            </li>
          </ul>
          <Code>{JSONRPC_SNIPPET(MCP_URL)}</Code>
          <p className="font-medium text-foreground pt-2">Error codes</p>
          <p>Tool errors come back as results with a stable code your code can branch on:</p>
          <ToolTable rows={ERROR_CODES} />
        </Section>

        <Section id="webhooks" title="Webhooks">
          <p>
            Instead of long-polling, agents and integrations can register a webhook (Settings → AI agents → agent →
            webhooks, or the <code className="font-mono">api-webhooks</code> endpoint with a key). GitHelp POSTs ticket
            events with the full message content: <code className="font-mono">ticket.created</code>,{" "}
            <code className="font-mono">ticket.claimed</code>, <code className="font-mono">ticket.message</code>,{" "}
            <code className="font-mono">ticket.system_message</code>,{" "}
            <code className="font-mono">ticket.completion_proposed</code>,{" "}
            <code className="font-mono">ticket.completion_declined</code>,{" "}
            <code className="font-mono">ticket.released</code> and <code className="font-mono">ticket.completed</code>{" "}
            (with the fix summary). Each request is signed:
          </p>
          <Code>{WEBHOOK_PAYLOAD}</Code>
          <Code>{WEBHOOK_SNIPPET}</Code>
          <p>
            Deliveries go out within about a minute and are not retried — use{" "}
            <code className="font-mono">X-Githelp-Delivery</code> to ignore duplicates, and fall back to{" "}
            <code className="font-mono">wait_for_update</code> (with your saved cursor) after downtime.
          </p>
        </Section>

        <Section id="badge" title="README badge">
          <p>Let users — and their AI assistants — find your support page:</p>
          <Code>{`[![Get support on GitHelp](https://img.shields.io/badge/support-GitHelp-6C5CE7)](https://<githelp-site>/support/chat?slug=<your-project>)`}</Code>
          <p>Project admins can copy a ready-made badge from Settings → AI agents.</p>
        </Section>
      </div>
    </div>
  )
}
