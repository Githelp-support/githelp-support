// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";

import { supabaseClientUser } from "../_shared/supabase/index.ts";
import { supabaseSuperUser } from "../_shared/supabase/index.ts";
import { corsHeaders } from "../_shared/cors/index.ts";

/**
 * Accept a project invite (member or helper)
 *
 * @route POST /functions/v1/accept-project-invite
 * @auth Required (must be authenticated)
 *
 * @body {
 *   token: string (invite token)
 * }
 *
 * @returns {
 *   success: boolean
 *   message: string
 *   project_id: string
 *   invite_type: "member" | "helper"
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

        // Create Supabase client for user operations
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
        const { token } = await req.json();

        if (!token) {
            return new Response(
                JSON.stringify({ error: "token is required" }),
                {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Find invite by token (using super user to bypass RLS for public read)
        const { data: invite, error: inviteError } = await supabaseSuperUser
            .from("projects_invites")
            .select("*, project:projects(project_id, name)")
            .eq("token", token)
            .eq("is_active", true)
            .single();

        if (inviteError || !invite) {
            return new Response(
                JSON.stringify({ error: "Invalid or expired invite link" }),
                {
                    status: 404,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Check if invite has expired
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
            return new Response(
                JSON.stringify({ error: "This invite link has expired" }),
                {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Check if invite has reached max uses
        if (invite.max_uses && invite.uses_count >= invite.max_uses) {
            return new Response(
                JSON.stringify({
                    error: "This invite link has reached its maximum number of uses",
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

        const project = invite.project as any;

        // Check if user is already a member
        const { data: existingMember } = await supabaseSuperUser
            .from("projects_members")
            .select("user_id")
            .eq("user_id", user.id)
            .eq("project_id", project.project_id)
            .is("deleted_at", null)
            .maybeSingle();

        if (existingMember) {
            return new Response(
                JSON.stringify({
                    success: true,
                    message: "You're already a member of this project",
                    project_id: project.project_id,
                    invite_type: invite.invite_type,
                }),
                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                    status: 200,
                }
            );
        }

        // Check if user has profile info (for helper invites)
        if (invite.invite_type === "helper") {
            const { data: profile } = await supabaseSuperUser
                .from("users_public")
                .select("name")
                .eq("id", user.id)
                .single();

            if (!profile || !profile.name || profile.name.trim() === "") {
                return new Response(
                    JSON.stringify({
                        error: "Profile incomplete. Please complete your profile first.",
                        needs_profile: true,
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
        }

        // Add user as member (using super user to bypass RLS)
        const { error: memberError } = await supabaseSuperUser
            .from("projects_members")
            .insert({
                user_id: user.id,
                project_id: project.project_id,
                role: "member",
            });

        if (memberError) {
            console.error("Error adding member:", memberError);
            return new Response(
                JSON.stringify({ error: "Failed to add member" }),
                {
                    status: 500,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // If helper invite, also add to projects_helpers
        if (invite.invite_type === "helper" && invite.category) {
            // Check if helper already exists
            const { data: existingHelper } = await supabaseSuperUser
                .from("projects_helpers")
                .select("helper_id")
                .eq("user_id", user.id)
                .eq("project_id", project.project_id)
                .maybeSingle();

            if (!existingHelper) {
                const { error: helperError } = await supabaseSuperUser
                    .from("projects_helpers")
                    .insert({
                        user_id: user.id,
                        project_id: project.project_id,
                        category: invite.category,
                    });

                if (helperError) {
                    console.error("Error adding helper:", helperError);
                    // Continue anyway - user is still a member
                }
            }
        }

        // Increment invite uses count
        const { error: updateError } = await supabaseSuperUser
            .from("projects_invites")
            .update({ uses_count: invite.uses_count + 1 })
            .eq("id", invite.id);

        if (updateError) {
            console.error("Error updating invite uses:", updateError);
            // Continue anyway - member was added successfully
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Successfully joined ${project.name} ${
                    invite.invite_type === "helper"
                        ? "as a helper"
                        : "as a member"
                }!`,
                project_id: project.project_id,
                invite_type: invite.invite_type,
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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/accept-project-invite' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{"token": "invite-token-here"}'
*/
