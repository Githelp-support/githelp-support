import { redirect } from "next/navigation"

/** Moved to /user/applications (applicants are usually not on a project team yet, so /helper routes would send them to onboarding). */
export default function HelperApplicationsPage() {
  redirect("/user/applications")
}
