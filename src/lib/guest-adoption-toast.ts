import { toast } from "sonner"
import type { GuestAdoptionResult } from "@/lib/guest-adoption"

/** Short user-facing note after the post-sign-in adoption step. */
export function notifyGuestAdoptionResult(result: GuestAdoptionResult): void {
  if (result.status === "adopted" && result.adoptedTicketIds.length > 0) {
    toast.success(
      result.openTicketIds.length > 0
        ? "You're signed in. Your conversation is now linked to your account."
        : "You're signed in. Your earlier conversation was moved to your account.",
    )
  } else if (result.status === "failed") {
    toast.info(
      result.retryable
        ? "You're signed in. We couldn't link your guest conversation yet; we'll try again shortly."
        : "You're signed in, but we couldn't move your guest conversation to your account.",
      result.retryable ? undefined : { description: "You can start a new conversation from the support page." },
    )
  }
}
