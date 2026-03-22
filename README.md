# Githelp Support

A support ticket and team collaboration platform built with Next.js. Manage support requests, assign helpers, track SLAs, and generate reports — all in one place.

## Features

- **Ticket management** — Create, assign, and track support requests with real-time updates
- **Helper system** — Invite team members as helpers with role-based permissions
- **SLA tracking** — Define and monitor support level agreements
- **Project-based organization** — Organize work across multiple projects with invites and roles
- **Reporting** — Built-in reporting and analytics
- **Real-time chat** — Live messaging on tickets via Supabase subscriptions
- **Multi-provider auth** — Sign in with GitHub, Google, Discord, Slack, Microsoft, or email OTP

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI | Radix UI + shadcn-style components |
| State | React Query (server) + React Context (client) |
| Auth | Supabase Auth |
| Forms | React Hook Form + Zod |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Testing | Vitest + React Testing Library |

## Prerequisites

- Node.js 18+
- npm
- A [Supabase](https://supabase.com) project (or local Supabase via CLI)

## Setup

1. Clone the repo and install dependencies:

   ```bash
   git clone https://github.com/your-org/githelp-support.git
   cd githelp-support/frontend
   npm install
   ```

2. Copy the example env file and add your Supabase credentials:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and set:

   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL (Settings > API)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon/public key

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Local Supabase (optional)

To run the backend locally instead of connecting to a hosted Supabase project:

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli)
2. From the `backend/` directory, run `supabase start`
3. Use the local URL and anon key printed by the CLI in your `.env.local`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run test` | Run tests (single run) |
| `npm run test:watch` | Run tests in watch mode |

## Project structure

See [src/ARCHITECTURE.md](src/ARCHITECTURE.md) for the full directory layout, conventions, and guides for adding pages, drawers, and modals.

## Contributing

We welcome contributions. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before getting started.

## Code of conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
