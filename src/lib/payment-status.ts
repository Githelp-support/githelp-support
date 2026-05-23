export interface ConnectStatusFields {
  stripe_account_id: string | null
  stripe_details_submitted: boolean
  stripe_charges_enabled: boolean
  stripe_payouts_enabled: boolean
}

export interface ConnectStatusResult {
  label: "Not set up" | "Pending verification" | "Active" | "Restricted"
  variant: "inactive" | "pending" | "active" | "warning"
}

/**
 * Map the four Stripe Connect status fields into a single label + UI variant.
 *
 *   no account                                   → "Not set up"
 *   account but onboarding incomplete            → "Pending verification"
 *   onboarding complete + both flags enabled     → "Active"
 *   onboarding complete but a flag is disabled   → "Restricted"
 *     (e.g. Stripe flagged the account, or extra info needed mid-life)
 */
export function connectStatusLabel(
  fields: ConnectStatusFields,
): ConnectStatusResult {
  if (!fields.stripe_account_id) {
    return { label: "Not set up", variant: "inactive" }
  }
  if (!fields.stripe_details_submitted) {
    return { label: "Pending verification", variant: "pending" }
  }
  if (fields.stripe_charges_enabled && fields.stripe_payouts_enabled) {
    return { label: "Active", variant: "active" }
  }
  return { label: "Restricted", variant: "warning" }
}
