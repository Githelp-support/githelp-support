import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { toInvokeError } from "@/hooks/usePaymentConnect"

/**
 * Hooks for the MCP / public API management edge functions:
 * api-keys, agents, api-webhooks and ticket-completion.
 */

async function invoke<T>(fn: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) throw await toInvokeError(error, fallback)
  if (data?.error) throw new Error(data.error)
  return data as T
}

// --- API keys -----------------------------------------------------------------

export interface ApiKey {
  id: string
  name: string
  prefix: string
  scopes: string[]
  agent_id: string | null
  max_ticket_budget_smallest_unit: number | null
  /** Above this the AI can't accept a charge; the user approves it in GitHelp. null = always ask. */
  auto_approve_limit_smallest_unit?: number | null
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface ApiKeySetup {
  mcp_url: string
  claude_code: string
  json_config: Record<string, unknown>
}

export interface CreatedApiKey {
  key: ApiKey
  plaintext_key: string
  warning: string
  setup: ApiKeySetup
  /** Agent keys: ready-made env vars for the starter agent / any agent runtime. */
  env_snippet?: string
}

const apiKeysKey = (agentId?: string | null) => ["api-keys", agentId ?? "self"]

export function useApiKeys(agentId?: string | null) {
  return useQuery({
    queryKey: apiKeysKey(agentId),
    queryFn: async () => {
      const data = await invoke<{ keys: ApiKey[] }>(
        "api-keys",
        { action: "list", ...(agentId ? { agent_id: agentId } : {}) },
        "Could not load API keys",
      )
      return data.keys
    },
    retry: false,
    staleTime: 30_000,
  })
}

export function useCreateApiKey(agentId?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      name: string
      max_ticket_budget_smallest_unit?: number | null
      auto_approve_limit_smallest_unit?: number | null
    }) =>
      invoke<CreatedApiKey>(
        "api-keys",
        { action: "create", ...(agentId ? { agent_id: agentId } : {}), ...input },
        "Could not create the API key",
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeysKey(agentId) }),
  })
}

export function useUpdateApiKey(agentId?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      key_id: string
      name?: string
      max_ticket_budget_smallest_unit?: number | null
      auto_approve_limit_smallest_unit?: number | null
    }) =>
      invoke<{ key: ApiKey }>(
        "api-keys",
        { action: "update", ...(agentId ? { agent_id: agentId } : {}), ...input },
        "Could not update the API key",
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeysKey(agentId) }),
  })
}

export interface ApiKeyUsageEvent {
  tool: string
  status: "ok" | "error"
  error_code: string | null
  ticket_id: string | null
  created_at: string
}

export function useApiKeyUsage(keyId: string | null, agentId?: string | null) {
  return useQuery({
    queryKey: ["api-key-usage", keyId],
    queryFn: async () => {
      const data = await invoke<{ events: ApiKeyUsageEvent[] }>(
        "api-keys",
        { action: "usage", key_id: keyId, ...(agentId ? { agent_id: agentId } : {}) },
        "Could not load key activity",
      )
      return data.events
    },
    enabled: Boolean(keyId),
    retry: false,
    staleTime: 15_000,
  })
}

export function useRevokeApiKey(agentId?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (keyId: string) =>
      invoke<{ key: ApiKey }>(
        "api-keys",
        { action: "revoke", key_id: keyId, ...(agentId ? { agent_id: agentId } : {}) },
        "Could not revoke the API key",
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeysKey(agentId) }),
  })
}

// --- Agents -------------------------------------------------------------------

export interface ProjectAgent {
  id: string
  project_id: string
  name: string
  description: string | null
  price_per_answer_smallest_unit: number
  enabled: boolean
  max_concurrent_tickets: number
  created_at: string
  /** Last time the agent called the API (null = never). */
  last_seen_at?: string | null
  open_tickets?: number
  accepted_count?: number
  revenue_smallest_unit?: number
}

export interface AgentFields {
  name?: string
  description?: string | null
  price_per_answer_smallest_unit?: number
  max_concurrent_tickets?: number
  enabled?: boolean
}

export interface ProjectAgentsOverview {
  agents: ProjectAgent[]
  /** The organization's payout account can receive agent earnings. */
  payouts_ready: boolean
  /** Minutes humans wait before they're alerted about a ticket an agent could take. */
  agent_head_start_minutes: number
}

const agentsKey = (projectId?: string | null) => ["project-agents", projectId ?? null]

function agentsQuery(projectId?: string | null) {
  return {
    queryKey: agentsKey(projectId),
    queryFn: async (): Promise<ProjectAgentsOverview> => {
      const data = await invoke<Partial<ProjectAgentsOverview>>(
        "agents",
        { action: "list", project_id: projectId },
        "Could not load agents",
      )
      return {
        agents: data.agents ?? [],
        payouts_ready: data.payouts_ready ?? true,
        agent_head_start_minutes: data.agent_head_start_minutes ?? 5,
      }
    },
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 30_000,
  }
}

export function useProjectAgentsOverview(projectId?: string | null) {
  return useQuery(agentsQuery(projectId))
}

export function useProjectAgents(projectId?: string | null) {
  return useQuery({ ...agentsQuery(projectId), select: (d: ProjectAgentsOverview) => d.agents })
}

export function useUpdateAgentSettings(projectId?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { agent_head_start_minutes: number }) =>
      invoke<{ agent_head_start_minutes: number }>(
        "agents",
        { action: "settings", project_id: projectId, ...input },
        "Could not save the setting",
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agentsKey(projectId) }),
  })
}

export interface PublicProjectAgent {
  id: string
  name: string
  description: string | null
  price_per_answer_smallest_unit: number
}

/** A project's enabled AI agents and their prices — readable by anyone (public support pages). */
export function usePublicProjectAgents(projectId?: string | null) {
  return useQuery({
    queryKey: ["public-project-agents", projectId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_project_public_agents", { p_project_id: projectId })
      if (error) throw error
      return (data ?? []) as PublicProjectAgent[]
    },
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 5 * 60_000,
  })
}

/** MCP endpoint of this GitHelp deployment (a visible placeholder if the deployment isn't configured). */
export function mcpServerUrl(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return base ? `${base.replace(/\/+$/, "")}/functions/v1/mcp` : "https://<your-project>.supabase.co/functions/v1/mcp"
}

function toBase64(text: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(unescape(encodeURIComponent(text)))
  }
  return Buffer.from(text, "utf8").toString("base64")
}

/** One-click install links for MCP clients; `apiKey` adds an Authorization header (otherwise OAuth sign-in). */
export function mcpInstallLinks(apiKey?: string) {
  const url = mcpServerUrl()
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined
  const cursorConfig = { url, ...(headers ? { headers } : {}) }
  const vscodeConfig = { name: "githelp", type: "http", url, ...(headers ? { headers } : {}) }
  return {
    url,
    claudeCode: apiKey
      ? `claude mcp add --scope user --transport http githelp ${url} --header "Authorization: Bearer ${apiKey}"`
      : `claude mcp add --scope user --transport http githelp ${url}`,
    cursor: `cursor://anysphere.cursor-deeplink/mcp/install?name=githelp&config=${encodeURIComponent(toBase64(JSON.stringify(cursorConfig)))}`,
    vscode: `vscode:mcp/install?${encodeURIComponent(JSON.stringify(vscodeConfig))}`,
  }
}

export function useCreateAgent(projectId?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fields: AgentFields & { name: string }) =>
      invoke<{ agent: ProjectAgent }>(
        "agents",
        { action: "create", project_id: projectId, ...fields },
        "Could not create the agent",
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agentsKey(projectId) }),
  })
}

export function useUpdateAgent(projectId?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, ...fields }: AgentFields & { agentId: string }) =>
      invoke<{ agent: ProjectAgent; tickets_handed_over?: number }>(
        "agents",
        { action: "update", agent_id: agentId, ...fields },
        "Could not update the agent",
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agentsKey(projectId) }),
  })
}

export function useDeleteAgent(projectId?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (agentId: string) =>
      invoke<{ deleted: boolean; tickets_handed_over?: number }>(
        "agents",
        { action: "delete", agent_id: agentId },
        "Could not delete the agent",
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agentsKey(projectId) }),
  })
}

// --- API webhooks -------------------------------------------------------------

export interface ApiWebhook {
  id: string
  url_masked: string
  events: string[]
  disabled_at: string | null
  failure_count: number
  created_at: string
}

const webhooksKey = (agentId?: string | null) => ["api-webhooks", agentId ?? "self"]

export function useApiWebhooks(agentId?: string | null) {
  return useQuery({
    queryKey: webhooksKey(agentId),
    queryFn: async () => {
      const data = await invoke<{ webhooks: ApiWebhook[] }>(
        "api-webhooks",
        { action: "list", ...(agentId ? { agent_id: agentId } : {}) },
        "Could not load webhooks",
      )
      return data.webhooks
    },
    retry: false,
    staleTime: 30_000,
  })
}

export function useCreateApiWebhook(agentId?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { url: string; events?: string[] }) =>
      invoke<{ webhook: ApiWebhook; signing_secret: string; verification: string }>(
        "api-webhooks",
        { action: "create", ...(agentId ? { agent_id: agentId } : {}), ...input },
        "Could not add the webhook",
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: webhooksKey(agentId) }),
  })
}

export function useDeleteApiWebhook(agentId?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (webhookId: string) =>
      invoke<{ deleted: boolean }>(
        "api-webhooks",
        { action: "delete", webhook_id: webhookId, ...(agentId ? { agent_id: agentId } : {}) },
        "Could not remove the webhook",
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: webhooksKey(agentId) }),
  })
}

export function useTestApiWebhook(agentId?: string | null) {
  return useMutation({
    mutationFn: (webhookId: string) =>
      invoke<{ sent: boolean }>(
        "api-webhooks",
        { action: "test", webhook_id: webhookId, ...(agentId ? { agent_id: agentId } : {}) },
        "Test delivery failed",
      ),
  })
}

// --- Ticket completion handshake ---------------------------------------------

export type CompletionAction =
  | { action: "propose"; ticket_id: string; summary?: string }
  | { action: "respond"; ticket_id: string; accept: boolean; reason?: string }
  | { action: "escalate"; ticket_id: string; reason?: string }
  | { action: "withdraw"; ticket_id: string }
  /** Project admins: take an AI agent's ticket back for the human helpers. */
  | { action: "take_over"; ticket_id: string }

export function useTicketCompletion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CompletionAction) =>
      invoke<Record<string, unknown>>("ticket-completion", input, "Could not update the ticket"),
    onSuccess: (_data, input) => {
      const id = input.ticket_id
      queryClient.invalidateQueries({ queryKey: ["ticket", id] })
      queryClient.invalidateQueries({ queryKey: ["ticket-with-details", id] })
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", id] })
      queryClient.invalidateQueries({ queryKey: ["ticket-participants", id] })
      queryClient.invalidateQueries({ queryKey: ["ticket-payment-status", id] })
      queryClient.invalidateQueries({ queryKey: ["tickets"] })
      queryClient.invalidateQueries({ queryKey: ["tickets-with-details"] })
      queryClient.invalidateQueries({ queryKey: ["user-tickets"] })
      queryClient.invalidateQueries({ queryKey: ["user-active-tickets-sidebar"] })
      queryClient.invalidateQueries({ queryKey: ["latest-user-active-ticket"] })
      queryClient.invalidateQueries({ queryKey: ["helper-tickets"] })
      queryClient.invalidateQueries({ queryKey: ["helper-claimed-tickets-sidebar"] })
      queryClient.invalidateQueries({ queryKey: ["time-entries"] })
    },
  })
}

export type AgentPreference = "any" | "agent" | "human"

/**
 * The customer's choice on their own (still unclaimed) web ticket: may the
 * project's AI agent answer it, and up to what price. Written to
 * tickets.api_context (the server keeps every other key and only allows
 * these two from the browser while the ticket is available).
 */
export function useSetAgentPreference() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ticketId: string; prefer: AgentPreference; maxBudgetSmallestUnit?: number | null }) => {
      const { data: current, error: readError } = await supabase
        .from("tickets")
        .select("api_context")
        .eq("id", input.ticketId)
        .single()
      if (readError) throw readError
      const context = ((current as { api_context?: Record<string, unknown> | null } | null)?.api_context ?? {}) as Record<string, unknown>
      const next = {
        ...context,
        prefer: input.prefer,
        max_budget_smallest_unit:
          input.maxBudgetSmallestUnit === undefined ? context.max_budget_smallest_unit ?? null : input.maxBudgetSmallestUnit,
      }
      const { data, error } = await supabase
        .from("tickets")
        .update({ api_context: next })
        .eq("id", input.ticketId)
        .eq("status", "available")
        .select("id")
      if (error) throw error
      if (!data?.length) throw new Error("Someone already picked up this ticket.")
      return next
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["ticket", input.ticketId] })
      queryClient.invalidateQueries({ queryKey: ["ticket-with-details", input.ticketId] })
    },
  })
}

export function formatUsd(smallestUnit: number | null | undefined): string {
  return `$${((smallestUnit ?? 0) / 100).toFixed(2)}`
}
