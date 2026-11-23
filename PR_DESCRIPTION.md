# Follow-up: welcome, rates and notes missing on a brand-new ticket

## What caused it

**The database has not had the welcome migration applied.** Nothing is stored when a ticket is created, so there was nothing to show wherever the page relies on stored rows.

Checked with a read-only request (anon key) against the Supabase project in the frontend's `.env` (`rbpwwcsvhmbmfiphokrm`):

| Request | Result |
|---|---|
| `tickets_messages?select=is_automatic` | `42703 column tickets_messages.is_automatic does not exist` |
| `tickets?select=pricing_snapshot` | 200 (the column exists) |

I could not confirm which Supabase project the deploy preview itself points at; if it is this one, the above is its state.

Investigated in the order asked:

1. **Creation.** The frontend does not write the welcome, the rate snapshot or the notes itself: the database triggers `tickets_insert_welcome_messages` and `tickets_messages_auto_reply` do (backend migration `20261123120000_ticket_welcome_messages.sql`), for both creation paths (`/support/chat` and the project landing page `/support`, which both insert through `useCreateTicket`). That migration, and the backfill `20261123121000`, exist only on the backend branch `agent/slack-5d808efd-change-how-the-welcome-message-the-proje`; they are not on backend `main` and not in the database. No error is thrown or swallowed: without the triggers the ticket insert simply succeeds with no welcome rows. `tickets.pricing_snapshot` is older and is there, so the ticket's rate snapshot itself is stored.
2. **Loading.** `useTicketMessages` selects `*` with no filter on automatic rows, so stored rows would reach the page. But five list hooks selected the missing `is_automatic` column, which fails the whole request: on this database, message previews, message counts and unread dots came back empty, and the two "recent interactions" queries errored.
3. **Rendering.** The helper/admin ticket page rendered stored rows only, so Helper and Admin saw no welcome, rates or notes on any ticket. The customer chat has had stand-ins since the previous follow-up, except when the messages request itself failed on a reopened ticket. The entrance delay cannot leave the openers hidden: it is one 400 ms timer that re-renders do not restart, and it is skipped under `prefers-reduced-motion` (now covered by tests, below).

## What changed

- `src/app/helper/tickets/[id]/page.tsx`: a ticket without a stored welcome, start note or auto-reply now shows the same stand-ins as the customer chat, once the ticket and its messages have loaded: welcome with the ticket's snapshot rates (the project's settings only when the ticket has no snapshot) or the free-support sentence, start note at the ticket's creation time, auto-reply after the first user message (response-time sentence only with a real value). A stored row always replaces its stand-in.
- `src/lib/ticket-message-summary.ts`: list queries no longer select `is_automatic` (`AUTOMATIC_MESSAGE_COLUMNS` is now `sender_type, sender_id, metadata`). A row counts as automatic when it is server-written (`is_automatic` if the row carries it, otherwise a system row without a sender) and its kind is welcome, start note or auto-reply. Previews, counts and unread dots work with or without the migration.
- `src/app/support/page.tsx`, `src/app/support/chat/page.tsx`: the stand-ins also apply when the messages request fails.
- `CLAUDE.md`: "Chat thread" paragraph updated.

The stand-ins are built in the browser, so until the migration is applied they are not what the original task asked for (stored once, same row for everyone). They only keep the welcome, rates and notes visible.

## What must be run for the deploy preview

Apply the two backend migrations from the backend branch, in order:

1. `20261123120000_ticket_welcome_messages.sql`
2. `20261123121000_backfill_ticket_welcome_messages.sql`

After that, new tickets get stored rows from the triggers, existing tickets get them from the backfill, and the stored rows replace the stand-ins with no frontend change. I did not apply them: I have no write access to that database, and it may hold production data.

## Tests

- New `src/components/ticket-chat/new-ticket-welcome.test.tsx`: creates a ticket and follows it from first open to after the first message, against a database with the migration (rows stored) and one without (nothing stored). In both, the welcome, the rates, the start note and the auto-reply are shown once each, in order; the rates stay the ticket's when the project changes its prices; a free project shows the free-support sentence. It also checks what is stored (welcome at creation time with the rate snapshot, note +1 ms, auto-reply +1 ms after the first message, all marked automatic), and that the entrance still reveals the openers after re-renders during the delay, after a remount, and immediately under `prefers-reduced-motion`.
- The database in that test is an in-memory fake that mirrors the triggers. The real triggers are covered by the backend harness probes `R15a`–`R15g` on the backend branch; no test here ran against a real database.
- `src/app/helper/tickets/[id]/page.test.tsx`: stand-ins on the helper/admin page (snapshot rates, free sentence, order, no animation, waits for messages, stored row wins). One existing grouping test now uses two helper messages, because the customer's first message is followed by the auto-reply.
- `src/lib/__tests__/ticket-message-summary.test.ts`: the automatic rule without the `is_automatic` column.

`npm run test`: 101 files, 929 tests passed. `tsc --noEmit` and ESLint on the touched folders: clean.

## Screenshot: not included

The requested screenshot of a newly created ticket is missing. Taking it means signing in and creating a ticket in the hosted database (the only one configured; no local Supabase is available here), which I did not do. Nobody has watched this change in a browser yet.
