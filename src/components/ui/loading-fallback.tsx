import { Loader2 } from "lucide-react"

/** Shared loading UI for Suspense fallbacks and initial load. */
export function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f9ff]">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto mb-4" aria-hidden />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
