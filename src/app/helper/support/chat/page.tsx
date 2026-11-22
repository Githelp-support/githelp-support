"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageSkeleton } from "@/components/ui/skeleton"
import { useUser } from "@/contexts/user-context"
import { useHelperLastInteractedTicket } from "@/hooks/useHelperLastInteractedTicket"

/**
 * Helper Support/Chat entry. A resolver, not a chat UI: it sends the helper to
 * the ticket they last interacted with (`/helper/tickets/[id]`), or to the
 * ticket list when that session has ended, there is none, or the lookup fails.
 */
export default function HelperSupportChatPage() {
  const router = useRouter()
  const { user, isLoading: userLoading } = useUser()
  const userId = user?.id
  const { data: lastTicket, isPending, isFetching, isError } = useHelperLastInteractedTicket(userId)

  useEffect(() => {
    if (userLoading) return

    // Without a user id the query never runs: treat it as "no ticket".
    if (!userId || isError) {
      router.replace("/tickets")
      return
    }

    // Wait for a settled result, so a cached ticket that is being refetched
    // does not decide the destination.
    if (isPending || isFetching) return

    router.replace(lastTicket && !lastTicket.isEnded ? `/helper/tickets/${lastTicket.id}` : "/tickets")
  }, [userLoading, userId, isPending, isFetching, isError, lastTicket, router])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageSkeleton />
    </div>
  )
}
