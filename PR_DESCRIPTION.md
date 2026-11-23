# Store the welcome message, start note and auto-reply as real ticket messages

Frontend branch `agent/slack-5d808efd-change-how-the-welcome-message-the-proje` (githelp-support) together with the backend branch of the same name (two new migrations).

**Deploy order: backend migrations first.** The frontend now selects `tickets_messages.is_automatic` and no longer builds any of the three messages itself. Against a database without the migrations those selects fail, and threads would show no welcome, note or auto-reply.

## Findings (before this change)

- The welcome bubble, the "You are not charged anything…" note and the "Thank you for reaching out!" auto-reply did not exist in the database. `buildCustomerThreadMessages` and `CustomerChatIntro` built them in the browser on every render.
- They were therefore built from the project's **live** state: current name, current rates (merged over the ticket snapshot), current free/paid status and current average response time. An old ticket re-rendered with today's values, and its text changed whenever the project changed its settings.
- Their timestamp was "now" (the moment the page was opened), not the time the ticket was created.
- Helpers and admins never saw them: the helper ticket page reads `tickets_messages` only, so the two sides of the same ticket showed different threads.
- `tickets.pricing_snapshot` already existed (added by `20261025190000_launch_hardening.sql`) and billing already used it. Only the chat ignored it as the source of the displayed rates.
- Nothing marked a message as machine-written, so any stored automatic row would have counted as the latest message, as unread and in message counts.

## What changed

### Backend migrations (`backend/supabase/migrations`)

| File | What it does |
|---|---|
| `20261123120000_ticket_welcome_messages.sql` | Adds `tickets_messages.is_automatic`, the unique index `tickets_messages_automatic_once_idx`, the insert/update/delete guards, `format_response_duration()`, and the triggers `tickets_insert_welcome_messages` (welcome + start note on ticket insert) and `tickets_messages_auto_reply` (after the first user message). Automatic rows raise no domain event and never count as a first response. |
| `20261123121000_backfill_ticket_welcome_messages.sql` | Writes the same rows for tickets that already exist. |

Also in the backend branch: `supabase/tests/rls-harness/probes-round14.mjs` (probes `R15a`–`R15g`), `run.mjs` and `results.md`.

### Frontend files

| File | Change |
|---|---|
| `src/components/ticket-chat/welcome-message.tsx` (new) | The welcome block (project avatar, "{project} Team", text, rates or free-support line), shared by the preview and the stored row. |
| `src/lib/ticket-message-summary.ts` (new, with test) | One rule for "what counts as a message" outside the thread: previews, counts, unread dots, `last_read_message_id`. |
| `src/hooks/usePrefersReducedMotion.ts` (new) | For the JS-timed first-open entrance. |
| `src/lib/customer-chat-messages.ts` | Removes `TICKET_DISCLAIMER`, `TICKET_DISCLAIMER_FREE` and `buildAutoReply`; adds `isThreadOpener` and `parseStoredWelcome`; the thread is built from stored rows only. |
| `src/lib/ticket-pricing.ts` | `parseWelcomeRates` reads `metadata.rates`; no fallback to live rates. |
| `src/lib/chat-thread.ts` | Automatic rows and the welcome always start a new group. |
| `src/components/ticket-chat/ticket-chat.tsx`, `customer-chat-intro.tsx` | Render the stored welcome row; `welcomeProject` and `firstOpenEntrance` props; the intro is now only the pre-ticket preview. |
| `src/app/support/page.tsx`, `src/app/support/chat/page.tsx` | Preview from live settings before a ticket exists, stored rows afterwards; no more `useProjectAverageResponseTime` in the thread. |
| `src/app/helper/tickets/[id]/page.tsx` | Shows the stored welcome and start note at the top, as the customer sees them; rates are not repeated in "Info about issue". |
| `src/hooks/useHelperTickets.ts`, `useHelperRecentTicketInteractions.ts`, `useUserRecentTicketInteractions.ts`, `useTicketsWithDetails.ts` | Skip the three automatic kinds in previews, counts and unread state. |
| `src/types/database.ts` | `tickets.pricing_snapshot`, `tickets_messages.is_automatic`. |
| `CLAUDE.md` | "Chat thread" paragraph describes the stored welcome/automatic messages. |
| Tests | `ticket-chat.test.tsx`, `customer-chat-intro.test.tsx`, `customer-chat-messages.test.ts`, `chat-thread.test.ts`, `ticket-message-summary.test.ts`, helper page tests. |

## How the data is stored

### Rate snapshot

- `tickets.pricing_snapshot` (jsonb, prices in cents) stays the single source. It is filled when the ticket is inserted and is what billing charges from. This PR does not change it.
- The welcome row copies it once, in the `AFTER INSERT` trigger on `tickets`, into its own `metadata`:

```json
{
  "kind": "welcome",
  "project_name": "Project One",
  "rates": {
    "ticket_start_price": 500,
    "ticket_price_minute_first_60": 50,
    "ticket_price_minute_after_60": 25,
    "currency": "usd",
    "is_free": false
  },
  "rates_source": "ticket_snapshot"
}
```

- `is_free` is true when the snapshot exists and all three prices are ≤ 0 (a missing price counts as 0), the same rule as `isFreeSupport` in the frontend and in `_shared/payments/hold-amount.ts`. A free welcome also stores `free_text`; the start note stores `is_free` too and uses the free wording.
- `currency` is `usd` unless the snapshot carries one. Snapshots carry none today, because `projects_payment_settings` has no currency column.
- The frontend reads only this metadata (`parseStoredWelcome` → `parseWelcomeRates`). A welcome row without rates shows no Rates section; it never falls back to live settings.

### Automatic marking

- All three rows: `sender_type = 'system'`, `sender_id = null`, `is_automatic = true`, and `metadata.kind` = `welcome` | `start_note` | `auto_reply`.
- `created_at`: welcome = ticket `created_at`; start note = +1 ms; auto-reply = first user message +1 ms. The auto-reply stores the average response time of that moment in its text and as `metadata.avg_response_seconds`, only when a value exists.
- `is_automatic` is server-only. A client insert is always stored with `is_automatic = false` (and loses its metadata), clients cannot edit or delete automatic rows, and one row per `(ticket_id, kind)` is enforced by the unique index. Every other server-written system message is also flagged `is_automatic = true`, so the frontend keys on `is_automatic` **and** the three kinds: payment, time-logged and guest notices still count as messages.

## Backfill

Source of the rates, per ticket without a welcome row, in this order:

1. `tickets.pricing_snapshot` → `rates_source: "ticket_snapshot"`
2. no snapshot: the project's current `projects_payment_settings` → `rates_source: "project_settings_fallback"`
3. neither → `rates: null`, `rates_source: null` (the welcome shows no rates)

Every backfilled row has `metadata.backfilled = true`. The backfilled auto-reply (only on tickets that already have a user message) has no response-time sentence, because the value the customer saw then is unknown. The backfill is idempotent and runs with user triggers off, so it creates no notifications, domain events, first-response times or unread changes.

Caveat: for tickets older than `20261025190000_launch_hardening.sql`, `ticket_snapshot` means the project's prices on the day that migration ran, not on the day the ticket was opened. That migration filled the snapshot of every existing ticket from the live settings.

### Affected ticket counts

**Not measured on a real database.** No local Supabase could be started in the environment this was prepared in (no Docker, Supabase CLI or `psql`), and the only configured database is the hosted project, which was not touched. Expected: every existing ticket gets a welcome and a start note, and every ticket with a user message gets an auto-reply. The read-only counting queries are at the bottom of the backfill migration; run them after applying it and fill in:

| Query | Result |
|---|---|
| Tickets backfilled, per `rates_source` | _to fill in_ |
| Tickets backfilled without rates | _to fill in_ |
| Backfilled rows per kind | _to fill in_ |
| `ticket_snapshot` tickets older than launch_hardening | _to fill in_ |
| Tickets without a welcome (must be 0) | _to fill in_ |

What was run instead: the backfill against the embedded PGlite harness database (all migrations applied, harness seed), with the trigger-written rows removed and four legacy-style tickets added. This is a test database, not real data.

| Check | Result |
|---|---|
| Tickets before the backfill | 6 (3 with a user message) |
| Backfilled rows | 6 welcome, 6 start note, 3 auto-reply |
| Per `rates_source` | 4 `ticket_snapshot`, 1 `project_settings_fallback`, 1 without rates |
| Tickets without a welcome afterwards | 0 |
| Timestamps | welcome at `created_at`, note +1 ms, auto-reply 1 ms after the first user message: all true |
| Second run | 0 rows inserted; all triggers enabled again |

## Billing check

- **Code read:** billing resolves prices through `resolveTicketPricing` (`_shared/payments/pricing.ts`, used by `capture-ticket.ts`) from `tickets.pricing_snapshot`; neither migration writes to `tickets`. The payment functions that read `tickets_messages` (`payments-authorize-on-claim`, `payments-rehold-tick`, `pending-tickets.ts`, `sla-usage.ts`, `system-messages.ts`) match on their own `metadata.kind` values (`payment_required`, `payment_authorized`, the SLA usage marker), which the three new kinds do not collide with.
- **Harness:** in the PGlite run above, all 56 public tables were hashed before and after the backfill, leaving out only the new welcome/start-note/auto-reply rows. No table changed: `payments`, `tickets` (including `pricing_snapshot` and `first_response_at`), `tickets_participants` (`last_read_message_id`) and `domain_events` are identical.
- **Not done:** no end-to-end charge (hold → capture with Stripe) was run on a ticket created after the migrations.

## Verification

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 2 warnings (`no-img-element` in `helper/settings/payout/page.tsx` and `settings/payment/page.tsx`, both files untouched by this PR) |
| `npm run test` | 100 files, 910 tests passed |
| `npx next build` | Compiled successfully |
| RLS harness (PGlite), re-run with both migrations | 822 PASS / 0 FAIL; `20261123120000`: 21 statements ok; `20261123121000`: 1 ok |

The harness was re-run from a temporary copy. The committed `results.md` in the backend branch predates the backfill file and does not list it; re-run `node run.mjs` there before merging.

### Screen capture and screenshots: not included

The requested screen capture (opening a newly created chat: empty thread, welcome appearing above the composer, first message, stored auto-reply) and the screenshots of a backfilled ticket (light mode, as User and as Helper) are **missing**. They need a local Supabase with the two migrations applied, and none could be started (see above). The behaviour is covered only by unit tests (`ticket-chat.test.tsx`, helper page test) and the database probes; nobody has watched it in a browser yet.

To record them: `supabase start` in `backend`, `supabase db reset` (applies both migrations), point the frontend `.env.local` at the local URL and anon key, then:

1. As a user, open `/support/chat?project=<id>`: empty thread, welcome fades in after 400 ms, send a message, the auto-reply appears as a stored row.
2. Open a ticket created before the migrations, as the user (`/support/chat?ticket=<id>`) and as a helper (`/helper/tickets/<id>`): welcome and start note at the top with the ticket's creation time.

## Open question: the pre-ticket preview

Before a ticket exists there is no row to show, so the chat still shows a **preview** of the welcome, built in the browser from the project's live settings (`CustomerChatIntro`). When the first message creates the ticket, the stored rows replace it. Three things can differ between the two:

- **Time:** the preview shows the time the page was opened; the stored welcome shows the ticket's `created_at`. The time visibly changes if the customer waited before writing.
- **SLA wording:** on `/support/chat` the preview says "This ticket is covered by your SLA." when an SLA applies. The stored welcome never has that sentence, so it disappears once the ticket exists.
- **Missing rates:** the preview shows a "Rates not configured" card; a stored welcome without rates shows no Rates section.

Should the preview stay as it is (live, replaced by the stored row), or should it be reduced to something that cannot differ, for example no timestamp and no SLA sentence, or should the SLA sentence be stored in the welcome row too?

## Notes for review

- The header comment of `20261123120000_ticket_welcome_messages.sql` still says "Existing tickets are not backfilled". That is out of date now that `20261123121000` exists.
- The backfill uses the project's current name, also for soft-deleted projects.
