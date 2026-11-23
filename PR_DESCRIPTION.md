# Follow-up: the frontend builds the welcome, dated with the ticket's creation time

## Decision

The welcome message is no longer expected to come from the backend. The browser builds the welcome bubble, the start note and the auto-reply, and the welcome and start note use the ticket's `created_at` as their timestamp. **No backend migration is needed for this PR.**

The two migrations on the backend branch `agent/slack-5d808efd-change-how-the-welcome-message-the-proje` (`20261123120000_ticket_welcome_messages.sql`, `20261123121000_backfill_ticket_welcome_messages.sql`) are not required and can be dropped. I did not touch the backend repository.

## Needs a decision: two follow-ups disagree

- Follow-up 3c3dff9 asked for the frontend to render the welcome itself, with no backend-stored welcome message.
- Follow-up d43cf88 asked to check the backend migration and update it so it supports the stored welcome message, the automatic-message flag, the rate snapshot and the backfill.

This PR follows 3c3dff9: the browser builds the three rows, and both backend migrations are recommended for dropping. If d43cf88 wins, the backend migrations on `agent/slack-5d808efd-change-how-the-welcome-message-the-proje` should be kept and merged. The frontend already shows stored rows instead of the browser-built ones, so no frontend change is needed either way. **Please confirm which one applies before merging.**

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

## Rate snapshot for existing tickets (task step 4)

- **Source:** `20261025190000_launch_hardening.sql` on backend `main` adds `tickets.pricing_snapshot` and backfills every ticket that has none with the project's `projects_payment_settings` row *at the time the migration ran* (`to_jsonb(s) - 'created_at' - 'updated_at'`). It first inserts a default settings row for projects that had none, so every ticket with a project gets a snapshot. It then adds `tickets_pricing_snapshot_present` (`check (pricing_snapshot is not null) not valid`), and a `before insert` trigger fills the snapshot from the live settings on every new ticket. So for tickets that existed before that migration, the "snapshot" is the project's rates on the migration date, not necessarily the rates in force when the ticket was opened.
- **Tickets without a snapshot:** I could not count them. This environment cannot reach the hosted database, so I have no number. After the backfill and the insert trigger the expected count is 0. To check, run:

  ```sql
  select count(*) from public.tickets where pricing_snapshot is null;
  ```

  Any ticket this returns shows the project's current rates in the welcome (the frontend fallback).

## Billing: ticket rates or current project rates? (task step 5)

Billing uses the **ticket's** rates. Every capture, rehold, hold estimate, split, free-support check and payout goes through `resolveTicketPricing` (`supabase/functions/_shared/payments/pricing.ts` on backend `main`), called from `capture-ticket.ts`, `redistribute.ts`, `transfers.ts`, `ticket-card-setup.ts`, `setup-intent-succeeded.ts`, `payments-authorize-on-claim`, `payments-create-checkout-for-ticket` and `payments-rehold-tick`. It merges `tickets.pricing_snapshot` over the live `projects_payment_settings`: a value in the snapshot always wins, and the live settings are used only for a ticket with no snapshot (or a key missing from it). The welcome shows the same source (snapshot first, live settings only without one), so what the customer is shown matches what they are billed.

## What changed in this follow-up

The browser-built welcome already existed as a stand-in for all three roles. One gap remained in the customer chat: between creating a ticket and the ticket query loading, the welcome, start note and first message were dated with the time the page was opened, not the ticket's creation time.

- `src/app/support/chat/page.tsx`, `src/app/support/page.tsx`: the `created_at` returned by the ticket insert is kept and used straight away, then replaced by the loaded ticket's (the same value). The welcome and start note are never dated with the page-open time once a ticket exists.
- `src/lib/customer-chat-messages.ts`, `src/app/helper/tickets/[id]/page.tsx`: comments only, describing the browser-built rows as the intended mechanism.
- `CLAUDE.md`: "Chat thread" paragraph rewritten to match.
- Comments in `src/lib/ticket-pricing.ts`, `src/lib/chat-thread.ts`, `src/components/ticket-chat/ticket-chat.tsx` and the tests (`new-ticket-welcome.test.tsx`, `ticket-message-summary.test.ts`) no longer say a server trigger writes these rows or refer to the dropped migrations' functions.
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

## Screen recording and screenshot: not included

The task asks for both, and neither is attached. Nobody has watched this change in a browser. Recording it means signing in and creating a ticket against the hosted database, which this environment cannot reach. Someone with access needs to record creating a ticket on `/support/chat` (welcome, start note, first message, auto-reply) and take a screenshot of the same ticket on the helper ticket page before merging.

## About this file

This text is meant for the PR body. `PR_DESCRIPTION.md` is not on `main`; delete it from the branch once its content is in the PR description.
