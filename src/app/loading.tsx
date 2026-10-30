import { Loader2 } from "lucide-react"

/**
 * Route-level loading UI. It renders inside the AppShell's content column, so
 * the TopBar and Sidebar stay in place while a page loads.
 */
export default function Loading() {
  return (
    <div className="flex flex-1 min-h-0 items-center justify-center bg-page-muted">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto mb-4" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
