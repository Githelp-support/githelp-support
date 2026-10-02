"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plug, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase/client"

interface Grant {
  client: { id: string; name: string; uri: string; logo_uri: string }
  scopes: string[]
  granted_at: string
}

/** Apps connected through GitHelp sign-in (OAuth), with a way to disconnect them. */
export function ConnectedApps() {
  const queryClient = useQueryClient()
  const { data: grants = [], isLoading, error } = useQuery({
    queryKey: ["oauth-grants"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.oauth.listGrants()
      if (error) throw error
      return (data ?? []) as Grant[]
    },
    retry: false,
    staleTime: 30_000,
  })
  const revoke = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase.auth.oauth.revokeGrant({ clientId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["oauth-grants"] }),
  })

  const handleRevoke = async (grant: Grant) => {
    if (!window.confirm(`Disconnect ${grant.client.name}? It loses access to GitHelp immediately.`)) return
    try {
      await revoke.mutateAsync(grant.client.id)
      toast.success("Disconnected")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not disconnect the app")
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground py-2">Loading connected apps…</p>
  // The OAuth server may not be enabled in every environment.
  if (error) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Sign-in connections aren&apos;t available yet. Use an API key below instead.
      </p>
    )
  }
  const note = (
    <p className="text-xs text-muted-foreground pt-2">
      AI assistants connected by sign-in can approve charges up to $50 per ticket; anything above waits for you in
      GitHelp. Disconnecting takes effect within an hour.
    </p>
  )
  if (grants.length === 0) {
    return (
      <div>
        <p className="text-sm text-muted-foreground py-2">No apps connected yet.</p>
        {note}
      </div>
    )
  }

  return (
    <div>
    <div className="divide-y divide-[rgba(0,0,0,0.06)]">
      {grants.map((grant) => (
        <div key={grant.client.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm text-foreground truncate">
              <Plug className="w-3.5 h-3.5 inline mr-1 text-muted-foreground" />
              <span className="font-medium">{grant.client.name || "Unnamed app"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Connected {new Date(grant.granted_at).toLocaleDateString()}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRevoke(grant)}
            disabled={revoke.isPending}
            aria-label={`Disconnect ${grant.client.name}`}
          >
            {revoke.isPending && revoke.variables === grant.client.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </Button>
        </div>
      ))}
    </div>
    {note}
    </div>
  )
}
