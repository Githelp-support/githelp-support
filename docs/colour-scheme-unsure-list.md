# Colour scheme migration: unsure list (step 1c, pages and feature components)

Hand-over for the final subtask. Everything here was left unchanged on purpose unless marked "changed".

## Left unchanged by instruction

| Item | Where | Why |
|------|-------|-----|
| Avatar palette (nine pastel data colours) | `avatarColorsHex` / `getAvatarColorHexForId` in `src/lib/constants.ts`, `ProfileAvatar` | Cannot map to one gradient without changing the default look, so person avatars do not follow the scheme. |
| `slaColors` (`#cbbcf6`, `#d0f6bc`, `#f6e6bc`, `#bcedf6`) | `src/app/slas/page.tsx:19` | Same pastel data palette. |
| `BRAND` RGB | `src/lib/report-pdf.ts` | jsPDF cannot read CSS variables. PDFs stay #554ABF whatever the scheme. |
| `"#554abf"` default and placeholder | `src/app/settings/branding/page.tsx:27,31,147` | Stored project branding data, not a theme token. |
| Stripe tiles and buttons (`#635bff`, hover `#5851e5`) | `settings/payment/page.tsx:1008,1024`, `helper/settings/payout/page.tsx:99,125`, `user/settings/payment/page.tsx:212` | Third-party brand. |
| GitHub tiles and buttons (`#24292e`, `#24292f`, hover `#1b1f23`) | `settings/payment/page.tsx:999-1000`, `settings/profile/page.tsx:215`, `helper/settings/profile/page.tsx:260`, `onboarding/page.tsx:883`, `onboarding/join/page.tsx:141` | Third-party brand. |

## Hardcoded lavender gradients (not reproducible from the variables)

| Stops | Where |
|-------|-------|
| `#c5b0ef → #b8a0e8` | `src/components/support/rates-and-details-content.tsx:55` |
| `#e7e5fd → #d8d4f7` | `src/components/support/rates-and-details-content.tsx:68` |
| `#f9f7ff → #f0ecff` | `src/components/support/rates-and-details-content.tsx:81` |
| `#c5b0ef → #b8a0e8`, hover `#b8a0e8 → #ab90e0` | `src/components/support/resources-content.tsx:76` |

These are a different hue from `--brand` (#554ABF), not a tint of it. Mixing #554ABF with white to reach `#c5b0ef` needs about 66% white on the red channel, 56% on green and 75% on blue, so no single `color-mix()` ratio on `--brand` or `--tint` gives the same colour in any colour space. Left as literals. With a custom scheme these three rate-card header bands and the resources CTA stay lavender. The text on them is `text-support-header`, also not part of the accent variables.

## Open questions

1. **Link hover colour.** `src/app/support/get-support/page.tsx:141` is `text-link hover:text-brand-primary-hover`. There is no `link-hover` token, so the hover still follows `--brand-hover`, not `--link`. Left as is. Needs either a `--link-hover` variable or a decision that link hover derives from `--link`.
2. **Two hover styles for solid brand buttons.** Thirteen custom-classed buttons use `hover:bg-brand-primary/90` (translucent) while the `brand` Button variant and `global-error.tsx` use `hover:bg-brand-primary-hover`. Both are solid-fill treatments so both were kept, but only the second follows the `--brand-hover` variable. Files: `error.tsx`, `not-found.tsx`, `help/page.tsx:195,211`, `support/tickets/page.tsx:254`, `helper/tickets/[id]/page.tsx:1625`, `helpers/page.tsx:868`, `slas/[id]/page.tsx:364,385,455`, `drawers/log-time-drawer.tsx:111`, `drawers/add-helper-drawer.tsx:258`, `modals/unsaved-changes-modal.tsx:43`. Most could become `<Button variant="brand">`.
3. **Outline buttons that fill on hover.** `border-brand-primary text-link hover:bg-brand-primary hover:text-brand-foreground` (`onboarding/waiting/page.tsx:195,217`, `support/sla/page.tsx:121`, `support/get-support/page.tsx:132`, `projects/[id]/page.tsx:235`, `support/rates-and-details-content.tsx:130`) and `border-brand-primary text-link hover:bg-tint hover:text-tint-text` (tickets, helpers, helper ticket, user reports, customer chat intro) are two different hover treatments for the same kind of button. Both follow the rules, but the border is `brand` while the label is `link`, so a scheme with `link` ≠ `brand` gives a two-colour button at rest.
4. **Selected tabs: `text-link border-brand-primary`.** Underlined tab bars in `settings/payment`, `helper/reports`, `user/reports`, `reports/support`, `reports/slas`, `slas`, `support/sla`, `support/get-support`. Label is `link`, underline is `brand`. Same two-colour question as above.
5. **Info boxes with `text-foreground` on `bg-tint-soft`.** `helper/reports/page.tsx:490`, `user/reports/page.tsx:407`, `drawers/end-ticket-drawer.tsx:161`, `ticket-chat/end-session-request.tsx:79`, and selected option cards (`settings/payment/page.tsx:734,758`, `onboarding/page.tsx:520`, `contributors-step.tsx:150`, `add-helper-drawer.tsx:384`, `helper/settings/profile/page.tsx:328`, unread rows in `helper/overview`, the SLA table bands in `slas/[id]/page.tsx:492,542,568`). Body text here is neutral, not purple, so it was not moved to `text-tint-text`. A dark custom `tint` would make this text unreadable.
6. **Translucent brand borders.** `border-brand-primary/30`, `/50`, `/60` on the info boxes and hover states above stay on `brand`, per the rule that borders stay brand. They sit on tint surfaces, so they may want to follow `tint-text` instead.
7. **Dark mode.** `.dark` overrides only the legacy aliases (`--brand-primary` #6c5ce7 and friends). `--tint`, `--tint-text`, `--link` and the tile stops are defined once on `:root` from the light `--brand`. Classes already moved to `bg-tint` / `text-link` / `text-tint-text` therefore render from #554ABF in dark mode, where the old `bg-brand-primary/10` / `text-brand-primary` used #6c5ce7. `dark:` classes were not touched. This is also why the legacy `brand-primary` / `brand-foreground` class names were not renamed to `brand` / `brand-text` in pages: the rename would change dark-mode rendering.
8. **Status dot `bg-[#f09191]`.** `helper/tickets/[id]/page.tsx:1550`, `ticket-chat/customer-sidebar-footer.tsx:132`. A hardcoded status colour, out of scope here, but it breaks the no-hex rule.

## Changed in this step that is worth a look

- **Native radios in `settings/payment/page.tsx:640,651`** had `text-brand-primary`, which does nothing on a native radio (no forms plugin). The inert class was removed, so the radios keep the browser default look; they do not follow the scheme.
- **Brand-filled buttons without a text colour** (`error.tsx:26`, `not-found.tsx:12`, `slas/[id]/page.tsx:364,385`) relied on the default variant's `text-primary-foreground`. Added `text-brand-foreground` so the label follows `--brand-text`. No visible change in the default light scheme (near-white to white); in dark mode the label goes from near-black to white on the purple fill.

## Checked, nothing to do

- The typo class `bbg-brand-primary` no longer exists anywhere in `src`.
- Accent bars (`customer-sidebar-footer.tsx:108`, `helper/tickets/[id]/page.tsx:1534`, the 3px stat-card bars in `tickets/page.tsx` and `support/tickets/page.tsx`) are `bg-tint` with a `brand` bar.
- Project icon fallbacks and flat brand squircle tiles use `bg-linear-to-br from-tile-from to-tile-to text-brand-text`, with `primary_color` still overriding (`support/get-support/page.tsx:72`, `projects/[id]/page.tsx:160`, `customer-sidebar-footer.tsx:123`, `tickets/page.tsx:807`, overview and onboarding avatar fallbacks).
- No `bg-brand-primary/N` tint backgrounds or `text-brand-primary` text remain outside `src/components/ui` and `src/components/layout`. Every remaining `brand-primary` / `brand-foreground` hit is a solid fill, border, ring, outline, native `accent-` colour, timeline or unread dot, or text on a solid brand fill.
