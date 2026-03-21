# Pre-publish refactoring evaluation

This document summarizes recommended refactoring improvements before publishing the codebase. Items are grouped by priority: **High** (should fix before publish), **Medium** (good to have), **Low** (nice to have).

---

## High priority

### 1. Fix production build (TypeScript)

**Issue:** `npm run build` fails because `docs/edge-functions/**/*.ts` are included in TypeScript compilation. Those files are Supabase Edge Function *examples* and import from `../_shared/...`, which does not exist in this repo.

**Fix:** Exclude `docs` from `tsconfig.json` so only `src` is compiled. **(Done: `docs` added to `exclude`.)**

```json
// tsconfig.json – add to "exclude"
"exclude": ["node_modules", "docs"]
```

Alternatively, restrict `include` to `src` only:

```json
"include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"]
```

### 2. Remove or gate debug logging **(Done)**

**Issue:** Many `console.log` and `console.error` calls are left in the app and in auth. In production these can leak information and clutter tools.

**Locations (examples):**
- `src/lib/supabase/auth.ts`: multiple `console.log` for SIGNED_IN/SIGNED_OUT, "Initialized auth", "ERROR IN loginUserGoogle", etc.
- `src/app/support/page.tsx`: several `console.log` for project id/slug (sensitive in prod).
- `src/app/helper/tickets/[id]/page.tsx`: "Ticket ended with outcome", "[v0] Total logged time", "Show ticket details", etc.
- `src/app/helpers/page.tsx`, `src/app/slas/page.tsx`, `src/components/drawers/end-ticket-drawer.tsx`: similar debug logs.

**Recommendation:**
- Remove or replace with a small logger that is no-op (or structured) in production, e.g. `if (process.env.NODE_ENV === 'development') { console.log(...) }` or a `logger.debug()` that respects env.
- Keep `console.error` in catch blocks only where you intend to report real errors (and consider sending to an error service later); remove noisy or redundant ones.

### 3. Add `.env.example` for contributors

**Issue:** Only `.env.local` exists. New contributors and CI don’t know which env vars are required.

**Recommendation:** Add `.env.example` (no secrets) listing required variables. **(Done: `.env.example` added with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.)** Example:

```bash
# Supabase (from project settings)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Document in README that they should copy to `.env.local` and fill in values.

### 4. Update ARCHITECTURE.md to match current structure

**Issue:** ARCHITECTURE.md still says feature components like "add-helper-drawer.tsx" live "next to ui/". They now live under `layout/`, `auth/`, `modals/`, and `drawers/`.

**Recommendation:** Update the "Directory structure" and "Feature-specific components" sentence to describe. **(Done: ARCHITECTURE.md updated with layout/, auth/, modals/, drawers/.)**

- `layout/` – header, sidebar, protected-layout, notifications-panel  
- `auth/` – auth-guard, helper-invite-acceptance  
- `modals/` – ai-rephrase-modal, image-upload-modal, sla-confirmation-modal  
- `drawers/` – add-helper-drawer, accept-request-drawer, log-time-drawer, end-ticket-drawer, create-sla-drawer  
- `ticket-chat/` – ticket chat feature  

### 5. Typo in auth API

**Issue:** In `src/lib/supabase/auth.ts`, the function is named `intializeAuth` (missing 'i').

**Recommendation:** Rename to `initializeAuth` and update any call sites (if used). **(Done: renamed in auth.ts; no call sites found.)**

---

## Medium priority

### 6. Reduce hardcoded hex colors; use design tokens **(Partially done)**

**Issue:** ARCHITECTURE.md says to avoid hardcoding hex and use design tokens. Many files still use raw hex (e.g. `#554abf`, `#f7f9ff`, `#d1f7ea`, `#4aa19e`, `#f4bccc`, `#5865f2`) for backgrounds, text, borders, and avatars.

**Examples:**  
`settings/payment/page.tsx`, `settings/branding/page.tsx`, `support/chat/page.tsx`, `tickets/page.tsx`, `helper/tickets/page.tsx`, `reports/slas/page.tsx`, `reports/support/page.tsx`, `helpers/page.tsx`, `helpers/[id]/page.tsx`, `slas/[id]/page.tsx`, `helper/support/page.tsx`.

**Recommendation:**
- Add semantic tokens in `globals.css` for recurring palettes (e.g. status success/warning, avatar palette, page background).
- Replace hex in components with token-based classes (e.g. `bg-status-success`, `text-status-success`) or CSS variables. Settings/branding can stay as the place where the *value* of the token is set.

### 7. Tighten TypeScript types (reduce `any`) **(Partially done)**

**Issue:** Several places use `any`, which weakens type safety and refactorability.

**Examples:**
- `create-sla-drawer.tsx`: `onSubmit: (sla: any) => void` – define an SLA payload type.
- `reports/slas/page.tsx`: `(sla as any)?.id`, `(transfer as any)?.sla_id`, etc. – use proper types from DB or API.
- `page.tsx` (dashboard): `aValue: any`, `bValue: any` in sort – use generics or union of possible column types.
- Hooks: `useHelpers.ts`, `useTicketParticipants.ts`, `usePayments.ts`, `useTicketsWithDetails.ts`, `useTicketMessages.ts`, `useTimeEntries.ts`, `useNotifications.ts`, `usePendingRequests.ts` – `any` in mappings and metadata.
- Catch blocks: `err: any` / `error: any` – use `unknown` and narrow (e.g. `err instanceof Error`).

**Recommendation:** Introduce small interfaces/types for API and form payloads; use `unknown` in catch and narrow before use.

### 8. Extract shared status/color mapping **(Done)**

**Issue:** Ticket and report status → badge/color logic is duplicated across multiple pages with the same hex and patterns (e.g. "Completed" → `bg-[#d1f7ea] text-[#4aa19e]`, "In progress" → `bg-[#f7f3d1] text-[#a1944a]`).

**Files:** `tickets/page.tsx`, `helper/tickets/page.tsx`, `reports/support/page.tsx`, `reports/slas/page.tsx`, `helpers/page.tsx`, `helpers/[id]/page.tsx`, etc.

**Recommendation:** Add a small util or constants file, e.g. `src/lib/status-colors.ts`, that exports `getStatusBadgeClass(status: string)` (or similar) and optional status labels. Use design tokens inside that module so one place controls colors. Replace inline mappings with this helper.

### 9. Project identity in package.json **(Done)**

**Issue:** `package.json` still has `"name": "my-v0-project"`.

**Recommendation:** Set a proper name, e.g. `"githelp-support-frontend"` or whatever matches the repo/product, for clarity in logs and deployment.

### 10. README for this project **(Done)**

**Issue:** README is the default Next.js template (generic "Getting Started", "Learn More", "Deploy on Vercel") and doesn’t describe this app or env setup.

**Recommendation:** Add a short project description, prerequisites, env setup (copy `.env.example` → `.env.local`), how to run dev/build, and pointer to ARCHITECTURE.md. Keep or trim the generic Next.js links as needed.

---

## Low priority

### 11. TODO comments and placeholder data

**Issue:** Several TODOs and placeholders indicate incomplete or mock behavior (e.g. "Get actual helper when claimed", "Calculate from actual completion rate", "Map from help categories", "Fetch helper data if ticket is claimed").

**Recommendation:** Before or after publish, either: (a) implement the real behavior and remove TODOs, or (b) add a short "Known limitations" or "Roadmap" section in README/ARCHITECTURE and keep TODOs as-is so readers know what’s intentional.

### 12. Duplicate helper/avatar color arrays **(Partially done)**

**Issue:** Similar arrays of hex colors for avatars/helpers appear in multiple files (`helperColors`, `slaColors`, `colors` in reports, etc.) with small variations.

**Recommendation:** Centralize in one constant (e.g. in `lib/constants.ts` or next to status colors) and import where needed. Then replace with tokens in one place when doing token migration.

### 13. Auth debug logging

**Issue:** `auth.ts` uses `console.log` for auth events and errors. Already covered under “Remove or gate debug logging”; worth calling out because it’s in a security-sensitive path.

### 14. ESLint and formatting

**Issue:** No evidence of pre-commit or CI lint/format. Package has `"lint": "next lint"`.

**Recommendation:** Run `npm run lint` before publish and fix any reported issues. Optionally add a format script (e.g. Prettier) and document or automate it so the codebase stays consistent.

---

## Summary checklist

| Priority | Item | Action |
|----------|------|--------|
| High | Build fails on `docs/` | Exclude `docs` (or limit `include` to `src`) in tsconfig |
| High | Debug logging | Remove or gate console.log; keep intentional console.error |
| High | Env documentation | Add `.env.example` and mention in README |
| High | ARCHITECTURE.md | Update component folder layout (layout/, auth/, modals/, drawers/) |
| High | Auth typo | Rename `intializeAuth` → `initializeAuth` |
| Medium | Hex colors | Introduce tokens and replace hex in components |
| Medium | `any` types | Add SLA/API types; use `unknown` in catch |
| Medium | Status/color duplication | Extract `getStatusBadgeClass` (or similar) and use tokens |
| Medium | package.json name | Set project name |
| Medium | README | Describe app, env, and dev workflow |
| Low | TODOs | Implement or document limitations |
| Low | Color arrays | Centralize and reuse |
| Low | Lint/format | Run lint; consider format script |

Implementing the **High** items will make the project build, easier to onboard to, and aligned with the documented architecture. **Medium** items improve maintainability and consistency with your own design-token and type conventions.
