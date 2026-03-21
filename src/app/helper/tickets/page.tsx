import { redirect } from "next/navigation"

/**
 * Helpers use the same tickets list as admins at /tickets.
 * Redirect so bookmarks and any legacy links to /helper/tickets still work.
 */
export default function HelperTicketsRedirect() {
  redirect("/tickets")
}
