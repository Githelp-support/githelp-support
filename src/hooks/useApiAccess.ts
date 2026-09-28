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
    mutationFn: (input: { name: string; max_ticket_budget_smallest_unit?: number | null }) =>
      invoke<CreatedApiKey>(
        "api-keys",
        { action: "create", ...(agentId ? { agent_id: agentId } : {}), ...input },
        "Could not create the API key",
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeysKey(agentId) }),
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
}

export interface AgentFields {
  name?: string
  description?: string | null
  price_per_answer_smallest_unit?: number
  max_concurrent_tickets?: number
  enabled?: boolean
}

const agentsKey = (projectId?: string | null) => ["project-agents", projectId ?? null]

export function useProjectAgents(projectId?: string | null) {
  return useQuery({
    queryKey: agentsKey(projectId),
    queryFn: async () => {
      const data = await invoke<{ agents: ProjectAgent[] }>(
        "agents",
        { action: "list", project_id: projectId },
        "Could not load agents",
      )
      return data.agents
    },
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 30_000,
  })
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
      invoke<{ agent: ProjectAgent }>(
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
      invoke<{ deleted: boolean }>("agents", { action: "delete", agent_id: agentId }, "Could not delete the agent"),
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
    },
  })
}

export function formatUsd(smallestUnit: number | null | undefined): string {
  return `$${((smallestUnit ?? 0) / 100).toFixed(2)}`
}
