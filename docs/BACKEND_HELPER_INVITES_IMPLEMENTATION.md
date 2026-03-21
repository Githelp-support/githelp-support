# Backend Implementation: Helper Invites

This document provides implementation details for the helper invitation system backend changes.

## Database Migration

**File:** `supabase/migrations/026_extend_projects_invites_for_helpers.sql`

This migration extends the existing `projects_invites` table to support helper invites:

-   Adds `invite_type` enum ('member' | 'helper')
-   Adds `category` column (nullable, for helper invites)
-   Adds `email` column (nullable, for email-based invites)
-   Adds constraint to ensure category is set for helper invites
-   Creates index on `invite_type` for filtering

**Status:** ✅ Created in frontend repo - needs to be applied to database

## Edge Functions

### 1. Create Project Invite

**File:** `docs/edge-functions/create-project-invite/index.ts`

**Purpose:** Create invite tokens for both member and helper invites

**Key Features:**

-   Supports `invite_type` parameter ('member' | 'helper')
-   Requires `category` when `invite_type` is 'helper'
-   Optional `email` parameter for email-based invites
-   Validates admin authorization
-   Generates secure UUID tokens
-   Logs invite URL to console if email provided (email sending to be implemented)

**Status:** ✅ Created - needs to be copied to backend repo at `supabase/functions/create-project-invite/index.ts`

### 2. List Project Invites (Extended)

**File:** `docs/edge-functions/list-project-invites/index.ts`

**Purpose:** List invites for a project with optional filtering by type

**Key Changes:**

-   Added optional `invite_type` query parameter
-   Filters invites by type when parameter provided
-   Returns new fields: `invite_type`, `category`, `email`

**Status:** ✅ Created - needs to be merged with existing backend implementation

**Backend Changes Required:**

1. Add `invite_type` query parameter parsing
2. Add filter: `.eq('invite_type', inviteType)` when parameter provided
3. Response will automatically include new columns from database

### 3. Accept Project Invite (NEW)

**File:** `docs/edge-functions/accept-project-invite/index.ts`

**Purpose:** Accept invite tokens (handles RLS by using super user)

**Key Features:**

-   Validates invite token and checks expiration/max uses
-   Checks if user is already a member
-   For helper invites, validates user has profile info
-   Adds user to `projects_members` (using super user to bypass RLS)
-   If helper invite, also adds to `projects_helpers`
-   Increments invite uses count
-   Returns success message with project info

**Status:** ✅ Created - needs to be copied to backend repo at `supabase/functions/accept-project-invite/index.ts`

### 4. Revoke Project Invite

**Status:** ✅ No changes needed - already works for both invite types

## Implementation Steps

1. **Apply Database Migration**

    ```bash
    # In backend repo
    supabase migration up
    ```

2. **Deploy Edge Functions**

    - Copy `create-project-invite` from `docs/edge-functions/` to `supabase/functions/`
    - Copy `accept-project-invite` from `docs/edge-functions/` to `supabase/functions/`
    - Update `list-project-invites` with the changes shown in `docs/edge-functions/list-project-invites/index.ts`
    - Deploy: `supabase functions deploy create-project-invite`
    - Deploy: `supabase functions deploy accept-project-invite`
    - Deploy: `supabase functions deploy list-project-invites`

3. **Test Edge Functions**
    - Test creating member invites
    - Test creating helper invites with email
    - Test creating helper invites without email (link only)
    - Test accepting member invites
    - Test accepting helper invites (with and without profile)
    - Test listing invites filtered by type
    - Test revoking invites

## API Examples

### Create Helper Invite (with email)

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-project-invite' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "project_id": "uuid-here",
    "invite_type": "helper",
    "category": "core",
    "email": "user@example.com"
  }'
```

### Create Helper Invite (link only)

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-project-invite' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "project_id": "uuid-here",
    "invite_type": "helper",
    "category": "extended"
  }'
```

### List Helper Invites

```bash
curl 'https://your-project.supabase.co/functions/v1/list-project-invites?project_id=uuid-here&invite_type=helper' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

### Accept Invite

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/accept-project-invite' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "token": "invite-token-here"
  }'
```

## Notes

-   The `invite-user` edge function is deprecated but kept for backward compatibility
-   Email sending is currently logged to console - implement email service integration later
-   All edge functions use the shared utilities from `_shared/` directory
-   RLS policies automatically apply to new columns
