# Backend Implementation Plan: Onboarding System

This document outlines what needs to be implemented in the backend repository (Supabase Edge Functions, database functions, triggers, etc.) to support the onboarding system built in the frontend.

## Overview

The frontend onboarding system requires several backend components:

1. **Invite token generation and management** - Edge functions for creating/managing project invites
2. **User profile auto-creation** - Database triggers to create `users_public` entries
3. **Helper request processing** - Enhancements to existing helper invitation system
4. **Project member management** - Ensure proper member addition when projects are created

---

## 1. Project Invite Management (Edge Functions)

### 1.1 Create Invite Token

**Edge Function:** `create-project-invite`

**Purpose:** Generate a secure invite token for a project that admins can share.

**Endpoint:** `POST /functions/v1/create-project-invite`

**Request Body:**

```typescript
{
  project_id: string;
  expires_at?: string; // ISO timestamp, optional
  max_uses?: number; // Optional, null = unlimited
}
```

**Response:**

```typescript
{
    success: boolean;
    invite: {
        id: string;
        token: string;
        project_id: string;
        expires_at: string | null;
        max_uses: number | null;
        invite_url: string; // Full URL: /invite/{token}
    }
}
```

**Authorization:**

-   Must be authenticated
-   Must be admin of the project (`is_project_admin(project_id)`)

**Implementation Notes:**

-   Generate cryptographically secure random token (use `crypto.randomUUID()` or similar)
-   Validate project exists and user is admin
-   Set `created_by` to current user
-   Return full invite URL for easy sharing
-   Default `is_active = true`

**Error Cases:**

-   401: Not authenticated
-   403: User is not admin of project
-   404: Project not found
-   400: Invalid request (expires_at in past, max_uses < 1, etc.)

---

### 1.2 List Project Invites

**Edge Function:** `list-project-invites`

**Purpose:** Get all active invites for a project (admin only).

**Endpoint:** `GET /functions/v1/list-project-invites?project_id={uuid}`

**Response:**

```typescript
{
    success: boolean;
    invites: Array<{
        id: string;
        token: string;
        project_id: string;
        created_by: string;
        created_at: string;
        expires_at: string | null;
        max_uses: number | null;
        uses_count: number;
        is_active: boolean;
        invite_url: string;
    }>;
}
```

**Authorization:**

-   Must be authenticated
-   Must be admin of the project

---

### 1.3 Revoke/Deactivate Invite

**Edge Function:** `revoke-project-invite`

**Purpose:** Deactivate an invite token (admin only).

**Endpoint:** `POST /functions/v1/revoke-project-invite`

**Request Body:**

```typescript
{
    invite_id: string;
    project_id: string; // For authorization check
}
```

**Response:**

```typescript
{
    success: boolean;
    message: string;
}
```

**Authorization:**

-   Must be authenticated
-   Must be admin of the project

**Implementation:**

-   Set `is_active = false` on the invite
-   Don't delete the record (for audit trail)

---

### 1.4 Get Invite Details (Public)

**Edge Function:** `get-invite-details` (Optional - can be done via direct DB query with RLS)

**Purpose:** Get invite details for validation/display (public endpoint).

**Endpoint:** `GET /functions/v1/get-invite-details?token={token}`

**Response:**

```typescript
{
  success: boolean;
  invite: {
    id: string;
    project_id: string;
    expires_at: string | null;
    max_uses: number | null;
    uses_count: number;
    is_active: boolean;
    project: {
      name: string;
      logo_url: string | null;
    };
  } | null;
}
```

**Authorization:**

-   Public endpoint (no auth required)
-   Only returns active, non-expired invites

**Note:** This might not be necessary if the frontend can query `projects_invites` directly with the RLS policy that allows reading by token.

---

## 2. Database Functions & Triggers

### 2.1 Auto-create User Profile on Sign Up

**Database Trigger:** `create_user_profile_on_signup`

**Purpose:** Automatically create a `users_public` entry and initialize `users` entry when a new user signs up.

**Implementation:**

```sql
-- Function to create user profile and initialize users table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create users_public entry
  INSERT INTO public.users_public (id, name, email, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
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
```

**Migration File:** `026_create_user_profile_trigger.sql`

**Notes:**

-   Extract name from `raw_user_meta_data` (OAuth providers often put it there)
-   Fallback to email username if name not available
-   Use `ON CONFLICT DO NOTHING` to handle race conditions
-   Also initializes `public.users` entry with `onboarding_completed = false`

---

### 2.2 Ensure Project Creator is Admin Member

**Database Trigger:** `ensure_project_creator_is_admin` (Optional - currently handled in frontend)

**Purpose:** Automatically add project creator to `projects_members` as admin when project is created.

**Implementation:**

```sql
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

CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_project();
```

**Migration File:** `027_ensure_project_creator_is_admin.sql`

**Note:** Currently handled in frontend `useCreateProject` hook, but this provides a database-level guarantee.

---

## 3. Helper Request System Enhancements

### 3.1 Existing `invite-user` Edge Function

**Current Status:** Referenced in `src/hooks/useHelpers.ts` - creates helper and sends invitation.

**Enhancements Needed:**

1. **Support for helper requests from project landing page:**

    - When a user requests to become a helper via `/projects/[id]`, it creates a `pending_user_requests` entry
    - This should trigger notification to project admins
    - Consider adding email notification when helper request is created

2. **Auto-accept helper requests (Optional):**
    - If project has `open_for_new_helpers = true` and no approval needed, could auto-accept
    - Or add a setting for auto-acceptance

**Current Flow:**

-   Admin adds helper → `invite-user` edge function → Creates helper + sends invite
-   User requests helper → Creates `pending_user_requests` → Admin accepts/rejects

**Enhancement:**

-   Add webhook/notification when `pending_user_requests` is created
-   Send email to project admins about new helper request

---

### 3.2 Helper Request Notification

**Edge Function:** `notify-helper-request` (or use database trigger + webhook)

**Purpose:** Notify project admins when a new helper request is created.

**Implementation Options:**

1. **Database Trigger + Webhook:**

    - Trigger on `pending_user_requests` insert
    - Call webhook/edge function to send notifications

2. **Edge Function called from frontend:**
    - After creating `pending_user_requests`, call edge function
    - Edge function sends email/notification to admins

**Recommended:** Database trigger + webhook for reliability.

---

## 4. Project Landing Page Support

### 4.1 Public Project Information

**Current Status:** Frontend queries `projects` table directly.

**Backend Needs:**

-   Ensure RLS allows public read access to projects (already done in migration `021_create_rls_policies.sql`)
-   Consider adding a public API endpoint for project info if needed for SEO/caching

**Optional Enhancement:**

-   Edge function to get public project info with branding/resources
-   Could cache this for better performance

---

## 5. Onboarding Completion Tracking

### 5.1 Onboarding Status Storage

**Current Status:** Handled via direct database updates to `public.users` table in frontend.

**Backend Needs:**

-   No backend changes needed - onboarding status is stored in `public.users` table
-   Frontend directly updates via Supabase client
-   Ensure RLS policies allow users to read/update their own onboarding status

**Note:** The `public.users` table stores onboarding status separately from `users_public` as it is not information other users need.

---

## 6. Security Considerations

### 6.1 RLS Policies

**Already Implemented:**

-   `projects_invites` table has RLS policies
-   Admins can manage invites
-   Public can read active invites by token

**Verify:**

-   Ensure `public.users` table has RLS policies allowing users to read/update their own onboarding status
-   Ensure `projects_members` RLS allows inserting members via invite acceptance
-   Ensure `pending_user_requests` RLS allows authenticated users to create requests

**Required RLS Policy for `public.users`:**

```sql
-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own onboarding status
CREATE POLICY "users_select_own"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own onboarding status
CREATE POLICY "users_update_own"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

### 6.2 Token Security

-   Use cryptographically secure random tokens (UUID v4 or crypto.randomBytes)
-   Consider token expiration by default (e.g., 30 days)
-   Rate limiting on invite creation (prevent spam)

---

## 7. Implementation Priority

### Phase 1: Critical (Required for basic functionality)

1. ✅ Database migration for `projects_invites` table (already done)
2. ✅ RLS policies for `projects_invites` (already done)
3. **Create `create-project-invite` edge function** - High priority
4. **Create user profile trigger** - High priority (ensures users_public exists)

### Phase 2: Important (Enhancements)

5. **List/revoke invite functions** - Medium priority
6. **Project creator admin trigger** - Medium priority (safety net)
7. **Helper request notifications** - Medium priority

### Phase 3: Nice to Have (Optimizations)

8. **Public project info endpoint** - Low priority
9. **Invite analytics** - Low priority
10. **Auto-accept helper requests** - Low priority

---

## 8. Testing Checklist

### Edge Functions

-   [ ] `create-project-invite`: Admin can create invite
-   [ ] `create-project-invite`: Non-admin cannot create invite
-   [ ] `create-project-invite`: Invalid project_id returns 404
-   [ ] `list-project-invites`: Returns only invites for user's projects
-   [ ] `revoke-project-invite`: Deactivates invite correctly
-   [ ] Invite tokens are unique and secure

### Database Triggers

-   [ ] User profile created automatically on signup
-   [ ] Project creator added as admin member (if using trigger)
-   [ ] Helper request notifications sent (if implemented)

### Integration

-   [ ] Frontend can create invites via edge function
-   [ ] Frontend can list invites via edge function
-   [ ] Invite acceptance flow works end-to-end
-   [ ] Helper requests create notifications

---

## 9. API Documentation Template

### Example: Create Project Invite

```typescript
/**
 * Create a new invite token for a project
 *
 * @route POST /functions/v1/create-project-invite
 * @auth Required (must be project admin)
 *
 * @body {
 *   project_id: string (UUID)
 *   expires_at?: string (ISO timestamp)
 *   max_uses?: number
 * }
 *
 * @returns {
 *   success: boolean
 *   invite: {
 *     id: string
 *     token: string
 *     project_id: string
 *     expires_at: string | null
 *     max_uses: number | null
 *     invite_url: string
 *   }
 * }
 *
 * @errors
 * - 401: Not authenticated
 * - 403: User is not admin of project
 * - 404: Project not found
 * - 400: Invalid request parameters
 */
```

---

## 10. Migration Files Needed

1. **026_create_user_profile_trigger.sql** - Auto-create user profiles
2. **027_ensure_project_creator_is_admin.sql** (Optional) - Auto-add creator as admin
3. **028_add_helper_request_notifications.sql** (Optional) - Notification triggers

---

## 11. Edge Function Structure

```
supabase/
  functions/
    create-project-invite/
      index.ts
    list-project-invites/
      index.ts
    revoke-project-invite/
      index.ts
    notify-helper-request/ (Optional)
      index.ts
```

---

## 12. Environment Variables Needed

For edge functions that send emails/notifications:

-   `RESEND_API_KEY` or similar (for email notifications)
-   `SUPABASE_SERVICE_ROLE_KEY` (for admin operations if needed)

---

## Summary

The main backend work needed:

1. **3-4 Edge Functions** for invite management
2. **1-2 Database Triggers** for user profile creation and project member management
3. **Optional notification system** for helper requests

The frontend is already set up to work with these backend components once they're implemented.
