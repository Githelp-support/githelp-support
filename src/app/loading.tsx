import { PageSkeleton } from "@/components/ui/skeleton"

/**
 * Route-level loading UI. It renders inside the AppShell's content column, so
 * the TopBar and Sidebar stay in place while a page loads.
 */
export default function Loading() {
  return <PageSkeleton />
}
