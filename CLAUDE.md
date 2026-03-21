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
| Fonts           | Open Sans (body), Geist Mono (mono)           |

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

- **Provider chain:** `ReactQueryProvider` → `UserProvider` → `ProjectProvider` → `ProtectedLayout`
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
