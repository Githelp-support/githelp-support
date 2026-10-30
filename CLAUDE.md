# Frontend — githelp-support

Next.js 16 (App Router) with React 19, Supabase backend at `../backend`.

## Tech Stack

| Layer           | Technology                                    |
|-----------------|-----------------------------------------------|
| Framework       | Next.js 16 (App Router, file-based routing)   |
| Language        | TypeScript (strict mode)                      |
| Styling         | Tailwind CSS v4 + CSS variables (light/dark)  |
| UI Components   | Radix UI primitives + shadcn-style (`src/components/ui/`) |
| State           | React Query (server state) + React Context (client state) |
| Auth            | Supabase Auth (GitHub, Google, Discord, Slack, Microsoft, email OTP) |
| Forms           | React Hook Form + Zod validation              |
| Data Fetching   | Supabase client + `supabase.functions.invoke()` for Edge Functions |
| Realtime        | Supabase subscriptions (tickets, messages)     |
| Testing         | Vitest + React Testing Library                |
| Icons           | Lucide React, Flaticon UIcons                 |
| Fonts           | Inter (body), Geist Mono (mono), Outfit (avatar initials) |

## Design tokens

All tokens live in `src/app/globals.css` (`@theme` + `:root`/`.dark`). Use them as Tailwind classes.

**Rule:** Never hardcode hex, rgba or pixel sizes in components. Use tokens. Allowed exceptions: colours from data (project branding `primary_color`, logos, the avatar palette from `getAvatarColorHexForId`), third-party brand tiles (Stripe, GitHub), and the chat code-block styles in `globals.css`.

| Group | Tokens |
|-------|--------|
| Type scale | `text-2xs` 11/14 (count badges only), `text-xs` 12/16, `text-ui` 13/18 (sidebar, table cells, buttons, secondary text, header subtitles), `text-sm` 14/20, `text-base` 16/24, `text-stat` 22/28 (KPI numbers, with `tabular-nums`), `text-title` 24/32 −0.01em (page titles), `text-display` 30/36 −0.02em (public support welcome page only). Weights: 400, 500 (`font-medium`), 600 (`font-semibold`) only. |
| Radius | `rounded-sm` 4px, `rounded-md` 6px (controls), `rounded-lg` 8px (cards), `rounded-xl` 12px (modals, drawers). Avatars and icon tiles use the proportional squircle map in `lib/constants`. |
| Colour | `brand-primary` #554ABF, `brand-primary-hover` #4A3FA3, `brand-foreground` #fff; text: `foreground` #2E2D31, `text-heading`, `text-secondary` #444, `text-muted` #55555D, `muted-foreground` (#737373), `text-tertiary` #666B77; surfaces: `background`, `card`, `page-muted` #F7F9FF, `bg-subtle` #F6F6F6, `sidebar`, `surface-hover` rgba(0,0,0,.04), `surface-active` rgba(0,0,0,.08); borders: `border-subtle` #E1E1E1, `border-control` rgba(0,0,0,.1), `border-avatar` #E1E4EA; status: `status-success-*`, `status-warning-*`, `status-high-*`; avatar palette `avatar-1…9`. |
| Shadow | `shadow-control` (button inset + hairline), `shadow-soft` (0 4px 15px rgba(134,140,152,.2)), `shadow-popover`, `shadow-modal`, `shadow-tab` (active tab glow). |
| Motion | `duration-fast` 120ms, `duration-base` 180ms, `duration-slow` 240ms; `ease-out` cubic-bezier(0.16,1,0.3,1), `ease-in-out` cubic-bezier(0.65,0,0.35,1). A global `prefers-reduced-motion` rule makes animations and transitions near-instant. |

## Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── auth/             # Sign-in, confirmed
│   ├── helper/           # Helper views (tickets, profile, reports)
│   ├── helpers/          # Helpers list
│   ├── invite/[token]/   # Invite acceptance
│   ├── onboarding/       # Onboarding flow
│   ├── projects/[id]/    # Project pages
│   ├── reports/          # Reports
│   ├── settings/         # Settings
│   ├── slas/             # SLA management
│   ├── support/[slug]/   # Public support (chat, tickets, get-support)
│   └── tickets/          # Ticket views
├── components/
│   ├── ui/               # Reusable primitives (shadcn-style)
│   ├── auth/             # AuthGuard, invite acceptance
│   ├── brand/            # Logo
│   ├── drawers/          # Slide-out panels
│   ├── layout/           # Sidebar, Header, ProtectedLayout, notifications
│   ├── modals/           # Dialogs (image upload, AI rephrase, SLA)
│   ├── payment/          # Distribution preview
│   └── ticket-chat/      # Chat components
├── contexts/             # UserProvider, ProjectProvider
├── hooks/                # React Query hooks (useProject, useTickets, etc.)
├── lib/
│   ├── supabase/         # Client init + auth helpers
│   ├── react-query/      # QueryClient provider + defaults
│   ├── utils.ts          # cn() helper (clsx + tailwind-merge)
│   ├── format.ts         # Formatting utilities
│   └── constants.ts      # App-wide constants
└── types/
    └── database.ts       # Supabase Database type (manually maintained)
```

## Conventions

- **Path alias:** `@/*` maps to `./src/*`
- **Client components:** Add `"use client"` when using hooks, state, or browser APIs
- **Hooks:** Named `use*.ts` in `src/hooks/`, wrapping React Query `useQuery`/`useMutation`
- **Contexts:** Named `*Provider` in `src/contexts/`
- **Class merging:** Always use `cn()` from `@/lib/utils` for conditional Tailwind classes
- **Component variants:** Use `class-variance-authority` (cva) for variant-driven components
- **Button variants:** `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `lavender`
- **Data attributes:** `data-slot` for styling hooks on UI primitives
- **Shared states (use these; don't build ad-hoc versions):** `Tooltip`/`TooltipTrigger`/`TooltipContent` from `components/ui/tooltip` (one `TooltipProvider` lives in the root layout; collapsed sidebar items and `Header`'s `info` prop use it); `Skeleton`, `ListSkeleton` (4–5 placeholder rows for a loading list) and `PageSkeleton` (route-level loading inside the shell) from `components/ui/skeleton`; `EmptyState` (tinted squircle icon tile, title, optional one-line description and action) from `components/ui/empty-state`; `ErrorState` (same layout plus a "Try again" button wired to the query's `refetch`) from `components/ui/error-state`. Keep `Loader2` only inside buttons, the chat composer, image upload and small inline actions.

## Scripts

| Command          | What it does                    |
|------------------|---------------------------------|
| `npm run dev`    | Start Next.js dev server        |
| `npm run build`  | Production build                |
| `npm run start`  | Serve production build          |
| `npm run lint`   | ESLint check                    |
| `npm run lint:fix` | ESLint auto-fix               |
| `npm run test`   | Run Vitest (single run)         |
| `npm run test:watch` | Run Vitest in watch mode    |

## Key Things to Know

- **Provider chain:** `ReactQueryProvider` → `UserProvider` → `ProjectProvider` → `ProtectedLayout` → `UnsavedChangesProvider` → `TopBar` + `AppShell`
- **App shell:** `components/layout/app-shell.tsx` renders the `Sidebar` and the page frame once, in the root layout, for every app route (`isShellRoute`). New pages never render `<Sidebar />` or an `h-screen` wrapper themselves: a page returns `<div className="flex-1 flex flex-col overflow-hidden"><Header … /><main className="flex-1 overflow-y-auto px-8 py-6">…</main></div>`. Loading, error and empty branches render inside the same frame. Support pages publish the sidebar's "Open project page" link with `useSetProjectPageHref(href)`.
- **Header:** `components/layout/header.tsx` is the standard page header (title `text-title`, subtitle `text-ui`, hairline below, sticky). Put a page's primary action in its `actions` prop instead of at the top of the content.
- **Page layout:** content gutters `px-8 py-6`, 32px between sections. List pages use the full width up to `max-w-7xl`; settings pages use a `max-w-3xl` column with sections separated by hairline dividers.
- **Auth guard:** `AuthGuard` checks `supabase.auth.getSession()` and redirects unauthenticated users to `/auth/signin`
- **Onboarding redirect:** `useOnboardingStatus` sends new users to `/onboarding` or `/onboarding/waiting`
- **React Query defaults:** staleTime 3 hours, retry 1, refetchOnWindowFocus enabled (see `src/lib/react-query/provider.tsx`)
- **Realtime:** `useRealtimeMessages` and `useRealtimeTickets` subscribe to Supabase channels and invalidate React Query caches on changes
- **Tab lock:** Custom `inTabLock` utility prevents Supabase auth deadlocks during tab suspension
- **Database types:** `src/types/database.ts` defines `Database` — access row types via `Database["public"]["Tables"]["table_name"]["Row"]`
- **Edge Functions:** Called via `supabase.functions.invoke("function-name", { body })` — function source lives in `../backend`

## Environment Variables

Defined in `.env.local` (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase public anon key

All client-accessible vars must use the `NEXT_PUBLIC_` prefix.

## Testing

- Tests use Vitest with jsdom environment and React Testing Library
- Test files: `*.test.{ts,tsx}` colocated with source
- Setup: `vitest.setup.ts` loads jest-dom matchers and cleanup
- Run: `npm test` (single) or `npm run test:watch` (watch mode)
