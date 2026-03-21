# Backend Implementation Checklist

Quick checklist for implementing backend support for the onboarding system.

## ✅ Database Migrations (Already Done)

-   [x] `024_add_onboarding_tracking.sql` - Onboarding tracking in user metadata
-   [x] `025_add_project_invites.sql` - Project invites table with RLS

## 🔨 Required Backend Implementation

### Phase 1: Critical (Must Have)

#### Database Triggers

-   [ ] **026_create_user_profile_trigger.sql**
    -   [ ] Create `handle_new_user()` function
    -   [ ] Create trigger on `auth.users` insert
    -   [ ] Test: New user signup creates `users_public` entry

#### Edge Functions

-   [ ] **create-project-invite**
    -   [ ] Generate secure token (UUID)
    -   [ ] Validate admin authorization
    -   [ ] Create invite in `projects_invites` table
    -   [ ] Return invite URL
    -   [ ] Error handling (401, 403, 404, 400)
    -   [ ] Test: Admin can create invite
    -   [ ] Test: Non-admin cannot create invite

### Phase 2: Important (Should Have)

#### Database Triggers (Optional but Recommended)

-   [ ] **027_ensure_project_creator_is_admin.sql**
    -   [ ] Create `handle_new_project()` function
    -   [ ] Create trigger on `projects` insert
    -   [ ] Test: Project creator automatically added as admin

#### Edge Functions

-   [ ] **list-project-invites**

    -   [ ] Validate admin authorization
    -   [ ] Query invites for project
    -   [ ] Return invites with URLs
    -   [ ] Test: Admin can list invites
    -   [ ] Test: Non-admin cannot list invites

-   [ ] **revoke-project-invite**
    -   [ ] Validate admin authorization
    -   [ ] Verify invite belongs to project
    -   [ ] Deactivate invite (set `is_active = false`)
    -   [ ] Test: Admin can revoke invite
    -   [ ] Test: Non-admin cannot revoke invite

### Phase 3: Nice to Have (Future Enhancements)

#### Notifications

-   [ ] **Helper request notifications**
    -   [ ] Database trigger on `pending_user_requests` insert
    -   [ ] Send email to project admins
    -   [ ] Or: Edge function for notifications
    -   [ ] Test: Admins receive notifications

#### Analytics

-   [ ] **Invite analytics**
    -   [ ] Track invite usage
    -   [ ] Dashboard for invite stats

#### Auto-acceptance

-   [ ] **Auto-accept helper requests**
    -   [ ] Setting for auto-acceptance
    -   [ ] Logic to auto-accept based on project settings

---

## 📋 Testing Checklist

### Edge Functions

-   [ ] All functions handle CORS correctly
-   [ ] All functions validate authentication
-   [ ] All functions validate authorization (admin check)
-   [ ] All functions return proper error codes
-   [ ] All functions handle edge cases (expired invites, max uses, etc.)

### Database Triggers

-   [ ] User profile created on signup (OAuth and email)
-   [ ] Project creator added as admin (if using trigger)
-   [ ] Triggers don't cause infinite loops
-   [ ] Triggers handle conflicts gracefully

### Integration

-   [ ] Frontend can create invites
-   [ ] Frontend can list invites
-   [ ] Frontend can revoke invites
-   [ ] Invite acceptance flow works end-to-end
-   [ ] Helper requests work correctly

---

## 📝 Files to Create

### Migrations

```
supabase/migrations/
  ├── 026_create_user_profile_trigger.sql
  └── 027_ensure_project_creator_is_admin.sql (optional)
```

### Edge Functions

```
supabase/functions/
  ├── create-project-invite/
  │   └── index.ts
  ├── list-project-invites/
  │   └── index.ts
  └── revoke-project-invite/
      └── index.ts
```

### Frontend Hooks (Add to existing files)

```
src/hooks/useProject.ts
  └── Add: useCreateProjectInvite()
  └── Add: useListProjectInvites()
  └── Add: useRevokeProjectInvite()
```

---

## 🔐 Security Checklist

-   [ ] All edge functions validate authentication
-   [ ] All edge functions validate authorization (admin check)
-   [ ] Invite tokens are cryptographically secure (UUID v4)
-   [ ] RLS policies prevent unauthorized access
-   [ ] No sensitive data exposed in public tables
-   [ ] Error messages don't leak sensitive information

---

## 📚 Documentation

-   [x] Main implementation plan (`BACKEND_ONBOARDING_IMPLEMENTATION.md`)
-   [x] Code examples (`BACKEND_EDGE_FUNCTIONS_EXAMPLES.md`)
-   [x] Implementation checklist (this file)

---

## 🚀 Deployment Order

1. **Database Migrations First**

    - Run `026_create_user_profile_trigger.sql`
    - Run `027_ensure_project_creator_is_admin.sql` (optional)

2. **Edge Functions Second**

    - Deploy `create-project-invite`
    - Deploy `list-project-invites`
    - Deploy `revoke-project-invite`

3. **Frontend Integration Third**
    - Add hooks to call edge functions
    - Update UI to use new hooks
    - Test end-to-end

---

## 📞 Support

If you encounter issues:

1. Check Supabase logs for edge function errors
2. Verify RLS policies are correct
3. Test database triggers manually
4. Verify authentication tokens are valid
5. Check CORS headers are set correctly

---

## Notes

-   The frontend is already set up to work with these backend components
-   Invite acceptance is handled directly via database queries (no edge function needed)
-   Helper requests use existing `pending_user_requests` table
-   Onboarding completion is stored in user metadata (no backend needed)
