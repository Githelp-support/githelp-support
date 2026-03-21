# Frontend architecture

This document describes the structure and conventions used in the codebase to keep it maintainable and easy to extend.

## Directory structure

- **`app/`** – Next.js App Router pages and layouts. Keep page components thin; delegate logic to hooks and components.
- **`components/`** – React components.
  - **`ui/`** – Reusable primitives (Button, Input, DrawerPanel, FormField, Sonner, etc.). Prefer single responsibility; use design tokens (e.g. `text-foreground`, `border-border`, `bg-brand-primary`) so themes stay consistent.
  - **`brand/`** – Brand assets (e.g. Logo).
  - **`layout/`** – App shell: header, sidebar, protected-layout, notifications-panel.
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
2. **Design tokens** – Prefer semantic Tailwind tokens (`foreground`, `muted-foreground`, `border`, `primary`) and the custom tokens in `app/globals.css`: `brand-primary`, `border-subtle`, `text-heading`, `text-muted`, `bg-subtle`, `text-tertiary`, `support-header`. Use them as Tailwind classes (e.g. `text-brand-primary`, `bg-support-header`). Avoid hardcoding hex in components.
3. **Single-purpose components** – Each component should have one clear responsibility. Split large components or pages into smaller pieces.
4. **Context imports** – Always use `@/contexts/...` (or `@/contexts`) so paths stay stable regardless of file location.
5. **Formatting and dates** – Use `@/lib/format` (e.g. `formatRelativeTime`) for relative timestamps and shared date formatting.

6. **Form fields** – Use `FormField` from `@/components/ui/form-field` when you need a label + control + optional hint; pass `label`, `id`, `hint`, and `children` (the input/select/textarea).

## Adding a new drawer or modal

- Use **`DrawerPanel`** from `@/components/ui/drawer-panel` for right-side drawers. Pass `title`, `footer`, and `children`; the panel handles backdrop, header with close button, and layout.
- For modals, use the existing Dialog from `@/components/ui/dialog` or a similar single-purpose wrapper.

## Adding a new page or feature

- Create the page under `app/` and use existing layout (e.g. `ProtectedLayout`, support layout).
- Add data fetching in a hook under `hooks/` and use it in the page.
- Reuse UI from `components/ui` and, when needed, add new UI primitives there so other features can use them.
