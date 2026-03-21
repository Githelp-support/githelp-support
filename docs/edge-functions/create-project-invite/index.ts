// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";

import { supabaseClientUser } from "../_shared/supabase/index.ts";
import { corsHeaders } from "../_shared/cors/index.ts";

/**
 * Create a new invite token for a project (member or helper)
 *
 * @route POST /functions/v1/create-project-invite
 * @auth Required (must be project admin)
 *
 * @body {
 *   project_id: string (UUID)
 *   invite_type: "member" | "helper"
 *   category?: "core" | "extended" | "community" (required if invite_type is "helper")
 *   email?: string (optional - for email-based invites)
 *   expires_at?: string (ISO timestamp, optional)
 *   max_uses?: number (optional)
 * }
 *
 * @returns {
 *   success: boolean
 *   invite: {
 *     id: string
 *     token: string
 *     project_id: string
 *     invite_type: "member" | "helper"
 *     category: string | null
 *     email: string | null
 *     expires_at: string | null
 *     max_uses: number | null
 *     uses_count: number
 *     is_active: boolean
 *     invite_url: string
 *   }
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

        // Parse request body
        const {
            project_id,
            invite_type,
            category,
            email,
            expires_at,
            max_uses,
        } = await req.json();

        // Validate required fields
        if (!project_id || !invite_type) {
            return new Response(
                JSON.stringify({
                    error: "project_id and invite_type are required",
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

        // Validate invite_type
        if (invite_type !== "member" && invite_type !== "helper") {
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

        // If helper invite, category is required
        if (invite_type === "helper" && !category) {
            return new Response(
                JSON.stringify({
                    error: "category is required when invite_type is 'helper'",
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

        // Validate category if provided
        if (category && !["core", "extended", "community"].includes(category)) {
            return new Response(
                JSON.stringify({
                    error: "category must be 'core', 'extended', or 'community'",
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

        // Check if user is admin of project
        const { data: memberData, error: memberError } = await supabaseClient
            .from("projects_members")
            .select("role")
            .eq("project_id", project_id)
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .single();

        if (memberError || !memberData || memberData.role !== "admin") {
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

        // Validate project exists
        const { data: project, error: projectError } = await supabaseClient
            .from("projects")
            .select("project_id")
            .eq("project_id", project_id)
            .single();

        if (projectError || !project) {
            return new Response(
                JSON.stringify({ error: "Project not found" }),
                {
                    status: 404,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Validate expires_at if provided
        if (expires_at && new Date(expires_at) < new Date()) {
            return new Response(
                JSON.stringify({
                    error: "expires_at cannot be in the past",
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

        // Validate max_uses if provided
        if (max_uses !== undefined && max_uses < 1) {
            return new Response(
                JSON.stringify({
                    error: "max_uses must be at least 1",
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

        // Generate secure token
        const token = crypto.randomUUID();

        // Create invite record
        const inviteData: any = {
            project_id,
            created_by: user.id,
            token,
            invite_type,
            is_active: true,
            uses_count: 0,
        };

        if (invite_type === "helper") {
            inviteData.category = category;
        }

        if (email) {
            inviteData.email = email;
        }

        if (expires_at) {
            inviteData.expires_at = expires_at;
        }

        if (max_uses !== undefined) {
            inviteData.max_uses = max_uses;
        }

        const { data: invite, error: insertError } = await supabaseClient
            .from("projects_invites")
            .insert(inviteData)
            .select()
            .single();

        if (insertError) {
            console.error("Error creating invite:", insertError);
            return new Response(
                JSON.stringify({ error: "Failed to create invite" }),
                {
                    status: 500,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Build invite URL
        const baseUrl =
            Deno.env.get("SITE_URL") ||
            req.headers.get("origin") ||
            "https://githelp.app";
        const inviteUrl = `${baseUrl}/invite/${token}`;

        // If email provided, log it (email sending to be implemented later)
        if (email) {
            console.log(`[EMAIL] Invite link for ${email}: ${inviteUrl}`);
        }

        return new Response(
            JSON.stringify({
                success: true,
                invite: {
                    ...invite,
                    invite_url: inviteUrl,
                },
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-project-invite' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{"project_id": "uuid-here", "invite_type": "helper", "category": "core", "email": "user@example.com"}'
*/

