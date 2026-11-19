# Buyer ticket chat: grouped thread, day dividers, notes, auto-growing composer, compact panel

Restyles the buyer-facing ticket chat (`/support/chat?ticket=…` and the "Get support" chat on `/support`). The helper ticket page is not part of this change.

## What changed

- **Thread:** consecutive messages from the same sender within 5 minutes share one header (avatar, name, time); a day divider ("Today", "Yesterday", "Sunday 15 November") marks each new local day; message times are `HH:MM`; plain system messages render as an unboxed "**Note** · …" line with an info icon; the thread no longer sits in a card. Avatars are 30px.
- **Header:** the ticket ID is a short pill (first 8 characters) with a copy button for the full ID; "End session" moved from the composer toolbar to the header.
- **Composer:** starts at one line and grows with the text to 200px, then scrolls; the placeholder is "Ask #slug" (or "Ask Name"), cut at 24 characters.
- **Right panel:** empty sections say "No helper has joined yet." / "No other topics yet." instead of "-"; active tickets are two lines (question, then project · short ID · date).
- **Auto-reply:** the average-response sentence is left out while the project has no average (no "~" placeholder).

## Files changed

| File | Change |
|------|--------|
| `src/lib/chat-thread.ts` (new) | Pure helpers: `formatChatTime`, `formatDayDividerLabel`, `formatDayMonth`, `shortTicketId`, `composerPlaceholder`, `layoutThread` |
| `src/lib/__tests__/chat-thread.test.ts` (new) | Tests for the helpers |
| `src/components/ticket-chat/ticket-chat.tsx` | Grouping, day dividers, notes, ID pill, "End session" in the header, panel empty states |
| `src/components/ticket-chat/ticket-chat.test.tsx` (new) | Component tests for the above |
| `src/components/ticket-chat/chat-input.tsx` | `autoGrow` prop (off by default) |
| `src/components/ticket-chat/chat-input.test.tsx` | Tests for `autoGrow` |
| `src/components/ticket-chat/customer-chat-intro.tsx` | 30px avatar, semibold name, time via tokens, welcome text in `text-foreground` |
| `src/components/ticket-chat/customer-sidebar-footer.tsx` | Two-line active tickets |
| `src/components/ticket-chat/sidebar-section.tsx` | `SidebarEmpty` is a left-aligned one-line note |
| `src/hooks/useTicketsWithDetails.ts` | `question`, `projectName`, `createdAt` on the active-ticket sidebar item |
| `src/lib/customer-chat-messages.ts` | `createdAt` on thread messages; auto-reply without the "~" placeholder |
| `src/lib/__tests__/customer-chat-messages.test.ts` | Tests for both |
| `src/lib/constants.ts` | `SQUIRCLE_RADIUS[30]` |
| `src/app/support/chat/page.tsx`, `src/app/support/page.tsx` | Pass `ticketId`, `helperJoined`, `composerPlaceholder`, time-only intro timestamp |
| `src/app/globals.css` | `text-note` token (light #5C6370, dark #9EA3AE) |
| `CLAUDE.md` | `text-note` added to the colour token table |
| `docs/screenshots/chat-thread/` | Screenshots below and this description |

## Notes

- **The helper ticket page is intentionally untouched.** `src/app/helper/tickets/[id]/page.tsx` has no diff and its test passes. It renders `TicketChatInput` directly, and `autoGrow` is off by default, so its composer is unchanged.
- **A `text-note` token was added** for #5C6370 (dark: #9EA3AE), used by the "Note" lines and the panel's empty-state lines.
- **'Sunday 15 November' and '15 Nov' are task-mandated exceptions to `formatDate`** (day dividers and the active-ticket meta line). Everything else still uses `formatDate`/`formatDateTime`.
- **Storage, welcome timing and unread tracking are unchanged**: no diff touches localStorage/sessionStorage keys, when the welcome and auto-reply appear, or last-read updates.
- **Mobile header:** below `sm` "End session" is icon-only (label kept for screen readers). With the label, the title was pushed out of the header entirely at 390px.
- **Side effects of the listed changes, measured against the base branch at 1440px:** the chat header is 4px taller (69px → 73px) because it now holds a 32px button; the message column, rates cards and coloured payment boxes start 2px further left (340px → 338px) and are 1–2px wider because the avatar is 30px instead of 32px. Their padding, radius, colours and heights are identical.

## Verification

- `npm run lint`: 0 errors (2 existing `<img>` warnings in the payment settings pages).
- `npm run test`: 98 files, 854 tests pass, including `src/app/helper/tickets/[id]/page.test.tsx`.
- `npx next build`: passes.
- **Unchanged areas**, computed styles compared between base (`cb89e9d`) and this branch in light and dark: sidebar (256px, same nav item geometry), right panel (320px), rates cards (66px high, 12px padding, 8px radius, same colours), green/amber/red payment messages (same background, text, border, padding, radius, height).
- **`/support/[slug]`** (live project, signed out): pixel-identical to base at 1440, 900 and 390px, light and dark.
- **`/support/chat`** (live project, signed out, new chat): renders in light and dark at 1440, 900 and 390px with no horizontal scroll; composer text is 16px at 390px and 14px from `md` up, the same as base. An unknown ticket ID shows the same "Ticket not found" page as base.
- **Below `lg`** (900px and 390px): "End session" and the panel toggle sit in the header; the panel opens as a sheet over the chat.

**How the screenshots were made:** there was no signed-in test account, so the thread, composer and panel shots come from a temporary fixture page that rendered `TicketChat`, `CustomerChatIntro` and `CustomerTicketSidebarFooter` with the same sample data on the base branch and on this branch (not committed). A real ticket with a helper, logged time and payment messages has not been opened on this branch.

## Screenshots

### Thread: grouped run, day dividers, 'Note' message

| Before | After |
|--------|-------|
| ![Before, light](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-thread-light.png?raw=true) | ![After, light](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-thread-light.png?raw=true) |
| ![Before, dark](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-thread-dark.png?raw=true) | ![After, dark](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-thread-dark.png?raw=true) |

### Composer: empty, and with long text (200px, scrolling)

| Before | After |
|--------|-------|
| ![Before, empty](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-composer-empty-light.png?raw=true) | ![After, empty](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-composer-empty-light.png?raw=true) |
| ![Before, long text](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-composer-long-light.png?raw=true) | ![After, long text](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-composer-long-light.png?raw=true) |

### Right panel: empty states and two-line active tickets

| Before | After |
|--------|-------|
| ![Before, empty](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-panel-empty-light.png?raw=true) | ![After, empty](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-panel-empty-light.png?raw=true) |
| ![Before, active tickets](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-panel-active-light.png?raw=true) | ![After, active tickets](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-panel-active-light.png?raw=true) |

### Below lg: header actions and panel sheet

| Before | After |
|--------|-------|
| ![Before, 390px](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-mobile-thread-light.png?raw=true) | ![After, 390px](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-mobile-thread-light.png?raw=true) |
| ![Before, 900px, panel open](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/before-tablet-panel-sheet-light.png?raw=true) | ![After, 900px, panel open](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-tablet-panel-sheet-light.png?raw=true) |
| | ![After, 900px, panel open, dark](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-tablet-panel-sheet-dark.png?raw=true) |
| | ![After, 390px, panel open](https://github.com/Githelp-support/githelp-support/blob/agent/slack-e999ae0a-make-the-specific-changes-listed-below-t/docs/screenshots/chat-thread/after-mobile-panel-sheet-light.png?raw=true) |

🤖 Generated with [Claude Code](https://claude.com/claude-code)
