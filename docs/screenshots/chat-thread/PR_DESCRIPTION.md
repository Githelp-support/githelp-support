# Buyer ticket chat: grouped thread, day dividers, "Note ·" rows, auto-growing composer, compact right panel

Restyles the buyer-facing ticket chat (`/support/chat?ticket=…` and the chat on `/support`). The helper ticket page is not part of this change.

## What changed

- **Thread:** consecutive messages from one sender (same day, less than 5 minutes apart) share one header (avatar, name, `HH:MM`); a day divider ("Today" / "Yesterday" / "Sunday 15 November") opens each day; the thread sits directly on the page instead of in a card. Chat avatars are 30px.
- **System messages:** plain grey boxes became unboxed "**Note** · …" rows with an info icon in the avatar column, in the new `text-note` colour.
- **Header:** the ticket ID is a short pill with a copy button beside the title; "End session" is an outline button in the header instead of the composer toolbar.
- **Composer:** starts at one line and grows with the text up to 200px, then scrolls; the placeholder is "Ask #slug".
- **Right panel:** empty sections read "No helper has joined yet." / "No other topics yet." instead of "-"; active tickets are two lines (subject, then project · short ID · short date).

## Two scope decisions to confirm

1. **Coloured payment and status callouts keep their styling.** Only the plain grey system boxes became "Note ·" rows. The green, amber, red and bordered callouts (payment authorised, action required, failed, and so on) keep their coloured box, now aligned to the text column.
2. **Composer auto-grow is opt-in.** `TicketChatInput` only grows with the new `autoGrow` prop, which `TicketChat` passes. The helper ticket page renders `TicketChatInput` without it and keeps the fixed 100px minimum, so it is unchanged.

## Not changed

Nothing changed in message storage, welcome-message timing or unread tracking. The diff does not touch any `localStorage`/`sessionStorage` key, when the welcome and auto-reply messages appear, or last-read updates.

## Components

This list is reconstructed from the code on this branch; the first subtask's own write-up was not available to this step.

| Component | Where | Change |
|-----------|-------|--------|
| `TicketChat` | `components/ticket-chat/ticket-chat.tsx` | Grouping, day dividers, note rows, ID pill, "End session" in the header, panel empty states, no card around the thread |
| `ChatDayDivider` (new, internal) | `components/ticket-chat/ticket-chat.tsx` | Day label between messages |
| `TicketIdPill` (new) | `components/ticket-chat/ticket-id-pill.tsx` | Short ticket ID with a copy button |
| `TicketChatInput` | `components/ticket-chat/chat-input.tsx` | `autoGrow` prop, off by default |
| `CustomerChatIntro` | `components/ticket-chat/customer-chat-intro.tsx` | 30px avatar, semibold name, `HH:MM` time from tokens, welcome text in `text-foreground` |
| `CustomerTicketSidebarFooter` | `components/ticket-chat/customer-sidebar-footer.tsx` | Two-line active tickets |
| `ProfileAvatar` | `components/ui/profile-avatar.tsx` | New `size="chat"` preset (30px, `SQUIRCLE_RADIUS[30]`) |
| `groupChatMessages` (new helper) | `lib/chat-grouping.ts` | Turns the message list into day dividers and sender groups |

## Files changed

| File | Change |
|------|--------|
| `src/components/ticket-chat/ticket-chat.tsx` | Thread, header and right-panel restyle |
| `src/components/ticket-chat/ticket-chat.test.tsx` (new) | Component tests for the above |
| `src/components/ticket-chat/ticket-id-pill.tsx`, `ticket-id-pill.test.tsx` (new) | ID pill and its tests |
| `src/components/ticket-chat/chat-input.tsx`, `chat-input.test.tsx` | `autoGrow` and its tests |
| `src/components/ticket-chat/customer-chat-intro.tsx`, `customer-chat-intro.test.tsx` | Intro row restyle and test |
| `src/components/ticket-chat/customer-sidebar-footer.tsx`, `customer-sidebar-footer.test.tsx` (new) | Two-line active tickets and tests |
| `src/components/ui/profile-avatar.tsx` | `chat` size |
| `src/lib/chat-grouping.ts`, `src/lib/__tests__/chat-grouping.test.ts` (new) | Grouping helper and tests |
| `src/lib/format.ts`, `src/lib/__tests__/format.test.ts` | `formatTime`, `formatDayLabel`, `formatShortDate`, `shortTicketId`, `isSameLocalDay` |
| `src/lib/customer-chat-messages.ts`, `src/lib/__tests__/customer-chat-messages.test.ts` | `createdAt` on thread messages |
| `src/lib/constants.ts` | `SQUIRCLE_RADIUS[30]` |
| `src/hooks/useTicketsWithDetails.ts` | `subject`, `projectName`, `shortId`, `dateShort` on the active-ticket sidebar item |
| `src/app/support/chat/page.tsx`, `src/app/support/page.tsx` | Pass `ticketId`, `createdAt`, `composerPlaceholder` |
| `src/app/globals.css` | `text-note` token (light #5C6370, dark #A3A8B3) |
| `CLAUDE.md` | `text-note` in the colour table, the 30px chat avatar in the radius row, and a "Chat" convention |
| `docs/screenshots/chat-thread/` | The screenshots below and this description |

## Verification

- `npm run lint`: 0 errors (2 existing `<img>` warnings in the payment settings pages).
- `npm run test`: 100 files, 861 tests pass, including `guest-ticket.test.tsx`, `time-entry-review.test.tsx` and the helper ticket page test. No test needed fixing.
- `npx next build`: passes.
- **Helper ticket page:** `src/app/helper/tickets/[id]/page.tsx` has no diff. The shared files it uses changed only additively: `TicketChatInput` without `autoGrow` renders the same classes as before (measured 100px minimum on the base commit and covered by `chat-input.test.tsx`), `ProfileAvatar` gained a size without altering the others, and `globals.css` gained one token. The page itself was not opened in a browser, because it needs a signed-in helper and no test account was available.
- **`text-note` in light and dark:** the note row computes to `rgb(92, 99, 112)` in light and `rgb(163, 168, 179)` in dark. Contrast is 6.05:1 on `background` and 5.59:1 on `bg-subtle` in light, 8.31:1 and 6.97:1 in dark (AA needs 4.5:1).
- **Composer:** one line (32px) when empty; with 14 lines of text it stops at 200px with `overflow-y: auto` (content height 292px). On the base commit the same text gives a fixed 100px box that stops at 128px.

**How the screenshots were made:** there was no signed-in test account or local Supabase, so they come from a temporary fixture page (not committed) that rendered `TicketChat`, `CustomerChatIntro` and `CustomerTicketSidebarFooter` with the same sample data on the base commit (`cb89e9d`) and on this branch, at 1440×900. A real ticket at `/support/chat?ticket=…` has not been opened on this branch.

## Screenshots

### Thread: grouped run, day dividers, "Note ·" row, coloured callout kept

| Before | After |
|--------|-------|
| ![Before, light](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-thread-light.png?raw=true) | ![After, light](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-thread-light.png?raw=true) |
| ![Before, dark](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-thread-dark.png?raw=true) | ![After, dark](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-thread-dark.png?raw=true) |

### Composer: empty, and with long text (200px, scrolling)

| Before | After |
|--------|-------|
| ![Before, empty](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-composer-empty-light.png?raw=true) | ![After, empty](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-composer-empty-light.png?raw=true) |
| ![Before, long text](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-composer-long-light.png?raw=true) | ![After, long text](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-composer-long-light.png?raw=true) |
| ![Before, long text, dark](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-composer-long-dark.png?raw=true) | ![After, long text, dark](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-composer-long-dark.png?raw=true) |

### Right panel: empty helper/topic states and two-line active tickets

| Before | After |
|--------|-------|
| ![Before, empty](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-panel-empty-light.png?raw=true) | ![After, empty](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-panel-empty-light.png?raw=true) |
| ![Before, empty, dark](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-panel-empty-dark.png?raw=true) | ![After, empty, dark](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-panel-empty-dark.png?raw=true) |
| ![Before, active tickets](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-panel-active-light.png?raw=true) | ![After, active tickets](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-panel-active-light.png?raw=true) |
| ![Before, active tickets, dark](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-panel-active-dark.png?raw=true) | ![After, active tickets, dark](https://github.com/Githelp-support/githelp-support/blob/agent/slack-c554d6ef-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-panel-active-dark.png?raw=true) |

🤖 Generated with [Claude Code](https://claude.com/claude-code)
