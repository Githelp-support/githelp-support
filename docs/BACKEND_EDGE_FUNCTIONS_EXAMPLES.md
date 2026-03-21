# Backend Edge Functions - Implementation Examples

Quick reference guide with code examples for implementing the required edge functions.

## Prerequisites

All edge functions should:

-   Use Supabase Edge Functions runtime (Deno)
-   Import from `@supabase/supabase-js`
-   Use service role client for admin operations
-   Validate authentication and authorization

---

## 1. Create Project Invite

**File:** `supabase/functions/create-project-invite/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: authHeader },
                },
            }
        );

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
        const { project_id, expires_at, max_uses } = await req.json();

        if (!project_id) {
            return new Response(
                JSON.stringify({ error: "project_id is required" }),
                {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Validate project exists and user is admin
        const { data: project, error: projectError } = await supabaseClient
            .from("projects")
            .select("project_id, name")
            .eq("project_id", project_id)
            .is("deleted_at", null)
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

        // Check if user is admin (using RLS function)
        const { data: memberData } = await supabaseClient
            .from("projects_members")
            .select("role")
            .eq("project_id", project_id)
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

        // Validate expires_at if provided
        if (expires_at && new Date(expires_at) < new Date()) {
            return new Response(
                JSON.stringify({ error: "expires_at must be in the future" }),
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
                JSON.stringify({ error: "max_uses must be at least 1" }),
                {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Generate secure token (UUID v4)
        const token = crypto.randomUUID();

        // Create invite
        const { data: invite, error: inviteError } = await supabaseClient
            .from("projects_invites")
            .insert({
                project_id,
                created_by: user.id,
                token,
                expires_at: expires_at || null,
                max_uses: max_uses || null,
                is_active: true,
                uses_count: 0,
            })
            .select()
            .single();

        if (inviteError) {
            console.error("Error creating invite:", inviteError);
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

        // Get base URL from environment or request
        const baseUrl =
            Deno.env.get("SITE_URL") ||
            req.headers.get("origin") ||
            "https://your-domain.com";
        const inviteUrl = `${baseUrl}/invite/${token}`;

        return new Response(
            JSON.stringify({
                success: true,
                invite: {
                    id: invite.id,
                    token: invite.token,
                    project_id: invite.project_id,
                    expires_at: invite.expires_at,
                    max_uses: invite.max_uses,
                    invite_url: inviteUrl,
                },
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
```

---

## 2. List Project Invites

**File:** `supabase/functions/list-project-invites/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
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

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: authHeader },
                },
            }
        );

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
        const { data: invites, error: invitesError } = await supabaseClient
            .from("projects_invites")
            .select("*")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false });

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
            "https://your-domain.com";
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
```

---

## 3. Revoke Project Invite

**File:** `supabase/functions/revoke-project-invite/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
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

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: authHeader },
                },
            }
        );

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

        const { invite_id, project_id } = await req.json();

        if (!invite_id || !project_id) {
            return new Response(
                JSON.stringify({
                    error: "invite_id and project_id are required",
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

        // Verify user is admin
        const { data: memberData } = await supabaseClient
            .from("projects_members")
            .select("role")
            .eq("project_id", project_id)
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

        // Verify invite belongs to project
        const { data: invite, error: inviteError } = await supabaseClient
            .from("projects_invites")
            .select("project_id")
            .eq("id", invite_id)
            .single();

        if (inviteError || !invite || invite.project_id !== project_id) {
            return new Response(
                JSON.stringify({
                    error: "Invite not found or does not belong to project",
                }),
                {
                    status: 404,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Deactivate invite
        const { error: updateError } = await supabaseClient
            .from("projects_invites")
            .update({ is_active: false })
            .eq("id", invite_id);

        if (updateError) {
            console.error("Error revoking invite:", updateError);
            return new Response(
                JSON.stringify({ error: "Failed to revoke invite" }),
                {
                    status: 500,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Invite revoked successfully",
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
```

---

## 4. Database Trigger: Auto-create User Profile

**File:** `supabase/migrations/026_create_user_profile_trigger.sql`

```sql
-- Function to create user profile and initialize users table when new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create users_public entry
  INSERT INTO public.users_public (id, name, email, username)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      NEW.raw_user_meta_data->>'preferred_username',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  -- Initialize users table entry (for onboarding tracking)
  INSERT INTO public.users (id, onboarding_completed)
  VALUES (NEW.id, false)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a users_public entry when a new user signs up';
```

---

## 5. Database Trigger: Ensure Project Creator is Admin (Optional)

**File:** `supabase/migrations/027_ensure_project_creator_is_admin.sql`

```sql
-- Function to ensure project creator is added as admin member
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
  -- Add creator as admin member if created_by is set
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.projects_members (user_id, project_id, role)
    VALUES (NEW.created_by, NEW.project_id, 'admin')
    ON CONFLICT (user_id, project_id) DO UPDATE
    SET role = 'admin', deleted_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on projects insert
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_project();

-- Add comment
COMMENT ON FUNCTION public.handle_new_project() IS 'Automatically adds project creator as admin member when project is created';
```

---

## Frontend Integration

### Create Invite Hook

Add to `src/hooks/useProject.ts`:

```typescript
export function useCreateProjectInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            projectId,
            expiresAt,
            maxUses,
        }: {
            projectId: string;
            expiresAt?: string;
            maxUses?: number;
        }) => {
            const { data, error } = await supabase.functions.invoke(
                "create-project-invite",
                {
                    body: {
                        project_id: projectId,
                        expires_at: expiresAt,
                        max_uses: maxUses,
                    },
                }
            );

            if (error) throw error;
            if (!data?.success) {
                throw new Error("Failed to create invite");
            }

            return data.invite;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-invites"] });
        },
    });
}
```

---

## Environment Variables

Add to your Supabase project settings:

-   `SITE_URL`: Your frontend URL (e.g., `https://your-app.com`)
-   `SUPABASE_URL`: Auto-configured
-   `SUPABASE_ANON_KEY`: Auto-configured
-   `SUPABASE_SERVICE_ROLE_KEY`: For admin operations (if needed)

---

## Testing

Test each edge function with:

```bash
# Create invite
curl -X POST https://your-project.supabase.co/functions/v1/create-project-invite \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "uuid-here"}'

# List invites
curl "https://your-project.supabase.co/functions/v1/list-project-invites?project_id=uuid-here" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Revoke invite
curl -X POST https://your-project.supabase.co/functions/v1/revoke-project-invite \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"invite_id": "uuid-here", "project_id": "uuid-here"}'
```
