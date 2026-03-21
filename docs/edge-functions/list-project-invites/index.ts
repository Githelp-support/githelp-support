// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";

import { supabaseClientUser } from "../_shared/supabase/index.ts";
import { corsHeaders } from "../_shared/cors/index.ts";

/**
 * List all invites for a project (admin only)
 *
 * @route GET /functions/v1/list-project-invites?project_id={uuid}&invite_type={member|helper}
 * @auth Required (must be project admin)
 *
 * @returns {
 *   success: boolean
 *   invites: Array<{
 *     id: string
 *     token: string
 *     project_id: string
 *     created_by: string
 *     created_at: string
 *     invite_type: "member" | "helper"
 *     category: string | null
 *     email: string | null
 *     expires_at: string | null
 *     max_uses: number | null
 *     uses_count: number
 *     is_active: boolean
 *     invite_url: string
 *   }>
 * }
 */
Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Get authenticated user
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Not authenticated" }),
                {
                    status: 401,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Create Supabase client
        const supabaseClient = supabaseClientUser(req);

        // Get current user
        const {
            data: { user },
            error: userError,
        } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: "Not authenticated" }),
                {
                    status: 401,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Get project_id from query params
        const url = new URL(req.url);
        const projectId = url.searchParams.get("project_id");
        const inviteType = url.searchParams.get("invite_type");

        if (!projectId) {
            return new Response(
                JSON.stringify({
                    error: "project_id query parameter is required",
                }),
                {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Validate invite_type if provided
        if (inviteType && inviteType !== "member" && inviteType !== "helper") {
            return new Response(
                JSON.stringify({
                    error: "invite_type must be 'member' or 'helper'",
                }),
                {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Check if user is admin (RLS will handle this, but we verify for better error messages)
        const { data: memberData } = await supabaseClient
            .from("projects_members")
            .select("role")
            .eq("project_id", projectId)
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .single();

        if (!memberData || memberData.role !== "admin") {
            return new Response(
                JSON.stringify({
                    error: "Not authorized. Must be project admin.",
                }),
                {
                    status: 403,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Get invites (RLS policy ensures only admins can see)
        let query = supabaseClient
            .from("projects_invites")
            .select("*")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false });

        // Filter by invite_type if provided
        if (inviteType) {
            query = query.eq("invite_type", inviteType);
        }

        const { data: invites, error: invitesError } = await query;

        if (invitesError) {
            console.error("Error fetching invites:", invitesError);
            return new Response(
                JSON.stringify({ error: "Failed to fetch invites" }),
                {
                    status: 500,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Build invite URLs
        const baseUrl =
            Deno.env.get("SITE_URL") ||
            req.headers.get("origin") ||
            "https://githelp.app";

        const invitesWithUrls = invites.map((invite) => ({
            ...invite,
            invite_url: `${baseUrl}/invite/${invite.token}`,
        }));

        return new Response(
            JSON.stringify({
                success: true,
                invites: invitesWithUrls,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Unexpected error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});

/* To invoke locally:
  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/list-project-invites?project_id=uuid-here&invite_type=helper' \
    --header 'Authorization: Bearer YOUR_ANON_KEY'
*/

