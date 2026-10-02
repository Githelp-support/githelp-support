"use client"

import { useUnclaimedProjects } from "@/hooks/useStaff"
import { demandPagePath } from "@/components/unlisted/repo"

/** Projects GitHelp runs until their maintainers claim them. */
export function UnclaimedProjects() {
  const { data: items = [], isLoading, error } = useUnclaimedProjects()
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Could not load projects"}</p>
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No unclaimed projects.</p>
  return (
    <div className="overflow-x-auto border border-border rounded-lg bg-white">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="p-3">Repository</th>
            <th className="p-3">Open tickets</th>
            <th className="p-3">Requests</th>
            <th className="p-3">Helpers</th>
            <th className="p-3">Since</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.project_id} className="border-t border-border">
              <td className="p-3">
                {p.repo ? (
                  <a href={demandPagePath(p.repo)} target="_blank" rel="noreferrer" className="hover:underline">{p.repo}</a>
                ) : (
                  <span className="text-muted-foreground">{p.slug} (no repository)</span>
                )}
              </td>
              <td className="p-3 tabular-nums">{p.open_tickets}</td>
              <td className="p-3 tabular-nums">{p.requests}</td>
              <td className="p-3 tabular-nums">{p.helpers}</td>
              <td className="p-3">{new Date(p.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
