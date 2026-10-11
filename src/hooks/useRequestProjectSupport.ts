import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

/**
 * "Request to get help" on the support project chooser: the user searched for
 * a project that is not on Githelp. The edge function notifies the Githelp
 * team so they can reach out to the project; the user is told they will be
 * notified. Requires a signed-in user.
 */
export function useRequestProjectSupport() {
  return useMutation({
    mutationFn: async ({ projectName }: { projectName: string }) => {
      const { data, error } = await supabase.functions.invoke("request-project-support", {
        body: { project_name: projectName },
      })
      if (error) {
        // Edge function non-2xx responses surface here; prefer the
        // server-provided message when available.
        const ctx = (error as { context?: Response }).context
        if (ctx) {
          const body = await ctx.json().catch(() => null)
          if (body?.error) throw new Error(body.error)
        }
        throw error
      }
      if (!data?.success) {
        throw new Error(data?.error || "Failed to send your request")
      }
      return data as { success: true }
    },
  })
}
