import { PageSkeleton } from "@/components/ui/skeleton"

/** Shared loading UI for Suspense fallbacks and initial load: a content-area skeleton. */
export function LoadingFallback() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageSkeleton />
    </div>
  )
}
