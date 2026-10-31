# Frontend architecture

This document describes the structure and conventions used in the codebase to keep it maintainable and easy to extend.

## Directory structure

- **`app/`** – Next.js App Router pages and layouts. Keep page components thin; delegate logic to hooks and components.
- **`components/`** – React components.
  - **`ui/`** – Reusable primitives (Button, Input, DrawerPanel, FormField, Sonner, etc.). Prefer single responsibility; use design tokens (e.g. `text-foreground`, `border-border`, `bg-brand-primary`) so themes stay consistent.
  - **`brand/`** – Brand assets (e.g. Logo).
  - **`layout/`** – App shell: app-shell (renders the Sidebar and page frame once), header, sidebar, top-bar, protected-layout, notifications-panel.
  - **`auth/`** – Auth guard and invite flows: auth-guard, helper-invite-acceptance.
  - **`modals/`** – Dialog-style overlays: ai-rephrase-modal, image-upload-modal, sla-confirmation-modal.
  - **`drawers/`** – Side panels: add-helper-drawer, accept-request-drawer, log-time-drawer, end-ticket-drawer, create-sla-drawer.
  - **`ticket-chat/`** – Ticket chat feature. All of these use UI primitives where possible.
- **`contexts/`** – React context providers (user, project selection). Import via `@/contexts` or `@/contexts/user-context`.
- **`hooks/`** – Custom hooks for data and behavior (e.g. `useTickets`, `useNotifications`). Keep hooks focused and reusable.
- **`lib/`** – Utilities, Supabase client, React Query provider, and shared helpers (e.g. `format.ts`, `utils.ts`).
- **`types/`** – Shared TypeScript types (e.g. database types).

## Conventions

1. **Reuse over duplicate** – Use `@/components/ui/*` for buttons, inputs, selects, and the shared `DrawerPanel` for side drawers. Do not add a second Button or inline drawer markup.
2. **Design tokens** – Use the tokens defined in `app/globals.css` as Tailwind classes, never raw values. Type: `text-2xs`, `text-ui`, `text-stat`, `text-title`, `text-display` plus Tailwind's `text-xs`/`text-sm`/`text-base`; weights 400/500/600 only. Radius: `rounded-md` for controls, `rounded-lg` for cards, `rounded-xl` for modals and drawers. Colour: `brand-primary`, `brand-primary-hover`, `brand-foreground`, `text-heading`, `text-secondary`, `text-muted`, `muted-foreground`, `text-tertiary`, `page-muted`, `bg-subtle`, `surface-hover`, `surface-active`, `border-subtle`, `border-control`, `border-avatar`, `support-header`, the status and avatar palettes. Shadows: `shadow-control`, `shadow-soft`, `shadow-popover`, `shadow-modal`, `shadow-tab`. Motion: `duration-fast/base/slow`, `ease-out`, `ease-in-out`. Never hardcode hex, rgba or pixel sizes in components; the only exceptions are colours that come from data (project branding, logos, the avatar palette), third-party brand tiles (Stripe, GitHub) and the chat code-block styles. See "Design tokens" in `CLAUDE.md` for the full table.
3. **Single-purpose components** – Each component should have one clear responsibility. Split large components or pages into smaller pieces.
4. **Context imports** – Always use `@/contexts/...` (or `@/contexts`) so paths stay stable regardless of file location.
5. **Formatting and dates** – Use `@/lib/format` (e.g. `formatRelativeTime`) for relative timestamps and shared date formatting.

6. **Loading, empty and error states** – Use the shared components instead of ad-hoc text: `ListSkeleton` / `PageSkeleton` while a list or page loads, `EmptyState` when a list has nothing to show (keep the existing copy where there is some), `ErrorState` with the query's `refetch` when a React Query `isError` would otherwise show nothing. Tooltips come from `@/components/ui/tooltip`; the provider is mounted once in the root layout.
7. **Lists, cards and controls** – Lists use `ListHeader` and `ListRow`/`listRowClass` from `@/components/ui/list` (pages keep their column grids, sorting and links). `Card` is flat by default (bg-card, border-subtle, rounded-lg, no shadow); don't nest cards. Buttons are h-8 (`sm` h-7, `lg` h-10) and Inputs/Selects h-8. Every interactive element shows a `focus-visible` ring.
8. **Form fields** – Use `FormField` from `@/components/ui/form-field` when you need a label + control + optional hint; pass `label`, `id`, `hint`, and `children` (the input/select/textarea).

## Adding a new drawer or modal

- Use **`DrawerPanel`** from `@/components/ui/drawer-panel` for right-side drawers. Pass `title`, `footer`, and `children`; the panel handles backdrop, header with close button, and layout.
- For modals, use the existing Dialog from `@/components/ui/dialog` or a similar single-purpose wrapper.

## Adding a new page or feature

- Create the page under `app/`. The Sidebar and the page frame come from `AppShell` (root layout); a page renders only `<Header … />` plus a scrolling `<main>` inside a `flex-1 flex flex-col overflow-hidden` column. Add the route to `isShellRoute` in `components/layout/app-shell.tsx` if it is a new top-level section. Put the page's primary action in `Header`'s `actions` prop.
- Add data fetching in a hook under `hooks/` and use it in the page.
- Reuse UI from `components/ui` and, when needed, add new UI primitives there so other features can use them.
