# Follow-up: the frontend builds the welcome, dated with the ticket's creation time

## Decision

The welcome message is no longer expected to come from the backend. The browser builds the welcome bubble, the start note and the auto-reply, and the welcome and start note use the ticket's `created_at` as their timestamp. **No backend migration is needed for this PR.**

The two migrations on the backend branch `agent/slack-5d808efd-change-how-the-welcome-message-the-proje` (`20261123120000_ticket_welcome_messages.sql`, `20261123121000_backfill_ticket_welcome_messages.sql`) are not required and can be dropped. I did not touch the backend repository.

## Backend migration: evaluated

I read both migrations on `agent/slack-5d808efd-change-how-the-welcome-message-the-proje` and checked what this frontend needs from the database. Nothing in them is required:

| Frontend dependency | Where it comes from |
|---|---|
| `tickets.pricing_snapshot` (the per-ticket rate snapshot) | Already on backend `main`: `20261025190000_launch_hardening.sql` adds the column, backfills it and fills it at insert |
| `tickets_messages.metadata` (for `metadata.kind`) | Already on backend `main`: `20260611164416_tickets_messages_metadata.sql` |
| `tickets_messages.is_automatic` | Only in the dropped migration. The frontend never selects it (selecting a missing column would fail the query) and only reads it when a row happens to carry it |
| Welcome / start-note / auto-reply triggers, `format_response_duration`, the message guard changes and the backfill | Only in the dropped migrations. Not used: the browser builds these rows |

Recommendation: close the backend PR without merging. Nothing needs adding or changing on backend `main` for this PR. If it is ever merged, the frontend still works: stored rows of the three kinds are shown instead of the browser-built ones, so they are never shown twice.

Frontend follow-up from this check: `is_automatic` is now optional in `src/types/database.ts`, so the types no longer claim that column always exists, and the comments in `src/lib/ticket-message-summary.ts` and `src/lib/customer-chat-messages.ts` call that migration optional instead of required.

## What changed in this follow-up

The browser-built welcome already existed as a stand-in for all three roles. One gap remained in the customer chat: between creating a ticket and the ticket query loading, the welcome, start note and first message were dated with the time the page was opened, not the ticket's creation time.

- `src/app/support/chat/page.tsx`, `src/app/support/page.tsx`: the `created_at` returned by the ticket insert is kept and used straight away, then replaced by the loaded ticket's (the same value). The welcome and start note are never dated with the page-open time once a ticket exists.
- `src/lib/customer-chat-messages.ts`, `src/app/helper/tickets/[id]/page.tsx`: comments only, describing the browser-built rows as the intended mechanism.
- `CLAUDE.md`: "Chat thread" paragraph rewritten to match.
- `src/types/database.ts`: `tickets_messages.is_automatic` made optional (see above).

## How it works now

| Part | Built by | Timestamp | Content |
|---|---|---|---|
| Welcome + rates | Browser (customer chat and helper/admin ticket page) | Ticket `created_at` | Rates from the ticket's `pricing_snapshot`; the free-support sentence when the ticket is free |
| Start note | Browser | Ticket `created_at` | Fixed text (a shorter one for free support) |
| Auto-reply | Browser | The customer's first message | Average-response-time sentence only when there is a value |

- All three roles see them in the same place, ahead of the claimed banner and every message.
- The first-open entrance (400 ms delay, fade and rise, skipped under `prefers-reduced-motion`) is unchanged.
- If a database does hold stored welcome, start-note or auto-reply rows, they are still shown instead of the browser-built ones. That code is unchanged; say so if you want it removed.

## What this does not give you

The rates are still fixed per ticket: they are held in `tickets.pricing_snapshot`, written at creation, so the welcome keeps showing them after the project changes its prices. A ticket without a snapshot shows the project's current rates.

Because the messages themselves are not stored, the rest of the original task's "stored once" requirement is not met:

- **Project name and welcome wording** are the current ones, not those at creation.
- **The average response time in the auto-reply** is the project's current value, so the sentence can change, appear or disappear between visits.
- There is no automatic-message flag in the database for these three, because there are no rows.

## Tests

`tsc --noEmit`: clean. `npm run test`: 101 files, 929 tests passed.

No new test was added. The existing ones cover the browser-built rows carrying the ticket's creation time in the thread builder and on the helper/admin page; the hand-over of `created_at` from the insert result in the two customer pages is not covered by a test.

## Screenshot: not included

Nobody has watched this change in a browser. Taking the screenshot means signing in and creating a ticket in the hosted database, which I did not do.
