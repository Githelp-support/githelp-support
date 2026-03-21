import { supabase } from "./supabase/client"
import { logger } from "./logger"

type EnsureOrgContext = "support" | "admin" | "helper" | "invite" | undefined

interface EnsureOrganizationResult {
  organizationId: string | null
  selectedOrganizationId: string | null
  context?: EnsureOrgContext
}

export async function ensureUserOrganization(context?: EnsureOrgContext): Promise<EnsureOrganizationResult | null> {
  try {
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) {
      logger.error("ensureUserOrganization: no authenticated user")
      return null
    }

    const userId = user.id

    // Find all organizations the user already belongs to
    const { data: memberships, error: membershipsError } = await supabase
      .from("organizations_members")
      .select("organization_id")
      .eq("id", userId)

    if (membershipsError) throw membershipsError

    const organizationIds = (memberships ?? []).map(m => m.organization_id as string)

    // Read organizations_members_config for this user
    const { data: configRow, error: configError } = await supabase
      .from("organizations_members_config")
      .select("selected_organization_id")
      .eq("id", userId)
      .maybeSingle()

    if (configError) throw configError

    let selectedOrganizationId: string | null = configRow?.selected_organization_id ?? null
    const hasMemberships = organizationIds.length > 0

    if (hasMemberships) {
      if (!selectedOrganizationId || !organizationIds.includes(selectedOrganizationId)) {
        selectedOrganizationId = organizationIds[0]

        const { error: upsertError } = await supabase
          .from("organizations_members_config")
          .upsert(
            { id: userId, selected_organization_id: selectedOrganizationId },
            { onConflict: "id" }
          )

        if (upsertError) throw upsertError
      }

      return { organizationId: selectedOrganizationId, selectedOrganizationId, context }
    }

    // No existing memberships: create a new organization for this user via DB function
    const metadata = (user as { user_metadata?: Record<string, unknown> }).user_metadata as
      | { full_name?: string; name?: string }
      | undefined

    const email = user.email ?? ""
    const emailPrefix = email.includes("@") ? email.split("@")[0] : ""

    const derivedName =
      (metadata?.full_name && String(metadata.full_name).trim()) ||
      (metadata?.name && String(metadata.name).trim()) ||
      (emailPrefix && emailPrefix.trim()) ||
      "New organization"

    // Use database function create_organization to create org + admin membership + payments config
    const { data: createdOrg, error: orgError } = await supabase.rpc("create_organization", {
      input_organization_name: derivedName,
    })

    if (orgError) throw orgError
    const organizationId = (createdOrg as { id: string }).id

    // Set selected organization for this user
    const { error: configUpsertError } = await supabase
      .from("organizations_members_config")
      .upsert(
        { id: userId, selected_organization_id: organizationId },
        { onConflict: "id" }
      )

    if (configUpsertError) throw configUpsertError

    return {
      organizationId,
      selectedOrganizationId: organizationId,
      context,
    }
  } catch (err) {
    logger.error("ensureUserOrganization failed", err)
    return null
  }
}

