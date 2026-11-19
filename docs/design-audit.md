# Design audit: githelp-support frontend

Read-only inventory of every colour, radius, shadow, gradient, type, spacing, component-variant and icon value in the frontend source, measured against the tokens in `src/app/globals.css` and the rules in `CLAUDE.md`. Observations only: nothing under `src/` was changed and no fixes are proposed here.

## 1. Method and scope

| Item | Value |
|---|---|
| Date | 2026-11-18 |
| Commit | `c7dcca2` on `agent/slack-93d81629-audit-the-frontend-styling-list-every-co` |
| Scanned | `src/**/*.{ts,tsx,css}`, excluding `*.test.*` and `__tests__/` |
| Files scanned | 240: 148 `.tsx`, 91 `.ts`, 1 `.css` (47,389 lines) |
| Files excluded as tests | 44 `.tsx` + 51 `.ts` (the tree holds 192 `.tsx` and 142 `.ts` in total) |
| By top-level folder | `app` 57, `components` 87, `hooks` 48, `lib` 42, `contexts` 4, `types` 1 (ts + tsx), plus `app/globals.css` |
| Token source | `src/app/globals.css` only (`@theme inline`, `:root`, `.dark`); there is no `tailwind.config.*` |

**How the counts were produced.** A throwaway Python script, kept outside the repository, applied the regexes below to every scanned file and printed each table in this report. No count was typed by hand. Each number is one class token in source. The regexes:

| Purpose | Regex or rule |
|---|---|
| Class tokens | every run of characters matching `[^\s"'\`]+`; variant prefixes (`hover:`, `dark:`, `md:`, `data-[state=open]:`, `[&_svg]:` …) are split off at top-level colons and the remaining utility is counted, so `hover:bg-muted` and `bg-muted` both count as `bg-muted` |
| Colour utilities | `^(bg|text|border(-[trblxyse])?|ring-offset|ring|outline|divide|fill|stroke|from|via|to|decoration|placeholder|caret|shadow|inset-ring|inset-shadow)-(.+)$`, then the value is classified as a token (a `--color-*` name from `@theme`), a default-palette colour (`(slate|gray|…|rose)-(50…950)`), a keyword (`white`, `black`, `transparent`, `current`, `inherit`) or an arbitrary value (`[#…]`, `[rgb…]`, `(--var)`); a trailing `/NN` alpha modifier is recorded separately |
| Colour literals | `#[0-9a-fA-F]{3,8}\b`, `rgba?\(…\)`, `hsla?\(…\)`, `oklch\(…\)`, `color-mix\(…\)` |
| Radius | `rounded(-(t|r|b|l|tl|tr|br|bl|s|e|ss|se|ee|es))?(-(.+))?` |
| Shadow | `(shadow|drop-shadow|inset-shadow|text-shadow)(-.+)?`, plus `boxShadow`/`box-shadow` in styles |
| Gradient | `bg-gradient-*`, `bg-linear*`, `bg-radial*`, `bg-conic*`, `(from|via|to)-*`, and `(linear|radial|conic)-gradient(` |
| Type | `text-(2xs|xs|ui|sm|base|lg|xl|2xl…9xl|stat|title|display|[length])`, `font-(thin…black|book|subtitle|[N])`, `font-(sans|display|mono|serif|[…])`, `leading-*`, `tracking-*`, and `fontSize`/`fontWeight`/`fontFamily`/`letterSpacing`/`lineHeight` in styles |
| Spacing and sizing | `(p[xytrblse]?|m[xytrblse]?|gap(-[xy])?|space-[xy]|h|w|size|min-h|max-h|min-w|max-w)-(value)` where value is a scale step, a keyword or `[…]`/`(…)` |
| Components | JSX opening tags (`<Button …>`), with top-level props parsed statically; a literal `variant="x"` is counted under `x`, an expression is listed as written |
| Icons | `<Icon …>` tags, `"fi-…"` string literals, `import { … } from "lucide-react"`, `<svg`, `<img`/`<Image`/`<AvatarImage` |

**Cross-check against grep.** The same class was counted with plain `grep` over the raw files (command: `grep -rEo --include='*.ts' --include='*.tsx' --include='*.css' --exclude='*.test.*' --exclude-dir=__tests__ -- "(^|[^a-zA-Z0-9_/.-])CLASS($|[^a-zA-Z0-9_.-])" src | wc -l`). Differences are explained by the caveats below (comments and the tailwind-merge registration).

| class | this report | `grep` on raw files | same regex on raw files (script) |
|---|---|---|---|
| `text-muted-foreground` | 534 | 534 | 534 |
| `bg-brand-primary` | 142 | 142 | 142 |
| `rounded-lg` | 159 | 159 | 159 |
| `gap-2` | 208 | 208 | 208 |
| `text-ui` | 121 | 124 | 124 |
| `px-6` | 83 | 86 | 86 |
| `font-subtitle` | 66 | 67 | 67 |
| `shadow-sm` | 16 | 16 | 16 |
| `transition-all` | 0 | 0 | 0 |

**Caveats on the counts.**

- **Comments are stripped** before counting (`/* … */`, `{/* … */}` and `// …`), so a class named in a comment is not a usage. Raw `grep` therefore reports slightly more for classes that docs comments mention (`text-ui`, `px-6`).
- **`src/lib/utils.ts` lines 9–17 are excluded.** They register the custom tokens with tailwind-merge (`"text-2xs"`, `"shadow-control"`, …) and are not usages.
- **A count is a source occurrence, not a rendered element.** Both branches of a conditional count, and a class inside a shared constant or helper (for example `listRowClass`, `SQUIRCLE_RADIUS`, `getStatusBadgeClass`) counts once at its definition, however often it renders.
- **Variants are merged.** `dark:`, `hover:`, `md:` and similar prefixes are folded into the base utility. Alpha modifiers (`/40`) are folded into the base colour in §3a and listed separately after it.
- **Three sources.** "token" means defined in `globals.css`; "Tailwind default" means a stock Tailwind scale step that the project has not overridden (`rounded-full`, `text-sm`, `shadow-sm`, every spacing step); "hardcoded" means an arbitrary value (`[…]`), a hex/rgb literal, or a default-palette colour that bypasses the colour tokens.
- **Component and ad-hoc detection is static and partly heuristic.** Variant counts read literal props only. The ad-hoc card and badge lists in §9 are pattern matches on class combinations and can include false positives and miss cases.
- **Scope figures in the brief versus measured.** The brief estimated about 192 `.tsx` files, 17 files with colour literals and 37 with bracketed px/rem values. Measured: 192 `.tsx` files exist, 148 after the test exclusion; 14 non-test ts/tsx files contain colour literals (45 literals); 44 files contain bracketed px/rem class values (123 occurrences).

## 2. Central tokens

`globals.css` defines 103 entries in `@theme inline`, 88 custom properties in `:root` and 79 overrides in `.dark`. 77 of the `@theme` entries are colours that map 1:1 to a `:root` variable. There are **no spacing tokens**: the project uses Tailwind's default spacing scale unchanged (see §8).

### 2.1 Colour tokens

"class uses" counts every utility that resolves to the token across all prefixes; "`var()` uses" counts `var(--name)` references outside the `@theme` mapping line.

| token | light (`:root`) | dark (`.dark`) | class uses | `var()` uses | by prefix | example locations / status |
|---|---|---|---|---|---|---|
| `brand-primary` | `#554abf` | `#6c5ce7` | 375 | 0 | bg-: 142, text-: 120, border-: 69, ring-: 39, outline-: 3, border-l-: 2 | `app/auth/confirmed/page.tsx:235`, `app/error.tsx:26` |
| `brand-primary-hover` | `#4a3fa3` | `#7d6ff0` | 3 | 0 | bg-: 2, text-: 1 | `app/global-error.tsx:30`, `app/support/get-support/page.tsx:141` |
| `brand-foreground` | `#ffffff` | `#ffffff` | 32 | 0 | text-: 32 | `app/global-error.tsx:30`, `app/help/page.tsx:195` |
| `text-secondary` | `#444444` | `#c9c9cf` | 51 | 0 | text-: 51 | `app/helpers/page.tsx:704`, `app/support/get-support/page.tsx:54` |
| `surface-hover` | `rgba(0, 0, 0, 0.04)` | `rgba(255, 255, 255, 0.06)` | 30 | 0 | bg-: 30 | `app/helpers/page.tsx:802`, `app/onboarding/page.tsx:794` |
| `surface-active` | `rgba(0, 0, 0, 0.08)` | `rgba(255, 255, 255, 0.1)` | 2 | 0 | bg-: 2 | `components/ui/button.tsx:31`, `components/ui/select.tsx:38` |
| `border-control` | `rgba(0, 0, 0, 0.1)` | `rgba(255, 255, 255, 0.12)` | 31 | 0 | border-: 31 | `app/helper/settings/profile/page.tsx:324`, `app/settings/branding/page.tsx:108` |
| `border-avatar` | `#e1e4ea` | `oklch(1 0 0 / 16%)` | 4 | 0 | border-: 4 | `app/support/page.tsx:683`, `app/support/page.tsx:687` |
| `status-success-bg` | `#d1f7ea` | `#1a3d33` | 4 | 0 | bg-: 4 | `app/reports/slas/page.tsx:446`, `app/reports/slas/page.tsx:561` |
| `status-success-text` | `#4aa19e` | `#5ec4b8` | 6 | 0 | text-: 6 | `app/projects/[id]/invite-contributors/contributors-step.tsx:187`, `app/reports/slas/page.tsx:446` |
| `status-warning-bg` | `#f7f3d1` | `#3d3620` | 1 | 0 | bg-: 1 | `lib/status-colors.ts:26` |
| `status-warning-text` | `#a1944a` | `#c4b55e` | 2 | 0 | text-: 2 | `app/projects/[id]/invite-contributors/page.tsx:264`, `lib/status-colors.ts:26` |
| `status-high-bg` | `#f4bccc` | `#3d1a28` | 2 | 0 | bg-: 2 | `components/ui/error-state.tsx:46`, `lib/status-colors.ts:28` |
| `status-high-text` | `#d63384` | `#e86ba0` | 2 | 0 | text-: 2 | `components/ui/error-state.tsx:46`, `lib/status-colors.ts:28` |
| `badge-neutral-bg` | `#f1f2f4` | `#2a2d33` | 3 | 0 | bg-: 3 | `components/ui/badge.tsx:20`, `components/ui/badge.tsx:26` |
| `badge-neutral-text` | `#3f4450` | `#c9cdd6` | 2 | 0 | text-: 2 | `components/ui/badge.tsx:20`, `components/ui/badge.tsx:26` |
| `badge-muted-text` | `#5c6370` | `#a4abb8` | 2 | 0 | text-: 2 | `components/ui/badge.tsx:28`, `lib/status-colors.ts:83` |
| `badge-outline-bg` | `#ffffff` | `transparent` | 1 | 0 | bg-: 1 | `components/ui/badge.tsx:22` |
| `badge-outline-border` | `#e1e4e8` | `oklch(1 0 0 / 16%)` | 1 | 0 | border-: 1 | `components/ui/badge.tsx:22` |
| `badge-outline-text` | `#2b2f38` | `#e4e6eb` | 1 | 0 | text-: 1 | `components/ui/badge.tsx:22` |
| `badge-info-bg` | `#eaf1fe` | `#1b2a47` | 1 | 0 | bg-: 1 | `components/ui/badge.tsx:23` |
| `badge-info-text` | `#1d4fb8` | `#9dbdf9` | 1 | 0 | text-: 1 | `components/ui/badge.tsx:23` |
| `badge-success-bg` | `#e3f6ea` | `#17352a` | 1 | 0 | bg-: 1 | `components/ui/badge.tsx:24` |
| `badge-success-text` | `#17693a` | `#7fd6a2` | 1 | 0 | text-: 1 | `components/ui/badge.tsx:24` |
| `badge-strong-bg` | `#14161a` | `#f1f2f4` | 1 | 0 | bg-: 1 | `components/ui/badge.tsx:30` |
| `badge-strong-text` | `#ffffff` | `#14161a` | 1 | 0 | text-: 1 | `components/ui/badge.tsx:30` |
| `badge-emphasis-text` | `#14161a` | `#f1f2f4` | 1 | 0 | text-: 1 | `lib/status-colors.ts:79` |
| `badge-dot-core` | `#7650d9` | `#9b7deb` | 1 | 0 | bg-: 1 | `lib/status-colors.ts:92` |
| `badge-dot-community` | `#0e7f6e` | `#2fb39e` | 1 | 0 | bg-: 1 | `lib/status-colors.ts:94` |
| `badge-dot-extended` | `#c2570c` | `#e08a4a` | 1 | 0 | bg-: 1 | `lib/status-colors.ts:97` |
| `page-muted` | `#f7f9ff` | `#161620` | 18 | 0 | bg-: 18 | `app/auth/role/page.tsx:53`, `app/auth/signin/page.tsx:72` |
| `avatar-1` | `#f4bccc` | `#4d2a36` | 1 | 0 | bg-: 1 | `lib/constants.ts:8` |
| `avatar-2` | `#d1f7ea` | `#1f4d3d` | 1 | 0 | bg-: 1 | `lib/constants.ts:9` |
| `avatar-3` | `#bcedf6` | `#1f3d4d` | 1 | 0 | bg-: 1 | `lib/constants.ts:10` |
| `avatar-4` | `#f6e6bc` | `#4d3d1f` | 1 | 0 | bg-: 1 | `lib/constants.ts:11` |
| `avatar-5` | `#cbbcf6` | `#332b4d` | 1 | 0 | bg-: 1 | `lib/constants.ts:12` |
| `avatar-6` | `#d0f6bc` | `#2b4d1f` | 1 | 0 | bg-: 1 | `lib/constants.ts:13` |
| `avatar-7` | `#f7f3d1` | `#4d4a2a` | 1 | 0 | bg-: 1 | `lib/constants.ts:14` |
| `avatar-8` | `#e1d5f7` | `#382b4d` | 1 | 0 | bg-: 1 | `lib/constants.ts:15` |
| `avatar-9` | `#bce5f6` | `#1f3a4d` | 1 | 0 | bg-: 1 | `lib/constants.ts:16` |
| `border-subtle` | `#e1e1e1` | `oklch(1 0 0 / 12%)` | 97 | 1 | border-: 67, divide-: 28, bg-: 2 | `app/helper/reports/page.tsx:526`, `app/helper/reports/page.tsx:786` |
| `text-heading` | `#0f0f11` | `#f0f0f2` | 3 | 0 | text-: 3 | `app/global-error.tsx:23`, `app/helpers/page.tsx:765` |
| `text-muted` | `#55555d` | `#a1a1a8` | 42 | 0 | text-: 42 | `app/global-error.tsx:24`, `app/helper/reports/page.tsx:484` |
| `bg-subtle` | `#f6f6f6` | `#1e1e22` | 21 | 0 | bg-: 21 | `app/helper/reports/page.tsx:484`, `app/helper/tickets/[id]/page.tsx:875` |
| `text-tertiary` | `#666b77` | `#9a9fab` | 49 | 0 | text-: 46, bg-: 3 | `app/helpers/page.tsx:579`, `app/helpers/page.tsx:582` |
| `support-header` | `#2d2a49` | `#1e1b34` | 6 | 0 | text-: 6 | `components/support/rates-and-details-content.tsx:56`, `components/support/rates-and-details-content.tsx:69` |
| `background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | 53 | 1 | bg-: 50, text-: 2, ring-offset-: 1 | `app/globals.css:668`, `app/helper/settings/availability/page.tsx:19` |
| `foreground` | `#2E2D31` | `oklch(0.985 0 0)` | 403 | 1 | text-: 396, bg-: 5, fill-: 2 | `app/auth/confirmed/page.tsx:230`, `app/error.tsx:21` |
| `sidebar-ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | 0 | 0 | — | **unused** |
| `sidebar-border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | 10 | 0 | border-: 10 | `components/layout/public-support-sidebar.tsx:79`, `components/layout/public-support-sidebar.tsx:123` |
| `sidebar-accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | 0 | 0 | — | **unused** |
| `sidebar-accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | 0 | 0 | — | **unused** |
| `sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` | 0 | 0 | — | **unused** |
| `sidebar-primary` | `oklch(0.205 0 0)` | `oklch(0.488 0.243 264.376)` | 0 | 0 | — | **unused** |
| `sidebar-foreground` | `#2E2D31` | `oklch(0.985 0 0)` | 5 | 0 | text-: 5 | `components/layout/public-support-sidebar.tsx:209`, `components/layout/sidebar.tsx:551` |
| `sidebar` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | 5 | 0 | bg-: 5 | `app/support/layout.tsx:29`, `components/layout/mobile-nav.tsx:84` |
| `chart-5` | `oklch(0.769 0.188 70.08)` | `oklch(0.645 0.246 16.439)` | 0 | 0 | — | **unused** |
| `chart-4` | `oklch(0.828 0.189 84.429)` | `oklch(0.627 0.265 303.9)` | 0 | 0 | — | **unused** |
| `chart-3` | `oklch(0.398 0.07 227.392)` | `oklch(0.769 0.188 70.08)` | 1 | 0 | text-: 1 | `components/layout/notifications-panel.tsx:15` |
| `chart-2` | `oklch(0.6 0.118 184.704)` | `oklch(0.696 0.17 162.48)` | 3 | 0 | text-: 3 | `components/layout/notifications-panel.tsx:17`, `components/layout/notifications-panel.tsx:19` |
| `chart-1` | `oklch(0.646 0.222 41.116)` | `oklch(0.488 0.243 264.376)` | 0 | 0 | — | **unused** |
| `ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | 15 | 0 | ring-: 8, border-: 6, outline-: 1 | `app/globals.css:665`, `components/ui/accordion.tsx:38` |
| `input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | 21 | 0 | border-: 11, bg-: 10 | `components/drawers/accept-request-drawer.tsx:66`, `components/drawers/accept-request-drawer.tsx:70` |
| `border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | 164 | 3 | border-: 152, bg-: 8, divide-: 4 | `app/auth/confirmed/page.tsx:229`, `app/globals.css:665` |
| `destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | 53 | 0 | ring-: 18, text-: 16, border-: 10, bg-: 9 | `app/helper/tickets/[id]/page.tsx:1223`, `app/helper/tickets/[id]/page.tsx:1496` |
| `accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | 9 | 0 | text-: 9 | `components/ui/badge.tsx:19`, `components/ui/button.tsx:18` |
| `accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | 10 | 0 | bg-: 10 | `components/ui/badge.tsx:19`, `components/ui/button.tsx:18` |
| `muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | 549 | 10 | text-: 534, border-: 9, bg-: 6 | `app/auth/confirmed/page.tsx:231`, `app/auth/confirmed/page.tsx:249` |
| `muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | 122 | 2 | bg-: 122 | `app/auth/confirmed/page.tsx:228`, `app/auth/confirmed/page.tsx:246` |
| `secondary-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | 2 | 0 | text-: 2 | `components/ui/badge.tsx:15`, `components/ui/button.tsx:20` |
| `secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | 4 | 0 | bg-: 4 | `components/ui/badge.tsx:15`, `components/ui/button.tsx:20` |
| `primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | 5 | 0 | text-: 4, bg-: 1 | `components/ui/badge.tsx:13`, `components/ui/button.tsx:14` |
| `primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | 21 | 0 | border-: 10, bg-: 8, text-: 2, fill-: 1 | `components/drawers/add-helper-drawer.tsx:313`, `components/drawers/add-helper-drawer.tsx:317` |
| `popover-foreground` | `#2E2D31` | `oklch(0.985 0 0)` | 4 | 1 | text-: 4 | `components/ui/dropdown-menu.tsx:46`, `components/ui/dropdown-menu.tsx:234` |
| `popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | 4 | 1 | bg-: 4 | `components/ui/dropdown-menu.tsx:46`, `components/ui/dropdown-menu.tsx:234` |
| `card-foreground` | `#2E2D31` | `oklch(0.985 0 0)` | 1 | 0 | text-: 1 | `components/ui/card.tsx:10` |
| `card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | 77 | 0 | bg-: 77 | `app/auth/confirmed/page.tsx:229`, `app/helper/reports/page.tsx:497` |

**Defined but never used (8):** `sidebar-ring`, `sidebar-accent-foreground`, `sidebar-accent`, `sidebar-primary-foreground`, `sidebar-primary`, `chart-5`, `chart-4`, `chart-1`. These have no class and no `var()` reference in the scanned files.

**Narrowly used.** `chart-2` (3 uses) and `chart-3` (1 use) are used as icon text colours in `components/layout/notifications-panel.tsx`, not for charts. `status-warning-bg`, `status-high-bg` and `status-high-text` appear only in `lib/status-colors.ts` and `components/ui/error-state.tsx`.

### 2.2 Radius tokens

| token | light | dark | class uses | `var()` uses | example locations |
|---|---|---|---|---|---|
| `--radius-sm` → `rounded-sm` | 4px | same | 13 | 0 | `app/settings/payment/page.tsx:1064`, `components/drawers/end-ticket-drawer.tsx:146` |
| `--radius-md` → `rounded-md` | 6px | same | 67 | 0 | `app/global-error.tsx:30`, `app/helper/reports/payouts/[id]/page.tsx:98` |
| `--radius-lg` → `rounded-lg` | 8px | same | 159 | 1 | `app/auth/confirmed/page.tsx:229`, `app/helper/reports/page.tsx:484` ; var: `components/ui/sonner.tsx:23` |
| `--radius-xl` → `rounded-xl` | 12px | same | 7 | 0 | `components/drawers/add-helper-drawer.tsx:365`, `components/drawers/add-helper-drawer.tsx:442` |
| `--radius` (`:root` only, no utility) | 0.625rem | same | 0 | 2 | `app/globals.css:610`, `app/globals.css:641` |

`--radius` (10px) is not exposed as a utility and matches none of the four radius tokens. It is used only by the chat code-block CSS (`.markdown-code-block` 10px, copy button `calc(var(--radius) - 4px)` = 6px).

### 2.3 Shadow and button-depth tokens

| token | light | dark | class uses | `var()` uses | example locations |
|---|---|---|---|---|---|
| `shadow-control` | `inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 1px 0 rgba(0, 0, 0, 0.04)` | same | 1 | 0 | `components/ui/button.tsx:18` |
| `shadow-soft` | `0 4px 15px rgba(134, 140, 152, 0.2)` | same | 3 | 0 | `app/helper/tickets/[id]/page.tsx:939`, `components/ticket-chat/chat-input.tsx:217`, `components/ticket-chat/ticket-chat.tsx:374` |
| `shadow-popover` | `0 4px 12px rgba(134, 140, 152, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.04)` | same | 8 | 0 | `components/layout/notifications-panel.tsx:129`, `components/payment/distribution-preview.tsx:98`, `components/ui/dropdown-menu.tsx:46` |
| `shadow-modal` | `0 12px 40px rgba(134, 140, 152, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.04)` | same | 5 | 0 | `app/helper/tickets/[id]/page.tsx:1364`, `components/layout/mobile-nav.tsx:84`, `components/ticket-chat/ticket-chat.tsx:655` |
| `shadow-tab` | `0 0 7px rgba(134, 140, 152, 0.3)` | same | 1 | 0 | `components/ui/tab-selector.tsx:48` |
| `btn-depth` (`@utility`) | composed from `--btn-*` | `--btn-highlight`, `--btn-drop` overridden | 4 | 0 | `components/ui/button.tsx:14`, `components/ui/button.tsx:16`, `components/ui/button.tsx:20` |
| `btn-depth-light` (`@utility`) | composed from `--btn-*` | `--btn-highlight`, `--btn-drop` overridden | 2 | 0 | `components/ui/button.tsx:14`, `components/ui/button.tsx:20` |
| `--btn-sheen-top` | `rgb(255 255 255 / 0.07)` | same | 0 | 1 | `app/globals.css:365` |
| `--btn-sheen-bottom` | `transparent` | same | 0 | 1 | `app/globals.css:365` |
| `--btn-highlight` | `0.15` | `0.08` | 0 | 1 | `app/globals.css:363` |
| `--btn-drop` | `0.1` | `0` | 0 | 2 | `app/globals.css:364`, `app/globals.css:391` |
| `--btn-press` | `0.18` | same | 0 | 2 | `app/globals.css:374`, `app/globals.css:401` |
| `--btn-hover-brightness` | `1.06` | same | 0 | 2 | `app/globals.css:370`, `app/globals.css:397` |
| `--btn-light-edge` | `0.06` | same | 0 | 1 | `app/globals.css:390` |

Shadow tokens have no `.dark` override; the grey-blue `rgba(134,140,152,…)` shadows are the same in both themes. `shadow-popover` shares its name with the colour token `popover` (`--shadow-popover` and `--color-popover`), so `shadow-popover` is resolvable as either a box-shadow or a shadow colour.

### 2.4 Type tokens

| token | value (size / line-height, weight or stack) | uses | example locations |
|---|---|---|---|
| `text-2xs` | 0.6875rem / 0.875rem | 0 | **unused** |
| `text-ui` | 0.8125rem / 1.125rem | 121 | `app/helper/reports/page.tsx:135`, `app/helper/reports/page.tsx:663`, `app/helper/reports/page.tsx:893` |
| `text-stat` | 1.375rem / 1.75rem | 10 | `app/helper/overview/page.tsx:111`, `app/helper/overview/page.tsx:120`, `app/helper/overview/page.tsx:129` |
| `text-title` | 1.5rem / 2rem | 1 | `components/layout/header.tsx:100` |
| `text-display` | 1.875rem / 2.25rem | 1 | `app/support/page.tsx:693` |
| `font-book` | 450 | 15 | `components/layout/public-support-sidebar.tsx:143`, `components/layout/public-support-sidebar.tsx:176`, `components/layout/sidebar.tsx:340` |
| `font-subtitle` | 550 | 66 | `app/auth/confirmed/page.tsx:230`, `app/help/page.tsx:161`, `app/helper/overview/page.tsx:101` |
| `font-sans` | `var(--font-inter), ui-sans-serif, system-ui, sans-serif` | 25 (+0 `var()`) | `app/global-error.tsx:21`, `app/globals.css:142`, `app/globals.css:157` |
| `font-display` | `var(--font-nudica), ui-sans-serif, system-ui, sans-serif` | 2 (+0 `var()`) | `app/globals.css:153`, `app/layout.tsx:66` |
| `font-mono` | `var(--font-geist-mono), ui-monospace, monospace` | 20 (+2 `var()`) | `app/helper/reports/page.tsx:546`, `app/helper/reports/page.tsx:624`, `app/helper/reports/page.tsx:725` |
| `.tabular-nums` (plain CSS class) | see globals.css | 87 | `app/helper/overview/page.tsx:111`, `app/helper/overview/page.tsx:120`, `app/helper/overview/page.tsx:129` |
| `.font-mono-id` (plain CSS class) | see globals.css | 0 | **unused** |

`text-2xs` is defined and documented ("count badges only") but has no usage. `.font-mono-id` is defined and unused; the code writes `font-mono tabular-nums` instead. Outfit (avatar initials) is not a theme token: it is loaded in `app/layout.tsx` as `--font-outfit` and applied through one arbitrary class (§7).

### 2.5 Motion tokens

| token | value | class uses | `var()` uses | example locations |
|---|---|---|---|---|
| `duration-fast` | 120ms | 31 | 5 | `app/onboarding/page.tsx:799`, `app/onboarding/page.tsx:817` |
| `duration-base` | 180ms | 6 | 6 | `components/layout/sidebar.tsx:432`, `components/layout/sidebar.tsx:440` |
| `duration-slow` | 240ms | 6 | 4 | `app/helper/tickets/[id]/page.tsx:1362`, `components/layout/mobile-nav.tsx:84` |
| `ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 39 | 10 | `app/onboarding/page.tsx:799`, `app/onboarding/page.tsx:817` |
| `ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | 4 | 1 | `app/helper/tickets/[id]/page.tsx:1362`, `components/layout/public-support-sidebar.tsx:79` |
| `animate-enter` (`@utility`) | `animation: enter-rise var(--duration-base) var(--ease-out) both` | 21 | 0 | `app/helper/overview/page.tsx:105`, `app/helper/overview/page.tsx:114` |
| `animate-leave` (`@utility`) | `animation: fade-out-plain var(--duration-fast) var(--ease-out) both` | 0 | 0 | **unused** |
| `animate-fade-in` (`@utility`) | `animation: fade-in-plain 150ms var(--ease-out) both` | 5 | 0 | `app/helper/reports/payouts/[id]/page.tsx:94`, `components/modals/sla-confirmation-modal.tsx:64` |
| `stagger` (`@utility`) | 35ms steps, children 2–6 | 4 | 0 | `app/helper/overview/page.tsx:104`, `app/helpers/[id]/page.tsx:473` |
| `animate-overlay-in` (`@utility`) | `animation: overlay-in 150ms var(--ease-out) both` | 2 | 0 | `components/ui/dialog.tsx:41`, `components/ui/drawer-panel.tsx:55` |
| `animate-overlay-out` (`@utility`) | `animation: overlay-out 120ms var(--ease-out) both` | 2 | 0 | `components/ui/dialog.tsx:41`, `components/ui/drawer-panel.tsx:55` |
| `animate-dialog-in` (`@utility`) | `animation: dialog-in var(--duration-base) var(--ease-out) both` | 1 | 0 | `components/ui/dialog.tsx:63` |
| `animate-dialog-out` (`@utility`) | `animation: dialog-out 120ms var(--ease-out) both` | 1 | 0 | `components/ui/dialog.tsx:63` |
| `animate-menu-in` (`@utility`) | `animation: menu-in var(--duration-fast) var(--ease-out) both` | 5 | 0 | `components/layout/notifications-panel.tsx:129`, `components/ui/dropdown-menu.tsx:46` |
| `animate-menu-out` (`@utility`) | `animation: menu-out 100ms var(--ease-out) both` | 5 | 0 | `components/layout/notifications-panel.tsx:129`, `components/ui/dropdown-menu.tsx:46` |
| `animate-sheet-in` (`@utility`) | `animation: sheet-in-right var(--duration-slow) var(--ease-out) both` | 1 | 0 | `components/ui/drawer-panel.tsx:63` |
| `animate-sheet-out` (`@utility`) | `animation: sheet-out-right var(--duration-base) var(--ease-in-out) both` | 1 | 0 | `components/ui/drawer-panel.tsx:63` |

All motion classes found (`duration-*`, `ease-*`, `delay-*`, `transition*`, `animate-*`):

| value | count | source | example locations |
|---|---|---|---|
| `transition-colors` | 73 | Tailwind default | `app/helper/reports/page.tsx:416`, `app/helper/reports/page.tsx:427`, `app/helper/tickets/[id]/page.tsx:1532` |
| `ease-out` | 39 | token | `app/onboarding/page.tsx:799`, `app/onboarding/page.tsx:817`, `app/onboarding/page.tsx:837` |
| `animate-spin` | 36 | Tailwind default | `app/helper/settings/profile/page.tsx:283`, `app/helper/settings/profile/page.tsx:342`, `app/invite/[token]/page.tsx:387` |
| `duration-fast` | 31 | token | `app/onboarding/page.tsx:799`, `app/onboarding/page.tsx:817`, `app/onboarding/page.tsx:837` |
| `animate-enter` | 21 | token | `app/helper/overview/page.tsx:105`, `app/helper/overview/page.tsx:114`, `app/helper/overview/page.tsx:123` |
| `duration-base` | 6 | token | `components/layout/sidebar.tsx:432`, `components/layout/sidebar.tsx:440`, `components/ui/accordion.tsx:44` |
| `duration-slow` | 6 | token | `app/helper/tickets/[id]/page.tsx:1362`, `components/layout/mobile-nav.tsx:84`, `components/layout/public-support-sidebar.tsx:79` |
| `animate-fade-in` | 5 | token | `app/helper/reports/payouts/[id]/page.tsx:94`, `components/modals/sla-confirmation-modal.tsx:64`, `components/ticket-chat/code-block.tsx:78` |
| `animate-menu-in` | 5 | token | `components/layout/notifications-panel.tsx:129`, `components/ui/dropdown-menu.tsx:46`, `components/ui/dropdown-menu.tsx:234` |
| `animate-menu-out` | 5 | token | `components/layout/notifications-panel.tsx:129`, `components/ui/dropdown-menu.tsx:46`, `components/ui/dropdown-menu.tsx:234` |
| `transition-transform` | 5 | Tailwind default | `components/layout/sidebar.tsx:432`, `components/onboarding/onboarding-checklist.tsx:161`, `components/reports/ticket-transactions.tsx:64` |
| `ease-in-out` | 4 | token | `app/helper/tickets/[id]/page.tsx:1362`, `components/layout/public-support-sidebar.tsx:79`, `components/layout/sidebar.tsx:273` |
| `transition-[width]` | 4 | Tailwind default | `app/helper/tickets/[id]/page.tsx:1362`, `components/layout/public-support-sidebar.tsx:79`, `components/layout/sidebar.tsx:273` |
| `animate-in` | 3 | Tailwind default | `components/layout/mobile-nav.tsx:81`, `components/layout/mobile-nav.tsx:84`, `components/ui/tooltip.tsx:39` |
| `animate-out` | 3 | Tailwind default | `components/layout/mobile-nav.tsx:81`, `components/layout/mobile-nav.tsx:84`, `components/ui/tooltip.tsx:39` |
| `transition-[color,box-shadow]` | 3 | Tailwind default | `components/ui/badge.tsx:8`, `components/ui/radio-group.tsx:30`, `components/ui/slider.tsx:56` |
| `animate-overlay-in` | 2 | token | `components/ui/dialog.tsx:41`, `components/ui/drawer-panel.tsx:55` |
| `animate-overlay-out` | 2 | token | `components/ui/dialog.tsx:41`, `components/ui/drawer-panel.tsx:55` |
| `animate-pulse` | 2 | Tailwind default | `components/ticket-chat/chat-image.tsx:29`, `components/ui/skeleton.tsx:11` |
| `transition-[color,border-color,box-shadow]` | 2 | Tailwind default | `components/ui/input.tsx:11`, `components/ui/textarea.tsx:14` |
| `animate-accordion-down` | 1 | Tailwind default | `components/ui/accordion.tsx:58` |
| `animate-accordion-up` | 1 | Tailwind default | `components/ui/accordion.tsx:58` |
| `animate-dialog-in` | 1 | token | `components/ui/dialog.tsx:63` |
| `animate-dialog-out` | 1 | token | `components/ui/dialog.tsx:63` |
| `animate-sheet-in` | 1 | token | `components/ui/drawer-panel.tsx:63` |
| `animate-sheet-out` | 1 | token | `components/ui/drawer-panel.tsx:63` |
| `transition-[background-color,box-shadow]` | 1 | Tailwind default | `components/ui/switch.tsx:16` |
| `transition-[color,background-color,border-color,box-shadow,transform]` | 1 | Tailwind default | `components/ui/button.tsx:9` |
| `transition-[color,background-color,border-color,box-shadow]` | 1 | Tailwind default | `components/ui/select.tsx:29` |
| `transition-[color,background-color,box-shadow]` | 1 | Tailwind default | `components/ui/accordion.tsx:38` |
| `transition-[grid-template-rows]` | 1 | Tailwind default | `components/layout/sidebar.tsx:440` |
| `transition-[transform,width]` | 1 | Tailwind default | `components/ui/tab-selector.tsx:48` |
| `transition-none` | 1 | Tailwind default | `components/ui/checkbox.tsx:24` |
| `transition-opacity` | 1 | Tailwind default | `components/ui/dialog.tsx:72` |
| `transition-shadow` | 1 | Tailwind default | `components/ui/checkbox.tsx:17` |

Durations and easings are fully tokenised: 130 token occurrences, 0 numeric `duration-NNN`/`delay-NNN` or arbitrary values, and no `transition-all`. `animate-leave` is defined and unused. Bare `transition-colors` appears 73 times while `duration-fast` appears 31 times, so at least 42 of those transitions carry no duration class and run at Tailwind's default 150ms rather than the 120ms token.

### 2.6 Spacing tokens

None are defined. Every padding, margin, gap and size class uses Tailwind's default 4px scale or an arbitrary value (§8).

### 2.7 Other classes defined in globals.css

| class | uses in ts/tsx | example locations |
|---|---|---|
| `.icon` | 11 | `app/helper/tickets/[id]/page.tsx:920`, `components/drawers/add-helper-drawer.tsx:447`, `components/layout/mobile-nav.tsx:49` |
| `.touch-targets` | 1 | `app/support/layout.tsx:41` |
| `.markdown-code-block` | 1 | `components/ticket-chat/code-block.tsx:68` |
| `.markdown-code-block__header` | 1 | `components/ticket-chat/code-block.tsx:69` |
| `.markdown-code-block__lang` | 1 | `components/ticket-chat/code-block.tsx:70` |
| `.markdown-code-block__copy` | 1 | `components/ticket-chat/code-block.tsx:74` |
| `.markdown-code-block__body` | 1 | `components/ticket-chat/code-block.tsx:84` |

<!-- root-only: --radius, --duration-fast, --duration-base, --duration-slow, --btn-sheen-top, --btn-sheen-bottom, --btn-highlight, --btn-drop, --btn-press, --btn-hover-brightness, --btn-light-edge -->
<!-- dark-missing: --radius, --duration-fast, --duration-base, --duration-slow, --btn-sheen-top, --btn-sheen-bottom, --btn-press, --btn-hover-brightness, --btn-light-edge -->
<!-- dark-only:  -->
<!-- var() refs to names not defined in globals.css: --font-inter x1 (app/globals.css:57); --font-nudica x1 (app/globals.css:58); --font-geist-mono x10 (app/globals.css:59); --icon-size x3 (app/globals.css:168); --tw-inset-shadow x2 (app/globals.css:366); --tw-inset-ring-shadow x2 (app/globals.css:366); --tw-ring-offset-shadow x2 (app/globals.css:366); --tw-ring-shadow x2 (app/globals.css:366); --tw-shadow x2 (app/globals.css:366); --font-outfit x1 (components/layout/top-bar.tsx:84); --radix-select-trigger-height x1 (components/ui/select.tsx:101); --radix-select-trigger-width x1 (components/ui/select.tsx:101) -->
### 2.8 Colour literals inside globals.css

| Block | Literal kind | Count |
|---|---|---|
| .dark | `#` | 39 |
| .dark | `oklch` | 34 |
| .dark | `rgba` | 3 |
| :root | `#` | 47 |
| :root | `oklch` | 27 |
| :root | `rgb` | 1 |
| :root | `rgba` | 3 |
| @theme | `rgba` | 8 |
| btn-depth utilities (lines 362–412) | `#` | 6 |
| btn-depth utilities (lines 362–412) | `rgb` | 6 |
| chat code block (lines 605–661) | `color-mix` | 1 |

The chat code-block rules use only `var(--muted)`, `var(--border)`, `var(--background)`, `var(--foreground)`, `var(--muted-foreground)` and one `color-mix()`; they contain no hex values. The `#0000` values in the btn-depth utilities are transparent shadow resets.

### 2.9 Differences from the token table in CLAUDE.md

| Topic | CLAUDE.md | globals.css / usage |
|---|---|---|
| `text-2xs` | "11/14 (count badges only)" | Defined, 0 usages. |
| `text-heading` | Listed without a value | `#0f0f11` light, `#f0f0f2` dark; 3 usages. |
| `muted-foreground` | `#737373` | `oklch(0.556 0 0)` light (equivalent grey), `oklch(0.708 0 0)` dark. |
| `support-header` | Not listed | Defined (`#2d2a49` / `#1e1b34`), 6 usages, all as `text-support-header`. |
| shadcn base colours | Only `background`, `card`, `sidebar` are listed under surfaces | `primary`, `secondary`, `accent`, `muted`, `destructive`, `popover`, `border`, `input`, `ring`, their `-foreground` pairs, `chart-1…5` and seven `sidebar-*` tokens are also defined; `muted`, `border` and `destructive` are among the most used tokens. |
| Radius comment | "`rounded-sm` 4px"; badges "keep `rounded-md`" | The `@theme` comment says "sm 4 (badges)". The Badge primitive uses `rounded-md`. |
| `--radius` | Not listed | `0.625rem` in `:root`, used by the code-block CSS only. |
| Button depth | Not listed in the token table | `btn-depth`, `btn-depth-light` utilities and seven `--btn-*` variables. |
| Motion utilities | Lists `animate-enter`, `animate-fade-in`, `animate-menu-*`, `animate-dialog-*`, `animate-overlay-*`, `animate-sheet-*` | Also defines `animate-leave` (unused). |
| Weights | The list names "500 (`font-medium`)" twice | Weights in use: 400, 450, 500, 550, 600 and also 700 (`font-bold`, 12 usages, §7). |
| Type scale | Eight named sizes | Also in use: `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl` and four arbitrary sizes (§7). |
| Spacing | Not listed (no token group) | Consistent: no spacing tokens exist. |
| Dark values | Table lists light values only | Every colour token has a `.dark` override except where noted above; `--radius`, the durations and five `--btn-*` values are theme-independent. |

## 3. Colours

| Source | Class occurrences | Distinct classes |
|---|---|---|
| Token colour classes | 2351 | 96 |
| Tailwind keyword colours (`transparent`, `white`, `black`, `current`) | 93 | 11 |
| Tailwind default-palette classes | 101 | 36 |
| Arbitrary hex classes (`bg-[#…]`) | 27 | 16 |

Token classes by prefix: `text-` 1299, `bg-` 565, `border-` 380, `ring-` 65, `divide-` 32, `outline-` 4, `fill-` 3, `border-l-` 2, `ring-offset-` 1. No `stroke-*` or `via-*` colour class and no token-based `from-*`/`to-*` stop is used.

### 3a. Token classes

| value | count | source | example locations |
|---|---|---|---|
| `text-muted-foreground` | 534 | token | `app/auth/confirmed/page.tsx:231`, `app/auth/confirmed/page.tsx:249` (89 files) |
| `text-foreground` | 396 | token | `app/auth/confirmed/page.tsx:230`, `app/error.tsx:21` (84 files) |
| `border-border` | 152 | token | `app/auth/confirmed/page.tsx:229`, `app/globals.css:665` (48 files) |
| `bg-brand-primary` | 142 | token | `app/error.tsx:26`, `app/global-error.tsx:30` (48 files) |
| `bg-muted` | 122 | token | `app/auth/confirmed/page.tsx:228`, `app/auth/confirmed/page.tsx:246` (50 files) |
| `text-brand-primary` | 120 | token | `app/auth/confirmed/page.tsx:235`, `app/help/page.tsx:173` (43 files) |
| `bg-card` | 77 | token | `app/auth/confirmed/page.tsx:229`, `app/helper/reports/page.tsx:497` (37 files) |
| `border-brand-primary` | 69 | token | `app/helper/reports/page.tsx:418`, `app/helper/reports/page.tsx:429` (32 files) |
| `border-border-subtle` | 67 | token | `app/helper/reports/payouts/[id]/page.tsx:94`, `app/helper/reports/payouts/[id]/page.tsx:96` (34 files) |
| `text-text-secondary` | 51 | token | `app/helpers/page.tsx:704`, `app/support/get-support/page.tsx:54` (10 files) |
| `bg-background` | 50 | token | `app/globals.css:668`, `app/helper/settings/availability/page.tsx:19` (32 files) |
| `text-text-tertiary` | 46 | token | `app/helpers/page.tsx:579`, `app/helpers/page.tsx:582` (13 files) |
| `text-text-muted` | 42 | token | `app/global-error.tsx:24`, `app/helper/reports/page.tsx:484` (20 files) |
| `ring-brand-primary` | 39 | token | `app/support/tickets/page.tsx:216`, `app/support/tickets/page.tsx:236` (17 files) |
| `text-brand-foreground` | 32 | token | `app/global-error.tsx:30`, `app/help/page.tsx:195` (25 files) |
| `border-border-control` | 31 | token | `app/helper/settings/profile/page.tsx:324`, `app/settings/branding/page.tsx:108` (10 files) |
| `bg-surface-hover` | 30 | token | `app/helpers/page.tsx:802`, `app/onboarding/page.tsx:794` (16 files) |
| `divide-border-subtle` | 28 | token | `app/helper/reports/page.tsx:526`, `app/helper/reports/page.tsx:786` (18 files) |
| `bg-bg-subtle` | 21 | token | `app/helper/reports/page.tsx:484`, `app/helper/tickets/[id]/page.tsx:875` (18 files) |
| `bg-page-muted` | 18 | token | `app/auth/role/page.tsx:53`, `app/auth/signin/page.tsx:72` (12 files) |
| `ring-destructive` | 18 | token | `components/ui/badge.tsx:8`, `components/ui/badge.tsx:17` (7 files) |
| `text-destructive` | 16 | token | `app/helper/tickets/[id]/page.tsx:1223`, `app/helper/tickets/[id]/page.tsx:1496` (10 files) |
| `border-input` | 11 | token | `components/drawers/accept-request-drawer.tsx:66`, `components/drawers/accept-request-drawer.tsx:70` (8 files) |
| `bg-accent` | 10 | token | `components/ui/badge.tsx:19`, `components/ui/button.tsx:18` (5 files) |
| `bg-input` | 10 | token | `components/ui/button.tsx:18`, `components/ui/checkbox.tsx:17` (7 files) |
| `border-destructive` | 10 | token | `app/settings/payment/page.tsx:836`, `app/settings/payment/page.tsx:866` (8 files) |
| `border-primary` | 10 | token | `components/drawers/add-helper-drawer.tsx:313`, `components/drawers/add-helper-drawer.tsx:317` (5 files) |
| `border-sidebar-border` | 10 | token | `components/layout/public-support-sidebar.tsx:79`, `components/layout/public-support-sidebar.tsx:123` (3 files) |
| `bg-destructive` | 9 | token | `components/layout/top-bar.tsx:519`, `components/ui/badge.tsx:17` (4 files) |
| `border-muted-foreground` | 9 | token | `components/drawers/add-helper-drawer.tsx:313`, `components/drawers/add-helper-drawer.tsx:317` (4 files) |
| `text-accent-foreground` | 9 | token | `components/ui/badge.tsx:19`, `components/ui/button.tsx:18` (4 files) |
| `bg-border` | 8 | token | `app/helper/reports/page.tsx:436`, `app/reports/slas/page.tsx:331` (8 files) |
| `bg-primary` | 8 | token | `components/ui/badge.tsx:13`, `components/ui/button.tsx:14` (5 files) |
| `ring-ring` | 8 | token | `components/ui/accordion.tsx:38`, `components/ui/badge.tsx:8` (8 files) |
| `bg-muted-foreground` | 6 | token | `app/helper/settings/payout/page.tsx:107`, `app/helper/settings/payout/page.tsx:108` |
| `border-ring` | 6 | token | `components/ui/accordion.tsx:38`, `components/ui/badge.tsx:8` (6 files) |
| `text-status-success-text` | 6 | token | `app/projects/[id]/invite-contributors/contributors-step.tsx:187`, `app/reports/slas/page.tsx:446` (5 files) |
| `text-support-header` | 6 | token | `components/support/rates-and-details-content.tsx:56`, `components/support/rates-and-details-content.tsx:69` |
| `bg-foreground` | 5 | token | `components/payment/distribution-preview.tsx:98`, `components/ticket-chat/chat-input.tsx:234` (4 files) |
| `bg-sidebar` | 5 | token | `app/support/layout.tsx:29`, `components/layout/mobile-nav.tsx:84` (5 files) |
| `text-sidebar-foreground` | 5 | token | `components/layout/public-support-sidebar.tsx:209`, `components/layout/sidebar.tsx:551` (3 files) |
| `bg-popover` | 4 | token | `components/ui/dropdown-menu.tsx:46`, `components/ui/dropdown-menu.tsx:234` (3 files) |
| `bg-secondary` | 4 | token | `components/ui/badge.tsx:15`, `components/ui/button.tsx:20` |
| `bg-status-success-bg` | 4 | token | `app/reports/slas/page.tsx:446`, `app/reports/slas/page.tsx:561` (3 files) |
| `border-border-avatar` | 4 | token | `app/support/page.tsx:683`, `app/support/page.tsx:687` |
| `divide-border` | 4 | token | `app/settings/project/page.tsx:194`, `app/support/chat/page.tsx:667` (4 files) |
| `text-popover-foreground` | 4 | token | `components/ui/dropdown-menu.tsx:46`, `components/ui/dropdown-menu.tsx:234` (3 files) |
| `text-primary-foreground` | 4 | token | `components/ui/badge.tsx:13`, `components/ui/button.tsx:14` (4 files) |
| `bg-badge-neutral-bg` | 3 | token | `components/ui/badge.tsx:20`, `components/ui/badge.tsx:26` |
| `bg-text-tertiary` | 3 | token | `app/support/get-support/page.tsx:80`, `app/support/sla/page.tsx:48` (3 files) |
| `outline-brand-primary` | 3 | token | `app/helper/reports/page.tsx:593`, `app/reports/support/page.tsx:653` (3 files) |
| `text-chart-2` | 3 | token | `components/layout/notifications-panel.tsx:17`, `components/layout/notifications-panel.tsx:19` |
| `text-text-heading` | 3 | token | `app/global-error.tsx:23`, `app/helpers/page.tsx:765` |
| `bg-border-subtle` | 2 | token | `components/layout/sidebar.tsx:450`, `components/layout/sidebar.tsx:465` |
| `bg-brand-primary-hover` | 2 | token | `app/global-error.tsx:30`, `components/ui/button.tsx:26` |
| `bg-status-high-bg` | 2 | token | `components/ui/error-state.tsx:46`, `lib/status-colors.ts:28` |
| `bg-surface-active` | 2 | token | `components/ui/button.tsx:31`, `components/ui/select.tsx:38` |
| `border-l-brand-primary` | 2 | token | `app/helper/tickets/[id]/page.tsx:1534`, `components/ticket-chat/customer-sidebar-footer.tsx:108` |
| `fill-foreground` | 2 | token | `components/payment/distribution-preview.tsx:123`, `components/ui/tooltip.tsx:45` |
| `text-background` | 2 | token | `components/payment/distribution-preview.tsx:98`, `components/ui/tooltip.tsx:38` |
| `text-badge-muted-text` | 2 | token | `components/ui/badge.tsx:28`, `lib/status-colors.ts:83` |
| `text-badge-neutral-text` | 2 | token | `components/ui/badge.tsx:20`, `components/ui/badge.tsx:26` |
| `text-primary` | 2 | token | `components/ui/button.tsx:23`, `components/ui/radio-group.tsx:30` |
| `text-secondary-foreground` | 2 | token | `components/ui/badge.tsx:15`, `components/ui/button.tsx:20` |
| `text-status-high-text` | 2 | token | `components/ui/error-state.tsx:46`, `lib/status-colors.ts:28` |
| `text-status-warning-text` | 2 | token | `app/projects/[id]/invite-contributors/page.tsx:264`, `lib/status-colors.ts:26` |
| `bg-avatar-1` | 1 | token | `lib/constants.ts:8` |
| `bg-avatar-2` | 1 | token | `lib/constants.ts:9` |
| `bg-avatar-3` | 1 | token | `lib/constants.ts:10` |
| `bg-avatar-4` | 1 | token | `lib/constants.ts:11` |
| `bg-avatar-5` | 1 | token | `lib/constants.ts:12` |
| `bg-avatar-6` | 1 | token | `lib/constants.ts:13` |
| `bg-avatar-7` | 1 | token | `lib/constants.ts:14` |
| `bg-avatar-8` | 1 | token | `lib/constants.ts:15` |
| `bg-avatar-9` | 1 | token | `lib/constants.ts:16` |
| `bg-badge-dot-community` | 1 | token | `lib/status-colors.ts:94` |
| `bg-badge-dot-core` | 1 | token | `lib/status-colors.ts:92` |
| `bg-badge-dot-extended` | 1 | token | `lib/status-colors.ts:97` |
| `bg-badge-info-bg` | 1 | token | `components/ui/badge.tsx:23` |
| `bg-badge-outline-bg` | 1 | token | `components/ui/badge.tsx:22` |
| `bg-badge-strong-bg` | 1 | token | `components/ui/badge.tsx:30` |
| `bg-badge-success-bg` | 1 | token | `components/ui/badge.tsx:24` |
| `bg-primary-foreground` | 1 | token | `components/ui/switch.tsx:24` |
| `bg-status-warning-bg` | 1 | token | `lib/status-colors.ts:26` |
| `border-badge-outline-border` | 1 | token | `components/ui/badge.tsx:22` |
| `fill-primary` | 1 | token | `components/ui/radio-group.tsx:39` |
| `outline-ring` | 1 | token | `app/globals.css:665` |
| `ring-offset-background` | 1 | token | `components/ui/dialog.tsx:72` |
| `text-badge-emphasis-text` | 1 | token | `lib/status-colors.ts:79` |
| `text-badge-info-text` | 1 | token | `components/ui/badge.tsx:23` |
| `text-badge-outline-text` | 1 | token | `components/ui/badge.tsx:22` |
| `text-badge-strong-text` | 1 | token | `components/ui/badge.tsx:30` |
| `text-badge-success-text` | 1 | token | `components/ui/badge.tsx:24` |
| `text-brand-primary-hover` | 1 | token | `app/support/get-support/page.tsx:141` |
| `text-card-foreground` | 1 | token | `components/ui/card.tsx:10` |
| `text-chart-3` | 1 | token | `components/layout/notifications-panel.tsx:15` |

**Alpha modifiers on token colours.** 258 of the 2351 token occurrences carry an opacity modifier, in 41 distinct class/alpha pairs. Steps in use: `/40` ×65, `/50` ×55, `/10` ×36, `/30` ×20, `/90` ×18, `/80` ×17, `/20` ×16, `/60` ×11, `/5` ×9, `/15` ×5, `/70` ×3, `/[0.08]` ×3.

| value | count | source | example locations |
|---|---|---|---|
| `bg-muted/50` | 41 | token + alpha modifier | `app/auth/confirmed/page.tsx:228`, `app/auth/confirmed/page.tsx:246` |
| `bg-brand-primary/10` | 35 | token + alpha modifier | `app/helper/overview/page.tsx:174`, `app/helper/settings/profile/page.tsx:324` |
| `ring-brand-primary/40` | 28 | token + alpha modifier | `components/drawers/end-ticket-drawer.tsx:146`, `components/drawers/end-ticket-drawer.tsx:209` |
| `bg-brand-primary/90` | 13 | token + alpha modifier | `app/error.tsx:26`, `app/help/page.tsx:195` |
| `bg-muted/40` | 12 | token + alpha modifier | `app/helper/tickets/[id]/page.tsx:1178`, `app/settings/payment/page.tsx:733` |
| `text-foreground/80` | 11 | token + alpha modifier | `app/helpers/[id]/page.tsx:435`, `app/helpers/[id]/page.tsx:439` |
| `bg-brand-primary/5` | 9 | token + alpha modifier | `app/helper/reports/page.tsx:490`, `app/onboarding/page.tsx:521` |
| `border-muted-foreground/40` | 9 | token + alpha modifier | `components/drawers/add-helper-drawer.tsx:313`, `components/drawers/add-helper-drawer.tsx:317` |
| `ring-destructive/20` | 9 | token + alpha modifier | `components/ui/badge.tsx:8`, `components/ui/badge.tsx:17` |
| `ring-destructive/40` | 9 | token + alpha modifier | `components/ui/badge.tsx:8`, `components/ui/badge.tsx:17` |
| `border-brand-primary/30` | 7 | token + alpha modifier | `app/helper/reports/page.tsx:490`, `app/user/reports/page.tsx:407` |
| `ring-ring/50` | 7 | token + alpha modifier | `components/ui/accordion.tsx:38`, `components/ui/badge.tsx:8` |
| `bg-input/30` | 6 | token + alpha modifier | `components/ui/button.tsx:18`, `components/ui/checkbox.tsx:17` |
| `bg-muted-foreground/40` | 6 | token + alpha modifier | `app/helper/settings/payout/page.tsx:107`, `app/helper/settings/payout/page.tsx:108` |
| `bg-brand-primary/15` | 5 | token + alpha modifier | `app/helper/overview/page.tsx:174`, `components/layout/sidebar.tsx:387` |
| `bg-muted/30` | 5 | token + alpha modifier | `app/help/page.tsx:186`, `components/auth/sign-in-options.tsx:151` |
| `border-border/60` | 4 | token + alpha modifier | `components/drawers/add-helper-drawer.tsx:365`, `components/drawers/add-helper-drawer.tsx:442` |
| `bg-brand-primary/20` | 3 | token + alpha modifier | `components/onboarding/onboarding-checklist.tsx:14`, `components/onboarding/onboarding-checklist.tsx:158` |
| `bg-brand-primary/[0.08]` | 3 | token + alpha modifier | `components/layout/public-support-sidebar.tsx:142`, `components/layout/sidebar.tsx:339` |
| `bg-muted/60` | 3 | token + alpha modifier | `components/drawers/add-helper-drawer.tsx:385`, `components/drawers/add-helper-drawer.tsx:449` |
| `ring-brand-primary/20` | 3 | token + alpha modifier | `components/ui/input.tsx:12`, `components/ui/select.tsx:29` |
| `text-muted-foreground/70` | 3 | token + alpha modifier | `app/helpers/[id]/page.tsx:434`, `app/helpers/[id]/page.tsx:438` |
| `bg-destructive/60` | 2 | token + alpha modifier | `components/ui/badge.tsx:17`, `components/ui/button.tsx:16` |
| `bg-destructive/90` | 2 | token + alpha modifier | `components/ui/badge.tsx:17`, `components/ui/button.tsx:16` |
| `bg-input/50` | 2 | token + alpha modifier | `components/ui/button.tsx:18`, `components/ui/select.tsx:33` |
| `bg-primary/90` | 2 | token + alpha modifier | `components/ui/badge.tsx:13`, `components/ui/button.tsx:14` |
| `border-brand-primary/50` | 2 | token + alpha modifier | `app/onboarding/page.tsx:522`, `app/onboarding/page.tsx:931` |
| `ring-brand-primary/30` | 2 | token + alpha modifier | `components/ticket-chat/chat-input.tsx:218`, `components/ticket-chat/right-sidebar-collapse.tsx:62` |
| `text-brand-primary/80` | 2 | token + alpha modifier | `app/slas/[id]/page.tsx:245`, `components/modals/new-ticket-modal.tsx:130` |
| `text-muted-foreground/80` | 2 | token + alpha modifier | `app/helper/tickets/[id]/page.tsx:912`, `components/ticket-chat/ticket-chat.tsx:347` |
| `bg-accent/50` | 1 | token + alpha modifier | `components/ui/button.tsx:22` |
| `bg-background/60` | 1 | token + alpha modifier | `components/drawers/add-helper-drawer.tsx:470` |
| `bg-bg-subtle/50` | 1 | token + alpha modifier | `components/ui/list.tsx:88` |
| `bg-destructive/10` | 1 | token + alpha modifier | `components/ui/dropdown-menu.tsx:78` |
| `bg-destructive/20` | 1 | token + alpha modifier | `components/ui/dropdown-menu.tsx:78` |
| `bg-input/80` | 1 | token + alpha modifier | `components/ui/switch.tsx:16` |
| `bg-secondary/80` | 1 | token + alpha modifier | `components/ui/button.tsx:20` |
| `bg-secondary/90` | 1 | token + alpha modifier | `components/ui/badge.tsx:15` |
| `border-brand-primary/40` | 1 | token + alpha modifier | `components/onboarding/onboarding-checklist.tsx:73` |
| `border-brand-primary/60` | 1 | token + alpha modifier | `components/drawers/add-helper-drawer.tsx:384` |
| `outline-ring/50` | 1 | token + alpha modifier | `app/globals.css:665` |

**Tailwind keyword colours** (not project tokens; `text-white`, `bg-white/*` and `bg-black/*` do not follow the theme):

| value | count | source | locations |
|---|---|---|---|
| `bg-transparent` | 38 | Tailwind keyword (not a project token) | `app/helper/reports/page.tsx:116`, `app/helper/reports/payouts/[id]/page.tsx:60`, `app/helper/reports/payouts/[id]/page.tsx:68`, `app/helper/tickets/[id]/page.tsx:1173`, `app/helper/tickets/[id]/page.tsx:1250`, `app/helper/tickets/[id]/page.tsx:1335`, `app/helper/tickets/[id]/page.tsx:1503`, `app/helpers/[id]/page.tsx:77`, … +28 more lines |
| `border-transparent` | 24 | Tailwind keyword (not a project token) | `app/helper/reports/page.tsx:419`, `app/helper/reports/page.tsx:430`, `app/reports/slas/page.tsx:314`, `app/reports/slas/page.tsx:324`, `app/reports/support/page.tsx:441`, `app/settings/payment/page.tsx:461`, `app/settings/payment/page.tsx:471`, `app/slas/page.tsx:141`, … +16 more lines |
| `text-white` | 21 | Tailwind keyword (not a project token) | `app/helper/settings/payout/page.tsx:125`, `app/helper/settings/profile/page.tsx:257`, `app/onboarding/join/page.tsx:142`, `app/onboarding/page.tsx:884`, `app/reports/slas/page.tsx:427`, `app/reports/slas/page.tsx:540`, `app/settings/payment/page.tsx:1024`, `app/settings/profile/page.tsx:214`, … +10 more lines |
| `bg-black/30` | 3 | Tailwind keyword (not a project token) | `app/helper/tickets/[id]/page.tsx:1357`, `components/layout/mobile-nav.tsx:81`, `components/ticket-chat/ticket-chat.tsx:648` |
| `bg-black/20` | 1 | Tailwind keyword (not a project token) | `components/ui/drawer-panel.tsx:46` |
| `bg-black/50` | 1 | Tailwind keyword (not a project token) | `components/ui/dialog.tsx:41` |
| `bg-white/10` | 1 | Tailwind keyword (not a project token) | `components/ui/select.tsx:38` |
| `bg-white/5` | 1 | Tailwind keyword (not a project token) | `components/ui/select.tsx:38` |
| `border-white/10` | 1 | Tailwind keyword (not a project token) | `components/ui/select.tsx:38` |
| `fill-current` | 1 | Tailwind keyword (not a project token) | `components/ui/dropdown-menu.tsx:139` |
| `text-current` | 1 | Tailwind keyword (not a project token) | `components/ui/checkbox.tsx:24` |

### 3b. Tailwind default-palette classes

101 occurrences of 36 distinct classes in 19 files. By hue: amber 56, red 31, green 9, yellow 3, emerald 2. No grey-family palette class (`gray`, `slate`, `zinc`, `neutral`, `stone`) is used; `grep` for `(text|bg|border)-(gray|slate|zinc|neutral|stone)-N` returns 0.

| value | count | source | locations |
|---|---|---|---|
| `border-amber-300` | 10 | hardcoded (Tailwind default palette) | `components/drawers/end-ticket-drawer.tsx:137`, `components/drawers/end-ticket-drawer.tsx:176`, `components/layout/sandbox-banner.tsx:21`, `components/layout/support-sandbox-banner.tsx:25`, `components/ticket-chat/end-session-request.tsx:123`, `components/ticket-chat/guest-ticket.tsx:31`, `components/ticket-chat/ticket-chat.tsx:460`, `components/ticket-chat/time-entry-review.tsx:502`, `components/ticket-chat/time-entry-review.tsx:544`, `components/ticket-chat/time-entry-review.tsx:578` |
| `bg-amber-50` | 9 | hardcoded (Tailwind default palette) | `app/helper/tickets/[id]/page.tsx:1137`, `components/drawers/end-ticket-drawer.tsx:137`, `components/drawers/end-ticket-drawer.tsx:176`, `components/ticket-chat/end-session-request.tsx:123`, `components/ticket-chat/guest-ticket.tsx:31`, `components/ticket-chat/ticket-chat.tsx:471`, `components/ticket-chat/time-entry-review.tsx:502`, `components/ticket-chat/time-entry-review.tsx:544`, `components/ticket-chat/time-entry-review.tsx:578` |
| `text-amber-900` | 6 | hardcoded (Tailwind default palette) | `app/helper/tickets/[id]/page.tsx:1137`, `components/layout/sandbox-banner.tsx:21`, `components/layout/support-sandbox-banner.tsx:25`, `components/ticket-chat/guest-ticket.tsx:31`, `components/ticket-chat/ticket-chat.tsx:460`, `components/ticket-chat/ticket-chat.tsx:471` |
| `bg-amber-950/40` | 5 | hardcoded (Tailwind default palette) | `components/layout/sandbox-banner.tsx:21`, `components/layout/support-sandbox-banner.tsx:25`, `components/ticket-chat/guest-ticket.tsx:31`, `components/ticket-chat/ticket-chat.tsx:460`, `components/ticket-chat/ticket-chat.tsx:471` |
| `border-amber-800` | 5 | hardcoded (Tailwind default palette) | `components/layout/sandbox-banner.tsx:21`, `components/layout/support-sandbox-banner.tsx:25`, `components/ticket-chat/guest-ticket.tsx:31`, `components/ticket-chat/ticket-chat.tsx:460`, `components/ticket-chat/ticket-chat.tsx:471` |
| `text-amber-100` | 5 | hardcoded (Tailwind default palette) | `components/layout/sandbox-banner.tsx:21`, `components/layout/support-sandbox-banner.tsx:25`, `components/ticket-chat/guest-ticket.tsx:31`, `components/ticket-chat/ticket-chat.tsx:460`, `components/ticket-chat/ticket-chat.tsx:471` |
| `text-amber-700` | 5 | hardcoded (Tailwind default palette) | `components/drawers/end-ticket-drawer.tsx:178`, `components/ticket-chat/end-session-request.tsx:127`, `components/ticket-chat/time-entry-review.tsx:506`, `components/ticket-chat/time-entry-review.tsx:548`, `components/ticket-chat/time-entry-review.tsx:582` |
| `text-red-700` | 5 | hardcoded (Tailwind default palette) | `app/helper/reports/page.tsx:641`, `app/helper/reports/payouts/[id]/page.tsx:148`, `app/reports/support/page.tsx:863`, `app/reports/support/page.tsx:933`, `components/ticket-chat/time-entry-review.tsx:115` |
| `bg-red-50` | 4 | hardcoded (Tailwind default palette) | `app/landing-page/page.tsx:215`, `components/auth/helper-invite-acceptance.tsx:94`, `components/ticket-chat/ticket-chat.tsx:462`, `components/ticket-chat/time-entry-review.tsx:115` |
| `text-green-600` | 4 | hardcoded (Tailwind default palette) | `app/invite/[token]/page.tsx:322`, `app/onboarding/join/page.tsx:171`, `app/projects/[id]/page.tsx:180`, `components/drawers/add-helper-drawer.tsx:452` |
| `text-red-600` | 4 | hardcoded (Tailwind default palette) | `app/helper/tickets/[id]/page.tsx:1466`, `app/landing-page/page.tsx:215`, `components/auth/helper-invite-acceptance.tsx:95`, `components/drawers/add-helper-drawer.tsx:497` |
| `bg-amber-100` | 3 | hardcoded (Tailwind default palette) | `components/layout/sandbox-banner.tsx:21`, `components/layout/support-sandbox-banner.tsx:25`, `components/ticket-chat/ticket-chat.tsx:460` |
| `bg-green-100` | 3 | hardcoded (Tailwind default palette) | `app/helper/reports/payouts/[id]/page.tsx:18` ×2, `app/helpers/page.tsx:704` |
| `border-red-200` | 3 | hardcoded (Tailwind default palette) | `components/auth/helper-invite-acceptance.tsx:94`, `components/ticket-chat/ticket-chat.tsx:462`, `components/ticket-chat/time-entry-review.tsx:344` |
| `text-red-500` | 3 | hardcoded (Tailwind default palette) | `app/invite/[token]/page.tsx:287`, `app/landing-page/page.tsx:215`, `components/auth/helper-invite-acceptance.tsx:66` |
| `bg-amber-800` | 2 | hardcoded (Tailwind default palette) | `components/layout/sandbox-banner.tsx:32`, `components/ticket-chat/ticket-chat.tsx:532` |
| `bg-amber-900` | 2 | hardcoded (Tailwind default palette) | `components/layout/sandbox-banner.tsx:32`, `components/ticket-chat/ticket-chat.tsx:532` |
| `bg-red-100` | 2 | hardcoded (Tailwind default palette) | `app/helper/reports/payouts/[id]/page.tsx:20` ×2 |
| `bg-yellow-100` | 2 | hardcoded (Tailwind default palette) | `app/helper/reports/payouts/[id]/page.tsx:19` ×2 |
| `border-amber-200` | 2 | hardcoded (Tailwind default palette) | `app/helper/tickets/[id]/page.tsx:1137`, `components/ticket-chat/ticket-chat.tsx:471` |
| `text-amber-50` | 2 | hardcoded (Tailwind default palette) | `components/layout/sandbox-banner.tsx:32`, `components/ticket-chat/ticket-chat.tsx:532` |
| `bg-emerald-50` | 1 | hardcoded (Tailwind default palette) | `components/ticket-chat/time-entry-review.tsx:114` |
| `bg-red-50/60` | 1 | hardcoded (Tailwind default palette) | `components/ticket-chat/time-entry-review.tsx:344` |
| `bg-red-50/80` | 1 | hardcoded (Tailwind default palette) | `components/drawers/add-helper-drawer.tsx:496` |
| `bg-red-500` | 1 | hardcoded (Tailwind default palette) | `components/modals/image-upload-modal.tsx:199` |
| `bg-red-600` | 1 | hardcoded (Tailwind default palette) | `components/modals/image-upload-modal.tsx:199` |
| `bg-red-950/40` | 1 | hardcoded (Tailwind default palette) | `components/ticket-chat/ticket-chat.tsx:462` |
| `border-red-200/60` | 1 | hardcoded (Tailwind default palette) | `components/drawers/add-helper-drawer.tsx:496` |
| `border-red-800` | 1 | hardcoded (Tailwind default palette) | `components/ticket-chat/ticket-chat.tsx:462` |
| `text-emerald-700` | 1 | hardcoded (Tailwind default palette) | `components/ticket-chat/time-entry-review.tsx:114` |
| `text-green-700` | 1 | hardcoded (Tailwind default palette) | `app/helpers/page.tsx:704` |
| `text-green-800` | 1 | hardcoded (Tailwind default palette) | `app/helper/reports/payouts/[id]/page.tsx:18` |
| `text-red-100` | 1 | hardcoded (Tailwind default palette) | `components/ticket-chat/ticket-chat.tsx:462` |
| `text-red-800` | 1 | hardcoded (Tailwind default palette) | `app/helper/reports/payouts/[id]/page.tsx:20` |
| `text-red-900` | 1 | hardcoded (Tailwind default palette) | `components/ticket-chat/ticket-chat.tsx:462` |
| `text-yellow-800` | 1 | hardcoded (Tailwind default palette) | `app/helper/reports/payouts/[id]/page.tsx:19` |

By file:

| file | palette-class count |
|---|---|
| `components/ticket-chat/ticket-chat.tsx` | 21 |
| `components/ticket-chat/time-entry-review.tsx` | 15 |
| `app/helper/reports/payouts/[id]/page.tsx` | 10 |
| `components/layout/sandbox-banner.tsx` | 9 |
| `components/ticket-chat/guest-ticket.tsx` | 6 |
| `components/layout/support-sandbox-banner.tsx` | 6 |
| `components/drawers/end-ticket-drawer.tsx` | 5 |
| `app/helper/tickets/[id]/page.tsx` | 4 |
| `components/auth/helper-invite-acceptance.tsx` | 4 |
| `components/drawers/add-helper-drawer.tsx` | 4 |
| `components/ticket-chat/end-session-request.tsx` | 3 |
| `app/landing-page/page.tsx` | 3 |
| `app/reports/support/page.tsx` | 2 |
| `app/helpers/page.tsx` | 2 |
| `app/invite/[token]/page.tsx` | 2 |
| `components/modals/image-upload-modal.tsx` | 2 |
| `app/helper/reports/page.tsx` | 1 |
| `app/onboarding/join/page.tsx` | 1 |
| `app/projects/[id]/page.tsx` | 1 |

### 3c. Hardcoded colour values

45 hex literals in 14 non-test ts/tsx files. No `rgb()`, `rgba()`, `hsl()`, `oklch()` or `color-mix()` literal exists outside `globals.css`. 27 of the 45 sit in arbitrary classes, 2 in inline `style`, and 16 in TS constants or props.

**Arbitrary colour classes**

| value | count | source | CLAUDE.md exception | locations |
|---|---|---|---|---|
| `bg-[#635bff]` | 5 | hardcoded | yes: Stripe brand | `app/helper/settings/payout/page.tsx:99`, `app/helper/settings/payout/page.tsx:125`, `app/settings/payment/page.tsx:1008`, `app/settings/payment/page.tsx:1024`, `app/user/settings/payment/page.tsx:212` |
| `bg-[#5851e5]` (hover) | 3 | hardcoded | yes: Stripe brand | `app/helper/settings/payout/page.tsx:125`, `app/settings/payment/page.tsx:1024`, `app/user/settings/payment/page.tsx:212` |
| `bg-[#24292e]` | 2 | hardcoded | yes: GitHub brand | `app/onboarding/join/page.tsx:142`, `app/onboarding/page.tsx:884` |
| `bg-[#1b1f23]` (hover) | 2 | hardcoded | yes: GitHub brand | `app/onboarding/join/page.tsx:142`, `app/onboarding/page.tsx:884` |
| `border-[#24292e]` | 1 | hardcoded | yes: GitHub brand | `app/onboarding/join/page.tsx:142` |
| `bg-[#24292f]` | 1 | hardcoded | yes: GitHub brand tile (commented as such in source) | `app/settings/payment/page.tsx:999` |
| `text-[#24292f]` | 1 | hardcoded | yes: same tile; sets the `Logo` colour to the tile's own background colour | `app/settings/payment/page.tsx:1000` |
| `bg-[#f09191]` | 2 | hardcoded | no (status dot) | `app/helper/tickets/[id]/page.tsx:1550`, `components/ticket-chat/customer-sidebar-footer.tsx:132` |
| `from-[#c5b0ef]` | 2 | hardcoded | no (gradient stop) | `components/support/rates-and-details-content.tsx:55`, `components/support/resources-content.tsx:76` |
| `to-[#b8a0e8]` | 2 | hardcoded | no (gradient stop) | `components/support/rates-and-details-content.tsx:55`, `components/support/resources-content.tsx:76` |
| `from-[#b8a0e8]` (hover) | 1 | hardcoded | no (gradient stop) | `components/support/resources-content.tsx:76` |
| `to-[#ab90e0]` (hover) | 1 | hardcoded | no (gradient stop) | `components/support/resources-content.tsx:76` |
| `from-[#e7e5fd]` | 1 | hardcoded | no (gradient stop) | `components/support/rates-and-details-content.tsx:68` |
| `to-[#d8d4f7]` | 1 | hardcoded | no (gradient stop) | `components/support/rates-and-details-content.tsx:68` |
| `from-[#f9f7ff]` | 1 | hardcoded | no (gradient stop) | `components/support/rates-and-details-content.tsx:81` |
| `to-[#f0ecff]` | 1 | hardcoded | no (gradient stop) | `components/support/rates-and-details-content.tsx:81` |

Total 27: 15 under an exception (Stripe 8, GitHub 7), 12 not (10 gradient stops, 2 status dots).

**Inline `style` and TS constants**

| value | count | source | CLAUDE.md exception | locations |
|---|---|---|---|---|
| `backgroundColor: "#24292e"` (inline style on a Button) | 2 | hardcoded | yes: GitHub brand | `app/helper/settings/profile/page.tsx:258`, `app/settings/profile/page.tsx:215` |
| `"#554abf"` default for `primary_color` (2 fallbacks, 1 input placeholder) | 3 | hardcoded | yes: project `primary_color` (duplicates the `brand-primary` light value) | `app/settings/branding/page.tsx:27`, `app/settings/branding/page.tsx:31`, `app/settings/branding/page.tsx:147` |
| `avatarColorsHex` (9 values, identical to the light `avatar-1…9` tokens) | 9 | hardcoded | yes: avatar palette | `lib/constants.ts:21`–`lib/constants.ts:29` |
| `slaColors = ["#cbbcf6", "#d0f6bc", "#f6e6bc", "#bcedf6"]` (the values of `avatar-5`, `-6`, `-4`, `-3`, redeclared locally) | 4 | hardcoded | partly: avatar-palette values, but not read from `lib/constants` | `app/slas/page.tsx:19` |

Total 18. Together with the 27 class literals this gives 45: **29 fall under a CLAUDE.md exception** (Stripe 8, GitHub 9, `primary_color` 3, avatar palette 9) and **16 do not** (gradient stops 10, `#f09191` 2, `slaColors` 4).

**Colour values the hex regex does not see**

| value | count | source | locations |
|---|---|---|---|
| Numeric RGB tuples for the PDF export: `BRAND = [59, 91, 219]` (commented "brand-primary, approximated for print"; `brand-primary` is `#554abf` = 85, 74, 191), `TEXT = [17, 24, 39]`, `MUTED = [107, 114, 128]`, `TICKET_FILL = [238, 242, 255]`, `lineColor: [225, 225, 225]`, `fillColor: [247, 249, 255]` | 6 | hardcoded (jsPDF cannot read CSS variables) | `lib/report-pdf.ts:9`–`lib/report-pdf.ts:12`, `lib/report-pdf.ts:114`, `lib/report-pdf.ts:116` |
| `fill="white"`, `fill="black"` inside the loader's SVG mask | 2 | hardcoded (mask values, not visible colours) | `components/ui/loader.tsx:51`, `components/ui/loader.tsx:52` |
| `var(--muted-foreground)` in inline `style` and `HEADING_STYLE` | 7 | token through `var()` | `app/helper/tickets/[id]/page.tsx:966`, `app/helper/tickets/[id]/page.tsx:1090`, `app/helper/tickets/[id]/page.tsx:1122`, `components/ticket-chat/customer-chat-intro.tsx:79`, `components/ticket-chat/sidebar-section.tsx:18`, `components/ticket-chat/ticket-chat.tsx:408`, `components/ticket-chat/ticket-chat.tsx:443` |
| `react-syntax-highlighter` `one-light` Prism theme (third-party colour set, light only) | 1 | third-party (chat code block: exception) | `components/ticket-chat/code-block.tsx:11`, `components/ticket-chat/code-block.tsx:87` |

**Inline `style` attributes overall.** 76 `style={…}` attributes in 33 files. By purpose: grid templates through shared constants or literals (`*_GRID`, `gridTemplateColumns`) 32; data-driven `backgroundColor` (project `primary_color`, `getAvatarColorHexForId`, `helper.color`, `entityColor`, `sla.color`, the `Header` prop) 19; mono/tabular font stacks with `var(--muted-foreground)` 6; fixed lengths (`marginTop: "22px"`, `rowGap`) 6; transforms and measured positions 4; the two GitHub hex fills above 2; and 7 others (Sonner CSS variables 1, Prism theme 1, `HEADING_STYLE` 2, avatar radius override 2, the Cousine `fontFamily` 1).

## 4. Border radius

| Source | Occurrences |
|---|---|
| Token (`rounded-sm`/`-md`/`-lg`/`-xl`, including `rounded-l-xl`) | 246 |
| Tailwind default (`rounded-full`, bare `rounded`, `rounded-none`, `rounded-xs`) | 67 |
| Hardcoded `rounded-[…]` | 16 (9 are the squircle map in `lib/constants.ts`, 7 are outside it) |

| value | count | source | example locations |
|---|---|---|---|
| `rounded-lg` | 159 | token | `app/auth/confirmed/page.tsx:229`, `app/helper/reports/page.tsx:484`, `app/helper/reports/page.tsx:490` (59 files) |
| `rounded-md` | 67 | token | `app/global-error.tsx:30`, `app/helper/reports/payouts/[id]/page.tsx:98`, `app/helper/settings/profile/page.tsx:324` (38 files) |
| `rounded-full` | 38 | Tailwind default | `app/helper/settings/payout/page.tsx:107`, `app/helper/settings/payout/page.tsx:108`, `app/helper/settings/payout/page.tsx:109` (23 files) |
| `rounded` | 25 | Tailwind default | `app/helper/reports/page.tsx:503`, `app/helper/reports/page.tsx:764`, `app/helper/tickets/[id]/page.tsx:1466` (15 files) |
| `rounded-sm` | 13 | token | `app/settings/payment/page.tsx:1064`, `components/drawers/end-ticket-drawer.tsx:146`, `components/drawers/end-ticket-drawer.tsx:209` (9 files) |
| `rounded-xl` | 6 | token | `components/drawers/add-helper-drawer.tsx:365`, `components/drawers/add-helper-drawer.tsx:442`, `components/drawers/add-helper-drawer.tsx:449` |
| `rounded-[12px]` | 5 | hardcoded | `app/support/page.tsx:683`, `app/support/page.tsx:687`, `app/support/page.tsx:741`, `app/support/page.tsx:748`, `lib/constants.ts:74` |
| `rounded-[11px]` | 3 | hardcoded | `components/ui/skeleton.tsx:41`, `components/ui/skeleton.tsx:74`, `lib/constants.ts:73` |
| `rounded-none` | 3 | Tailwind default | `app/helper/reports/payouts/[id]/page.tsx:124`, `components/ui/dialog.tsx:63`, `components/ui/drawer-panel.tsx:64` |
| `rounded-[8px]` | 2 | hardcoded | `lib/constants.ts:70`, `lib/constants.ts:71` |
| `rounded-[10px]` | 1 | hardcoded | `lib/constants.ts:72` |
| `rounded-[14px]` | 1 | hardcoded | `lib/constants.ts:75` |
| `rounded-[16.5px]` | 1 | hardcoded | `lib/constants.ts:76` |
| `rounded-[2px]` | 1 | hardcoded | `components/ui/tooltip.tsx:45` |
| `rounded-[7px]` | 1 | hardcoded | `lib/constants.ts:69` |
| `rounded-[9px]` | 1 | hardcoded | `lib/constants.ts:83` |
| `rounded-l-xl` | 1 | token | `components/ui/drawer-panel.tsx:62` |
| `rounded-xs` | 1 | Tailwind default | `components/ui/dialog.tsx:72` |

Bare `rounded` resolves to Tailwind's default 4px, the same value as the `rounded-sm` token; the two spellings appear 25 and 13 times. `rounded-full` (38) is used for dots, pills, progress tracks and round buttons. No `rounded-2xl` or `rounded-3xl` is used.

**Squircle map (`src/lib/constants.ts`)**

| element size (key) | class | references to `SQUIRCLE_RADIUS[key]` | source |
|---|---|---|---|
| 20px | `rounded-[7px]` | 2 | hardcoded (documented map) |
| 22px | `rounded-[8px]` | 1 | hardcoded (documented map) |
| 24px | `rounded-[8px]` | 1 | hardcoded (documented map) |
| 28px | `rounded-[10px]` | 2 | hardcoded (documented map) |
| 32px | `rounded-[11px]` | 23 | hardcoded (documented map) |
| 36px | `rounded-[12px]` | 1 | hardcoded (documented map) |
| 42px | `rounded-[14px]` | 6 | hardcoded (documented map) |
| 48px | `rounded-[16.5px]` | 1 | hardcoded (documented map) |
| any other size | `rounded-[9px]` (fallback of `squircleRadiusClass`) | 2 calls: `components/layout/top-bar.tsx:77`, `components/layout/top-bar.tsx:96` | hardcoded (documented map) |

`SQUIRCLE_RADIUS` or `squircleRadiusClass` is referenced 62 times in 19 files (including the definitions in `lib/constants.ts`).

Arbitrary radii outside the map:

| value | count | source | locations |
|---|---|---|---|
| `rounded-[12px]` (same value as `SQUIRCLE_RADIUS[36]` and the `rounded-xl` token, written inline) | 4 | hardcoded | `app/support/page.tsx:683`, `app/support/page.tsx:687`, `app/support/page.tsx:741`, `app/support/page.tsx:748` |
| `rounded-[11px]` (same value as `SQUIRCLE_RADIUS[32]`, written inline) | 2 | hardcoded | `components/ui/skeleton.tsx:41`, `components/ui/skeleton.tsx:74` |
| `rounded-[2px]` (tooltip arrow) | 1 | hardcoded | `components/ui/tooltip.tsx:45` |
| inline `borderRadius: radiusOverride` (caller-supplied) | 2 | data-driven | `components/ui/profile-avatar.tsx:66`, `components/ui/profile-avatar.tsx:70` |

## 5. Shadows

| Source | Occurrences |
|---|---|
| Token (`shadow-control`, `-soft`, `-popover`, `-modal`, `-tab`) | 18 |
| Tailwind default (`shadow-sm`, `-xs`, `-md`, `-2xl`) | 27 |
| `shadow-none` (reset) | 15 |
| Arbitrary `shadow-[…]`, `drop-shadow*`, `inset-shadow*`, `text-shadow*` | 0 |
| Inline `boxShadow` in ts/tsx | 0 |

| value | count | source | locations |
|---|---|---|---|
| `shadow-sm` | 16 | Tailwind default | `app/helper/tickets/[id]/page.tsx:881`, `app/projects/[id]/page.tsx:146`, `app/projects/[id]/page.tsx:149`, `app/projects/[id]/page.tsx:230`, `app/support/get-support/page.tsx:53`, `app/support/get-support/page.tsx:68`, `app/support/page.tsx:597`, `app/support/sla/page.tsx:45`, `components/drawers/add-helper-drawer.tsx:248`, `components/drawers/log-time-drawer.tsx:102`, `components/modals/unsaved-changes-modal.tsx:43`, `components/support/resources-content.tsx:76`, `components/support/ticket-unavailable-notice.tsx:36`, `components/support/ticket-unavailable-notice.tsx:56`, `components/support/ticket-unavailable-notice.tsx:68`, `components/ui/slider.tsx:56` |
| `shadow-none` | 15 | Tailwind default | `app/helpers/page.tsx:603`, `app/support/tickets/page.tsx:281`, `app/tickets/page.tsx:439`, `app/user/reports/page.tsx:414`, `app/user/reports/page.tsx:659`, `components/support/about-support-content.tsx:48`, `components/support/about-support-content.tsx:85`, `components/support/about-support-content.tsx:137`, `components/support/rates-and-details-content.tsx:45`, `components/support/rates-and-details-content.tsx:54`, `components/support/rates-and-details-content.tsx:67`, `components/support/rates-and-details-content.tsx:80`, `components/support/rates-and-details-content.tsx:97`, `components/support/rates-and-details-content.tsx:115`, `components/ui/card.tsx:10` |
| `shadow-popover` | 8 | token | `components/layout/notifications-panel.tsx:129`, `components/payment/distribution-preview.tsx:98`, `components/ui/dropdown-menu.tsx:46`, `components/ui/dropdown-menu.tsx:234`, `components/ui/popover.tsx:39`, `components/ui/select.tsx:87`, `components/ui/sonner.tsx:28`, `components/ui/tooltip.tsx:38` |
| `shadow-xs` | 6 | Tailwind default | `components/ui/checkbox.tsx:17`, `components/ui/input.tsx:11`, `components/ui/radio-group.tsx:30`, `components/ui/select.tsx:29`, `components/ui/switch.tsx:16`, `components/ui/textarea.tsx:14` |
| `shadow-modal` | 5 | token | `app/helper/tickets/[id]/page.tsx:1364`, `components/layout/mobile-nav.tsx:84`, `components/ticket-chat/ticket-chat.tsx:655`, `components/ui/dialog.tsx:63`, `components/ui/drawer-panel.tsx:62` |
| `shadow-md` | 3 | Tailwind default | `components/drawers/add-helper-drawer.tsx:258`, `components/drawers/log-time-drawer.tsx:111`, `components/support/resources-content.tsx:76` |
| `shadow-soft` | 3 | token | `app/helper/tickets/[id]/page.tsx:939`, `components/ticket-chat/chat-input.tsx:217`, `components/ticket-chat/ticket-chat.tsx:374` |
| `shadow-2xl` | 2 | Tailwind default | `components/drawers/add-helper-drawer.tsx:239`, `components/drawers/log-time-drawer.tsx:94` |
| `shadow-control` | 1 | token | `components/ui/button.tsx:18` |
| `shadow-tab` | 1 | token | `components/ui/tab-selector.tsx:48` |

In addition, the `btn-depth` (4 class uses) and `btn-depth-light` (2) utilities compose a box-shadow from the `--btn-*` variables in `globals.css` (lines 366 and 393); the only `box-shadow` declarations in CSS are those two. `shadow-xs` is used only by form primitives in `components/ui`. `shadow-sm`, `shadow-md` and `shadow-2xl` are outside the token set; `shadow-2xl` is passed as `className` to two `DrawerPanel`s, which already carry `shadow-modal`.

## 6. Gradients

| value | count | source | locations |
|---|---|---|---|
| `bg-gradient-to-br` | 3 | Tailwind default | `components/support/rates-and-details-content.tsx:55`, `components/support/rates-and-details-content.tsx:68`, `components/support/rates-and-details-content.tsx:81` |
| `from-[#c5b0ef]` | 2 | hardcoded stop | `components/support/rates-and-details-content.tsx:55`, `components/support/resources-content.tsx:76` |
| `to-[#b8a0e8]` | 2 | hardcoded stop | `components/support/rates-and-details-content.tsx:55`, `components/support/resources-content.tsx:76` |
| `bg-gradient-to-r` | 1 | Tailwind default | `components/support/resources-content.tsx:76` |
| `from-[#b8a0e8]` | 1 | hardcoded stop | `components/support/resources-content.tsx:76` |
| `from-[#e7e5fd]` | 1 | hardcoded stop | `components/support/rates-and-details-content.tsx:68` |
| `from-[#f9f7ff]` | 1 | hardcoded stop | `components/support/rates-and-details-content.tsx:81` |
| `to-[#ab90e0]` | 1 | hardcoded stop | `components/support/resources-content.tsx:76` |
| `to-[#d8d4f7]` | 1 | hardcoded stop | `components/support/rates-and-details-content.tsx:68` |
| `to-[#f0ecff]` | 1 | hardcoded stop | `components/support/rates-and-details-content.tsx:81` |

| Gradient | Kind | Stops | Location |
|---|---|---|---|
| Rate card header 1 | `bg-gradient-to-br` | `#c5b0ef` → `#b8a0e8` | `components/support/rates-and-details-content.tsx:55` |
| Rate card header 2 | `bg-gradient-to-br` | `#e7e5fd` → `#d8d4f7` | `components/support/rates-and-details-content.tsx:68` |
| Rate card header 3 | `bg-gradient-to-br` | `#f9f7ff` → `#f0ecff` | `components/support/rates-and-details-content.tsx:81` |
| Resource link button | `bg-gradient-to-r` | `#c5b0ef` → `#b8a0e8`, hover `#b8a0e8` → `#ab90e0` | `components/support/resources-content.tsx:76` |
| Button sheen (`btn-depth`) | CSS `linear-gradient(180deg, var(--btn-sheen-top), var(--btn-sheen-bottom))` | token variables | `app/globals.css:365` |

Four gradient elements in two files use 10 hardcoded hex stops (10 stop occurrences, 7 distinct hex values); none uses a token, and none has a `dark:` variant. The class form is the Tailwind v3 name `bg-gradient-to-*`; no `bg-linear-*`, `bg-radial-*`, `bg-conic-*` or `via-*` is used. No `linear-gradient`/`radial-gradient` appears in inline styles; the only CSS gradient is the token-driven button sheen.

## 7. Font sizes and typography

| Source | Size-class occurrences |
|---|---|
| Token sizes (`text-ui`, `text-stat`, `text-title`, `text-display`; `text-2xs` unused) | 133 |
| Tailwind default sizes inside the documented scale (`text-xs`, `text-sm`, `text-base`) | 729 |
| Tailwind default sizes outside the documented scale (`text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`) | 80 |
| Arbitrary `text-[…]` sizes | 4 |

### Sizes

| value | px size/line | count | source | in documented scale | example locations |
|---|---|---|---|---|---|
| `text-sm` | 14/20 | 487 | Tailwind default | yes | `app/auth/confirmed/page.tsx:231`, `app/auth/confirmed/page.tsx:249`, `app/global-error.tsx:30` (88 files) |
| `text-xs` | 12/16 | 181 | Tailwind default | yes | `app/helper/overview/page.tsx:108`, `app/helper/overview/page.tsx:117`, `app/helper/overview/page.tsx:126` (51 files) |
| `text-ui` | 13/18 | 121 | token | yes | `app/helper/reports/page.tsx:135`, `app/helper/reports/page.tsx:663`, `app/helper/reports/page.tsx:893` (41 files) |
| `text-base` | 16/24 | 61 | Tailwind default | yes | `app/help/page.tsx:161`, `app/helper/overview/page.tsx:101`, `app/helper/overview/page.tsx:138` (27 files) |
| `text-2xl` | 24/32 | 31 | Tailwind default | no | `app/auth/signin/page.tsx:84`, `app/helper/tickets/[id]/page.tsx:882`, `app/invite/[token]/page.tsx:357`, `app/not-found.tsx:8`, `app/onboarding/join/page.tsx:97`, `app/onboarding/page.tsx:410`, `app/onboarding/page.tsx:456`, `app/onboarding/page.tsx:600`, `app/onboarding/page.tsx:677`, `app/onboarding/page.tsx:720`, `app/onboarding/page.tsx:784`, `app/onboarding/page.tsx:871`, `app/onboarding/page.tsx:986`, `app/onboarding/waiting/page.tsx:116`, `app/onboarding/waiting/page.tsx:173`, `app/projects/[id]/invite-contributors/contributors-step.tsx:71`, `app/projects/[id]/invite-contributors/invite-links-step.tsx:28`, `app/projects/[id]/page.tsx:171`, `app/settings/payment/connect/return/page.tsx:38`, `app/slas/[id]/page.tsx:261`, `app/slas/[id]/page.tsx:406`, `app/slas/[id]/page.tsx:415`, `app/slas/[id]/page.tsx:424`, `app/slas/[id]/page.tsx:433`, `app/support/chat/page.tsx:595`, `app/support/get-support/page.tsx:54`, `app/support/page.tsx:598`, `app/support/page.tsx:687`, `components/support/ticket-unavailable-notice.tsx:37`, `components/support/ticket-unavailable-notice.tsx:57`, `components/support/ticket-unavailable-notice.tsx:69` |
| `text-lg` | 18/28 | 25 | Tailwind default | no | `app/auth/confirmed/page.tsx:230`, `app/helper/reports/payouts/[id]/page.tsx:129`, `app/onboarding/page.tsx:802`, `app/onboarding/page.tsx:820`, `app/onboarding/page.tsx:840`, `app/onboarding/waiting/page.tsx:183`, `app/onboarding/waiting/page.tsx:212`, `app/onboarding/waiting/page.tsx:230`, `app/projects/[id]/page.tsx:181`, `app/projects/[id]/page.tsx:189`, `app/projects/[id]/page.tsx:231`, `app/slas/[id]/page.tsx:276`, `app/slas/[id]/page.tsx:396`, `app/slas/[id]/page.tsx:444`, `app/slas/[id]/page.tsx:536`, `app/slas/[id]/page.tsx:562`, `components/auth/role-option-cards.tsx:83`, `components/modals/sla-confirmation-modal.tsx:49`, `components/support/rates-and-details-content.tsx:56`, `components/support/rates-and-details-content.tsx:69`, `components/support/rates-and-details-content.tsx:82`, `components/support/rates-and-details-content.tsx:105`, `components/support/rates-and-details-content.tsx:121`, `components/ui/dialog.tsx:113`, `components/ui/drawer-panel.tsx:83` |
| `text-xl` | 20/28 | 20 | Tailwind default | no | `app/error.tsx:21`, `app/global-error.tsx:23`, `app/helper/tickets/[id]/page.tsx:877`, `app/helper/tickets/[id]/page.tsx:909`, `app/slas/[id]/page.tsx:255`, `app/support/chat/page.tsx:920`, `app/support/get-support/page.tsx:120`, `app/support/sla/page.tsx:88`, `app/support/tickets/page.tsx:223`, `app/support/tickets/page.tsx:243`, `app/tickets/page.tsx:306`, `app/tickets/page.tsx:326`, `app/tickets/page.tsx:346`, `app/tickets/page.tsx:366`, `components/support/about-support-content.tsx:27`, `components/support/about-support-content.tsx:47`, `components/support/about-support-content.tsx:84`, `components/support/about-support-content.tsx:136`, `components/support/rates-and-details-content.tsx:35`, `components/support/resources-content.tsx:62` |
| `text-stat` | 22/28 | 10 | token | yes | `app/helper/overview/page.tsx:111`, `app/helper/overview/page.tsx:120`, `app/helper/overview/page.tsx:129` (4 files) |
| `text-3xl` | 30/36 | 2 | Tailwind default | no | `app/support/get-support/page.tsx:83`, `app/support/sla/page.tsx:51` |
| `text-4xl` | 36/40 | 2 | Tailwind default | no | `app/settings/branding/page.tsx:98`, `app/support/sla/page.tsx:46` |
| `text-[0.8125rem]` | 0.8125rem | 1 | hardcoded | no | `components/ticket-chat/markdown-content.tsx:76` |
| `text-[11.25px]` | 11.25px | 1 | hardcoded | no | `components/layout/top-bar.tsx:519` |
| `text-[21px]` | 21px | 1 | hardcoded | no | `components/ui/profile-avatar.tsx:28` |
| `text-[26px]` | 26px | 1 | hardcoded | no | `app/projects/[id]/page.tsx:161` |
| `text-display` | 30/36 | 1 | token | yes | `app/support/page.tsx:693` (1 files) |
| `text-title` | 24/32 | 1 | token | yes | `components/layout/header.tsx:100` (1 files) |

Variant-prefixed sizes included above: `[&_[data-slot=dropdown-menu-item]]:text-ui` ×9, `md:text-sm` ×3, `file:text-sm` ×1.

Sizes outside the documented scale:

- `text-2xl` (24/32, 31 uses) has the same metrics as the `text-title` token (1 use, in `Header`). Page titles rendered outside `Header` (onboarding, auth, invite, support pages) use `text-2xl`.
- `text-3xl` (30/36, 2 uses) has the same metrics as `text-display` (1 use).
- `text-lg` (18px, 25 uses) and `text-xl` (20px, 20 uses) have no named token; CLAUDE.md refers to "16–18px" sub-titles and "20–24px h1s" without naming classes for them. `DialogTitle` and the `DrawerPanel` title use `text-lg`.
- `text-4xl` (36px, 2 uses) is above the largest documented size (30px).
- Arbitrary: `text-[0.8125rem]` equals the `text-ui` size (13px) without its line-height; `text-[11.25px]`, `text-[21px]` and `text-[26px]` match no step.

### Weights

| value | weight | count | source | in documented scale | example locations |
|---|---|---|---|---|---|
| `font-medium` | 500 | 286 | Tailwind default | yes | `app/auth/confirmed/page.tsx:235`, `app/auth/signin/page.tsx:84`, `app/error.tsx:21` (80 files) |
| `font-semibold` | 600 | 80 | Tailwind default | yes | `app/help/page.tsx:188`, `app/helper/reports/payouts/[id]/page.tsx:129`, `app/helper/reports/payouts/[id]/page.tsx:204` (27 files) |
| `font-subtitle` | 550 | 66 | token | yes | `app/auth/confirmed/page.tsx:230`, `app/help/page.tsx:161`, `app/helper/overview/page.tsx:101` (28 files) |
| `font-normal` | 400 | 35 | Tailwind default | yes | `app/helper/tickets/[id]/page.tsx:912`, `app/onboarding/page.tsx:413`, `app/onboarding/page.tsx:787` (21 files) |
| `font-book` | 450 | 15 | token | yes | `components/layout/public-support-sidebar.tsx:143`, `components/layout/public-support-sidebar.tsx:176`, `components/layout/sidebar.tsx:340` (6 files) |
| `font-bold` | 700 | 12 | Tailwind default | no | `app/helper/tickets/[id]/page.tsx:1029`, `app/helper/tickets/[id]/page.tsx:1033`, `app/helper/tickets/[id]/page.tsx:1037`, `app/tickets/page.tsx:533`, `app/tickets/page.tsx:537`, `app/tickets/page.tsx:541`, `app/tickets/page.tsx:727`, `app/tickets/page.tsx:731`, `app/tickets/page.tsx:735`, `components/ticket-chat/customer-chat-intro.tsx:112`, `components/ticket-chat/customer-chat-intro.tsx:116`, `components/ticket-chat/customer-chat-intro.tsx:120` |

`font-bold` (700) is outside the documented weights; all 12 uses are the figures in three-up rate tiles (start price and similar) in three files.

### Families

| value | count | source | locations |
|---|---|---|---|
| `font-sans` | 25 | token | `app/global-error.tsx:21`, `app/globals.css:142`, `app/globals.css:157`, `app/globals.css:160`, `app/globals.css:625`, `app/support/page.tsx:696`, `components/layout/top-bar.tsx:353`, `components/layout/top-bar.tsx:354`, `components/layout/top-bar.tsx:379`, `components/layout/top-bar.tsx:405`, `components/layout/top-bar.tsx:412`, `components/layout/top-bar.tsx:417`, `components/layout/top-bar.tsx:423`, `components/layout/top-bar.tsx:447`, `components/layout/top-bar.tsx:463`, `components/layout/top-bar.tsx:472`, `components/layout/top-bar.tsx:492`, `components/layout/top-bar.tsx:508`, `components/layout/top-bar.tsx:570`, `components/payment/distribution-preview.tsx:98`, `components/ticket-chat/sidebar-section.tsx:35`, `components/ticket-chat/sidebar-section.tsx:43`, `components/ui/select.tsx:87`, `components/ui/sonner.tsx:28`, `components/ui/tooltip.tsx:38` |
| `font-mono` | 20 | token | `app/helper/reports/page.tsx:546`, `app/helper/reports/page.tsx:624`, `app/helper/reports/page.tsx:725`, `app/helper/reports/payouts/[id]/page.tsx:31`, `app/helper/reports/payouts/[id]/page.tsx:135`, `app/helper/reports/payouts/[id]/page.tsx:188`, `app/helper/tickets/[id]/page.tsx:912`, `app/helpers/[id]/page.tsx:575`, `app/reports/support/page.tsx:684`, `app/reports/support/page.tsx:919`, `app/slas/[id]/page.tsx:264`, `app/slas/[id]/page.tsx:606`, `app/support/sla/page.tsx:108`, `app/user/reports/page.tsx:458`, `app/user/reports/page.tsx:533`, `components/modals/sla-confirmation-modal.tsx:56`, `components/settings/notification-channels-manager.tsx:124`, `components/settings/notification-channels-manager.tsx:127`, `components/ticket-chat/markdown-content.tsx:76`, `components/ticket-chat/ticket-chat.tsx:347` |
| `font-display` | 2 | token | `app/globals.css:153`, `app/layout.tsx:66` |
| `font-[family-name:var(--font-outfit)]` | 1 | hardcoded (arbitrary) | `components/layout/top-bar.tsx:84` |

`font-family` set outside the utilities:

| value | count | source | locations |
|---|---|---|---|
| `var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` repeated as an inline `fontFamily` string (the `font-mono` token stack is `var(--font-geist-mono), ui-monospace, monospace`) | 6 | hardcoded stack around a token variable | `app/helper/tickets/[id]/page.tsx:968`, `app/helper/tickets/[id]/page.tsx:1092`, `app/helper/tickets/[id]/page.tsx:1124`, `components/ticket-chat/customer-chat-intro.tsx:81`, `components/ticket-chat/ticket-chat.tsx:410`, `components/ticket-chat/ticket-chat.tsx:445` |
| `fontFamily: 'Cousine, monospace'` (Cousine is not loaded by `app/layout.tsx` or any `@font-face`; this is the only reference) | 1 | hardcoded | `components/support/about-support-content.tsx:37` |
| `CODE_FONT` constant for the syntax highlighter | 2 | chat code block (exception) | `components/ticket-chat/code-block.tsx:104`, `components/ticket-chat/code-block.tsx:106` |
| `font-[family-name:var(--font-outfit)]` (Outfit, avatar initials) | 1 | arbitrary class around a `next/font` variable | `components/layout/top-bar.tsx:84` |
| `font-family` in `globals.css` (code block ×2 with the long mono stack, `code, pre` and `.font-mono-id` with `var(--font-mono)`) | 4 | CSS | `app/globals.css:611`, `app/globals.css:656`, `app/globals.css:675`, `app/globals.css:714` |

Outfit is documented for avatar initials. It is applied in the TopBar project avatar only; `components/ui/profile-avatar.tsx` does not reference it.

Type values in inline styles and constants:

| value | count | source | locations |
|---|---|---|---|
| `HEADING_STYLE = { fontSize: "11px", letterSpacing: "0.05em", fontWeight: 500, color: "var(--muted-foreground)" }` (11px is the `text-2xs` size) | 1 (applied twice) | hardcoded | `components/ticket-chat/sidebar-section.tsx:15` |
| `fontSize: "inherit"`, `lineHeight: "inherit"` for the highlighter | 3 | chat code block (exception) | `components/ticket-chat/code-block.tsx:102`, `components/ticket-chat/code-block.tsx:103`, `components/ticket-chat/code-block.tsx:106` |
| `fontSize: 8` (PDF table, points) | 1 | hardcoded (PDF) | `lib/report-pdf.ts:114` |
| Code-block CSS: `font-size: 0.8125rem`, `line-height: 1.55`, header `0.6875rem`/`1.25rem`, `letter-spacing: 0.04em`, `font-weight: 600` | 6 | chat code block (exception) | `app/globals.css:612`–`app/globals.css:634` |

### Leading

| value | count | source | example locations |
|---|---|---|---|
| `leading-relaxed` | 18 | Tailwind default | `app/notifications/page.tsx:146`, `components/drawers/accept-request-drawer.tsx:90`, `components/drawers/end-ticket-drawer.tsx:274` (11 files) |
| `leading-normal` | 9 | Tailwind default | `app/helper/settings/payout/page.tsx:119`, `app/landing-page/page.tsx:109`, `app/settings/branding/page.tsx:83` (6 files) |
| `leading-none` | 6 | Tailwind default | `components/layout/public-support-sidebar.tsx:30`, `components/layout/sidebar.tsx:42`, `components/ticket-chat/sidebar-section.tsx:35` (6 files) |
| `leading-snug` | 4 | Tailwind default | `app/helper/tickets/[id]/page.tsx:1223`, `app/helper/tickets/[id]/page.tsx:1228`, `app/helper/tickets/[id]/page.tsx:1233` (2 files) |
| `leading-tight` | 2 | Tailwind default | `components/layout/public-support-sidebar.tsx:209`, `components/layout/sidebar.tsx:551` (2 files) |

All `leading-*` classes are Tailwind defaults; no arbitrary line-height class exists. The token sizes carry their own line-heights.

### Tracking

| value | count | source | locations |
|---|---|---|---|
| `tracking-wide` | 9 | Tailwind default | `app/helper/reports/page.tsx:549`, `app/helper/reports/page.tsx:806`, `app/helper/reports/payouts/[id]/page.tsx:30`, `app/helper/reports/payouts/[id]/page.tsx:134`, `app/notifications/page.tsx:127`, `app/tickets/page.tsx:494`, `app/user/reports/page.tsx:459`, `app/user/reports/page.tsx:701`, `components/layout/notifications-panel.tsx:161` |
| `tracking-tight` | 5 | Tailwind default | `app/helper/settings/payout/page.tsx:119`, `app/landing-page/page.tsx:109`, `app/settings/branding/page.tsx:83`, `app/settings/branding/page.tsx:125`, `app/settings/payment/page.tsx:1017` |
| `tracking-widest` | 1 | Tailwind default | `components/ui/dropdown-menu.tsx:188` |

All five `tracking-tight` uses sit on `text-sm` text, so the rule "letter-spacing is never negative at 16px and above" holds in the scanned classes. No arbitrary `tracking-[…]` class exists.

Other text utilities: `tabular-nums` ×87, `truncate` ×57, `underline` ×20, `uppercase` ×12, `italic` ×8, `capitalize` ×6, `line-through` ×5, `line-clamp-2` ×2, `line-clamp-1` ×1.

## 8. Spacing

No spacing tokens exist, so every row in the scale tables has the source "Tailwind default scale" (step × 4px). Each family has a pivot table (count per utility for every step in use), the eight most frequent classes with example locations, and a table of every arbitrary value with all its locations.

| Family | Scale occurrences | Distinct scale classes | Arbitrary occurrences | Distinct arbitrary |
|---|---|---|---|---|
| padding | 942 | 75 | 0 | 0 |
| margin | 520 | 51 | 0 | 0 |
| gap | 508 | 17 | 0 | 0 |
| space | 225 | 18 | 0 | 0 |
| height | 306 | 41 | 32 | 18 |
| width | 564 | 47 | 43 | 23 |
| size | 56 | 12 | 16 | 3 |
| **Total** | **3121** | **261** | **91** | **44** |

### Padding (`p-`, `px-`, `py-`, `pt-`, `pr-`, `pb-`, `pl-`)

| value | px | `p-` | `px-` | `py-` | `pt-` | `pr-` | `pb-` | `pl-` | total |
|---|---|---|---|---|---|---|---|---|---|
| `0` | 0px | 33 | 14 | 33 | 2 | 2 |  |  | 84 |
| `0.5` | 2px | 4 | 2 | 3 | 2 |  |  |  | 11 |
| `1` | 4px | 11 | 9 | 15 | 5 | 5 |  |  | 45 |
| `1.5` | 6px |  | 1 | 12 |  |  |  | 1 | 14 |
| `2` | 8px | 3 | 19 | 71 | 2 | 2 | 4 | 3 | 104 |
| `2.5` | 10px |  | 11 | 16 | 2 | 1 | 1 | 1 | 32 |
| `3` | 12px | 23 | 47 | 38 | 6 |  | 18 | 1 | 133 |
| `3.5` | 14px |  | 4 |  |  |  |  |  | 4 |
| `4` | 16px | 52 | 46 | 25 | 6 | 3 | 1 |  | 133 |
| `5` | 20px | 2 | 21 | 9 | 1 |  | 1 | 4 | 38 |
| `6` | 24px | 37 | 83 | 69 | 1 | 1 | 2 | 2 | 195 |
| `7` | 28px |  | 13 | 1 |  |  |  |  | 14 |
| `8` | 32px | 14 | 54 | 15 |  | 2 | 4 | 7 | 96 |
| `9` | 36px |  |  |  |  |  |  | 3 | 3 |
| `10` | 40px |  |  |  |  |  |  | 3 | 3 |
| `11` | 44px |  |  |  |  | 1 |  |  | 1 |
| `12` | 48px |  |  | 18 |  |  |  | 2 | 20 |
| `14` | 56px |  |  |  |  |  |  | 3 | 3 |
| `16` | 64px |  |  |  | 1 |  |  |  | 1 |
| `18` | 72px |  | 5 |  |  |  |  | 1 | 6 |
| `28` | 112px |  |  |  |  | 1 |  |  | 1 |
| `40` | 160px |  |  |  | 1 |  |  |  | 1 |

Most frequent:

| value | count | source | example locations |
|---|---|---|---|
| `px-6` | 83 | Tailwind scale | `app/help/page.tsx:172`, `app/helper/reports/page.tsx:416` (32 files) |
| `py-2` | 71 | Tailwind scale | `app/helper/reports/page.tsx:416`, `app/helper/reports/page.tsx:427` (27 files) |
| `py-6` | 69 | Tailwind scale | `app/help/page.tsx:157`, `app/helper/overview/page.tsx:79` (33 files) |
| `px-8` | 54 | Tailwind scale | `app/help/page.tsx:157`, `app/helper/overview/page.tsx:79` (31 files) |
| `p-4` | 52 | Tailwind scale | `app/auth/confirmed/page.tsx:228`, `app/auth/signin/page.tsx:79` (21 files) |
| `px-3` | 47 | Tailwind scale | `app/helper/reports/page.tsx:135`, `app/helper/reports/page.tsx:716` (25 files) |
| `px-4` | 46 | Tailwind scale | `app/error.tsx:20`, `app/global-error.tsx:30` (30 files) |
| `py-3` | 38 | Tailwind scale | `app/helper/reports/page.tsx:484`, `app/helper/reports/page.tsx:490` (21 files) |

### Margin

| value | px | `m-` | `mx-` | `my-` | `mt-` | `mr-` | `mb-` | `ml-` | total |
|---|---|---|---|---|---|---|---|---|---|
| `-28` | -112px |  |  |  |  |  |  | 1 | 1 |
| `-8` | -32px |  | 1 |  |  |  |  | 1 | 2 |
| `-6` | -24px |  | 5 |  |  |  |  |  | 5 |
| `-3` | -12px |  | 8 |  |  |  |  |  | 8 |
| `-2` | -8px |  |  |  |  |  |  | 8 | 8 |
| `-1.5` | -6px |  |  |  |  |  |  | 1 | 1 |
| `-1` | -4px |  | 3 |  |  |  |  | 1 | 4 |
| `0` | 0px | 1 |  |  |  |  | 1 |  | 2 |
| `0.5` | 2px |  |  | 1 | 16 |  |  |  | 17 |
| `0.75` | 3px |  |  |  | 1 |  |  |  | 1 |
| `1` | 4px |  | 1 | 5 | 43 | 4 | 42 | 1 | 96 |
| `1.5` | 6px |  |  |  | 1 | 1 |  | 6 | 8 |
| `2` | 8px |  |  | 2 | 30 | 7 | 75 | 2 | 116 |
| `2.5` | 10px |  |  |  | 1 |  |  |  | 1 |
| `3` | 12px |  |  |  | 11 | 1 | 39 | 1 | 52 |
| `4` | 16px |  | 8 |  | 11 |  | 52 |  | 71 |
| `5` | 20px |  |  |  |  |  | 7 |  | 7 |
| `6` | 24px |  |  | 1 | 9 |  | 33 |  | 43 |
| `8` | 32px |  |  |  | 2 |  | 15 | 5 | 22 |
| `9` | 36px |  |  |  |  |  | 3 | 3 | 6 |
| `11` | 44px |  |  |  |  |  |  | 8 | 8 |
| `12` | 48px |  |  |  |  |  | 4 | 4 | 8 |
| `auto` | — |  | 17 | 3 |  |  |  | 13 | 33 |

Most frequent:

| value | count | source | example locations |
|---|---|---|---|
| `mb-2` | 75 | Tailwind scale | `app/auth/confirmed/page.tsx:230`, `app/error.tsx:21` (31 files) |
| `mb-4` | 52 | Tailwind scale | `app/auth/confirmed/page.tsx:248`, `app/help/page.tsx:189` (24 files) |
| `mt-1` | 43 | Tailwind scale | `app/helper/overview/page.tsx:201`, `app/helper/reports/payouts/[id]/page.tsx:148` (23 files) |
| `mb-1` | 42 | Tailwind scale | `app/help/page.tsx:161`, `app/helper/settings/availability/page.tsx:23` (16 files) |
| `mb-3` | 39 | Tailwind scale | `app/helper/overview/page.tsx:107`, `app/helper/overview/page.tsx:116` (16 files) |
| `mb-6` | 33 | Tailwind scale | `app/error.tsx:22`, `app/global-error.tsx:24` (20 files) |
| `mt-2` | 30 | Tailwind scale | `app/helper/reports/page.tsx:697`, `app/helper/reports/payouts/[id]/page.tsx:136` (23 files) |
| `mx-auto` | 17 | Tailwind scale | `app/auth/confirmed/page.tsx:248`, `app/helper/reports/payouts/[id]/page.tsx:58` (14 files) |

### Gap

| value | px | `gap-` | `gap-x-` | `gap-y-` | total |
|---|---|---|---|---|---|
| `0` | 0px | 1 |  |  | 1 |
| `1` | 4px | 32 |  |  | 32 |
| `1.5` | 6px | 7 |  |  | 7 |
| `2` | 8px | 208 |  | 1 | 209 |
| `2.5` | 10px | 14 |  |  | 14 |
| `2.75` | 11px | 1 |  |  | 1 |
| `3` | 12px | 98 |  |  | 98 |
| `4` | 16px | 111 | 2 |  | 113 |
| `4.75` | 19px | 1 |  |  | 1 |
| `5` | 20px | 3 |  |  | 3 |
| `6` | 24px | 13 |  | 2 | 15 |
| `8` | 32px | 6 | 1 |  | 7 |
| `10` | 40px | 7 |  |  | 7 |

Most frequent:

| value | count | source | example locations |
|---|---|---|---|
| `gap-2` | 208 | Tailwind scale | `app/help/page.tsx:196`, `app/help/page.tsx:203` (67 files) |
| `gap-4` | 111 | Tailwind scale | `app/helper/overview/page.tsx:104`, `app/helper/overview/page.tsx:146` (35 files) |
| `gap-3` | 98 | Tailwind scale | `app/error.tsx:25`, `app/help/page.tsx:192` (47 files) |
| `gap-1` | 32 | Tailwind scale | `app/helper/overview/page.tsx:201`, `app/helper/reports/page.tsx:135` (23 files) |
| `gap-2.5` | 14 | Tailwind scale | `app/helpers/[id]/page.tsx:433`, `app/helpers/[id]/page.tsx:437` (6 files) |
| `gap-6` | 13 | Tailwind scale | `app/auth/signin/page.tsx:80`, `app/helper/reports/payouts/[id]/page.tsx:96` (6 files) |
| `gap-10` | 7 | Tailwind scale | `app/helper/settings/payout/page.tsx:95`, `app/settings/payment/page.tsx:486` (2 files) |
| `gap-1.5` | 7 | Tailwind scale | `app/helper/settings/payout/page.tsx:106`, `app/settings/payment/page.tsx:1002` (7 files) |

### `space-x-*` / `space-y-*`

| value | px | `space-x-` | `space-y-` | total |
|---|---|---|---|---|
| `0` | 0px |  | 5 | 5 |
| `0.5` | 2px |  | 2 | 2 |
| `1` | 4px | 1 | 11 | 12 |
| `1.5` | 6px |  | 4 | 4 |
| `2` | 8px | 53 | 29 | 82 |
| `2.5` | 10px | 8 |  | 8 |
| `3` | 12px | 6 | 22 | 28 |
| `4` | 16px |  | 43 | 43 |
| `5` | 20px |  | 2 | 2 |
| `6` | 24px |  | 28 | 28 |
| `6.5` | 26px |  | 1 | 1 |
| `7` | 28px |  | 1 | 1 |
| `8` | 32px |  | 4 | 4 |
| `12` | 48px |  | 1 | 1 |
| `16` | 64px |  | 4 | 4 |

Most frequent:

| value | count | source | example locations |
|---|---|---|---|
| `space-x-2` | 53 | Tailwind scale | `app/helpers/page.tsx:630`, `app/helpers/page.tsx:633` (7 files) |
| `space-y-4` | 43 | Tailwind scale | `app/helper/reports/payouts/[id]/page.tsx:58`, `app/helper/settings/profile/page.tsx:236` (28 files) |
| `space-y-2` | 29 | Tailwind scale | `app/helper/tickets/[id]/page.tsx:1380`, `app/helper/tickets/[id]/page.tsx:1435` (15 files) |
| `space-y-6` | 28 | Tailwind scale | `app/helper/reports/page.tsx:409`, `app/helpers/[id]/page.tsx:373` (18 files) |
| `space-y-3` | 22 | Tailwind scale | `app/helper/reports/payouts/[id]/page.tsx:155`, `app/helper/reports/payouts/[id]/page.tsx:161` (15 files) |
| `space-y-1` | 11 | Tailwind scale | `app/auth/signin/page.tsx:83`, `app/helper/reports/payouts/[id]/page.tsx:222` (8 files) |
| `space-x-2.5` | 8 | Tailwind scale | `components/drawers/add-helper-drawer.tsx:312`, `components/drawers/add-helper-drawer.tsx:316` (3 files) |
| `space-x-3` | 6 | Tailwind scale | `app/helpers/page.tsx:590`, `app/reports/slas/page.tsx:433` (5 files) |

### Height (`h-`, `min-h-`, `max-h-`)

| value | px | `h-` | `min-h-` | `max-h-` | total |
|---|---|---|---|---|---|
| `0` | 0px | 1 | 24 |  | 25 |
| `1.5` | 6px | 2 |  |  | 2 |
| `2` | 8px | 5 |  |  | 5 |
| `3` | 12px | 7 |  |  | 7 |
| `3.5` | 14px | 7 |  |  | 7 |
| `4` | 16px | 40 |  |  | 40 |
| `5` | 20px | 24 |  |  | 24 |
| `6` | 24px | 9 |  |  | 9 |
| `7` | 28px | 10 |  |  | 10 |
| `8` | 32px | 36 | 1 |  | 37 |
| `9` | 36px | 8 |  |  | 8 |
| `10` | 40px | 23 | 1 |  | 24 |
| `11` | 44px | 2 |  |  | 2 |
| `12` | 48px | 1 | 2 |  | 3 |
| `16` | 64px | 2 | 1 |  | 3 |
| `20` | 80px | 5 | 1 |  | 6 |
| `24` | 96px |  |  | 1 | 1 |
| `28` | 112px | 10 |  |  | 10 |
| `32` | 128px | 3 |  | 1 | 4 |
| `40` | 160px | 1 |  | 1 | 2 |
| `44` | 176px |  | 1 |  | 1 |
| `54` | 216px |  |  | 1 | 1 |
| `60` | 240px |  |  | 1 | 1 |
| `64` | 256px |  |  | 2 | 2 |
| `72` | 288px |  |  | 3 | 3 |
| `80` | 320px |  |  | 2 | 2 |
| `96` | 384px |  |  | 1 | 1 |
| `px` | 1px | 8 |  |  | 8 |
| `auto` | — | 11 |  |  | 11 |
| `dvh` | — | 2 |  |  | 2 |
| `full` | — | 12 |  | 1 | 13 |
| `screen` | — |  | 32 |  | 32 |

Most frequent:

| value | count | source | example locations |
|---|---|---|---|
| `h-4` | 40 | Tailwind scale | `app/helper/reports/payouts/[id]/page.tsx:100`, `app/helper/reports/payouts/[id]/page.tsx:105` (21 files) |
| `h-8` | 36 | Tailwind scale | `app/global-error.tsx:30`, `app/helper/overview/page.tsx:182` (20 files) |
| `min-h-screen` | 32 | Tailwind scale | `app/auth/confirmed/page.tsx:228`, `app/auth/confirmed/page.tsx:246` (13 files) |
| `min-h-0` | 24 | Tailwind scale | `app/error.tsx:19`, `app/helper/tickets/[id]/page.tsx:935` (18 files) |
| `h-5` | 24 | Tailwind scale | `app/helper/settings/profile/page.tsx:248`, `app/onboarding/page.tsx:846` (14 files) |
| `h-10` | 23 | Tailwind scale | `app/slas/[id]/page.tsx:493`, `app/slas/[id]/page.tsx:494` (6 files) |
| `h-full` | 12 | Tailwind scale | `app/layout.tsx:65`, `app/layout.tsx:66` (7 files) |
| `h-auto` | 11 | Tailwind scale | `app/onboarding/page.tsx:794`, `app/onboarding/page.tsx:812` (6 files) |

Arbitrary values:

| value | count | source | locations |
|---|---|---|---|
| `h-[3px]` | 6 | hardcoded | `app/support/tickets/page.tsx:220`, `app/support/tickets/page.tsx:240`, `app/tickets/page.tsx:303`, `app/tickets/page.tsx:323`, `app/tickets/page.tsx:343`, `app/tickets/page.tsx:363` |
| `h-[22px]` | 4 | hardcoded | `app/helpers/page.tsx:597`, `components/layout/top-bar.tsx:58`, `components/layout/top-bar.tsx:404`, `components/layout/top-bar.tsx:460` |
| `min-h-[2rem]` | 4 | hardcoded | `components/support/about-support-content.tsx:54`, `components/support/about-support-content.tsx:91`, `components/support/about-support-content.tsx:106`, `components/support/about-support-content.tsx:143` |
| `min-h-[40px]` | 3 | hardcoded | `components/layout/public-support-sidebar.tsx:81`, `components/layout/sidebar.tsx:275`, `components/ticket-chat/right-sidebar-collapse.tsx:56` |
| `h-[82px]` | 2 | hardcoded | `app/projects/[id]/page.tsx:149`, `app/projects/[id]/page.tsx:159` |
| `h-[1.15rem]` | 1 | hardcoded | `components/ui/switch.tsx:16` |
| `h-[18px]` | 1 | hardcoded | `components/layout/top-bar.tsx:519` |
| `h-[50px]` | 1 | hardcoded | `app/auth/signin/page.tsx:81` |
| `h-[var(--radix-select-trigger-height)]` | 1 | hardcoded | `components/ui/select.tsx:101` |
| `max-h-(--radix-dropdown-menu-content-available-height)` | 1 | hardcoded | `components/ui/dropdown-menu.tsx:46` |
| `max-h-(--radix-select-content-available-height)` | 1 | hardcoded | `components/ui/select.tsx:87` |
| `max-h-[16.625rem]` | 1 | hardcoded | `components/drawers/add-helper-drawer.tsx:378` |
| `max-h-[80vh]` | 1 | hardcoded | `components/layout/notifications-panel.tsx:129` |
| `max-h-[85vh]` | 1 | hardcoded | `components/ticket-chat/chat-image.tsx:63` |
| `max-h-[90vh]` | 1 | hardcoded | `components/ticket-chat/time-entry-review.tsx:244` |
| `min-h-[100px]` | 1 | hardcoded | `components/ticket-chat/chat-input.tsx:268` |
| `min-h-[60px]` | 1 | hardcoded | `components/layout/top-bar.tsx:345` |
| `min-h-[72px]` | 1 | hardcoded | `components/ticket-chat/time-entry-review.tsx:392` |

### Width (`w-`, `min-w-`, `max-w-`)

| value | px | `w-` | `min-w-` | `max-w-` | total |
|---|---|---|---|---|---|
| `0` | 0px |  | 136 |  | 136 |
| `0.5` | 2px | 4 |  |  | 4 |
| `1.5` | 6px | 1 |  |  | 1 |
| `2` | 8px | 5 |  |  | 5 |
| `3` | 12px | 3 |  |  | 3 |
| `3.5` | 14px | 2 |  |  | 2 |
| `4` | 16px | 38 |  |  | 38 |
| `5` | 20px | 20 |  |  | 20 |
| `6` | 24px | 7 |  |  | 7 |
| `7` | 28px | 2 |  |  | 2 |
| `8` | 32px | 32 |  |  | 32 |
| `9` | 36px | 1 |  |  | 1 |
| `11` | 44px | 2 |  |  | 2 |
| `12` | 48px | 1 |  |  | 1 |
| `16` | 64px | 7 |  |  | 7 |
| `20` | 80px | 7 |  |  | 7 |
| `24` | 96px | 4 |  |  | 4 |
| `28` | 112px | 1 |  |  | 1 |
| `32` | 128px | 3 |  |  | 3 |
| `36` | 144px | 5 |  |  | 5 |
| `40` | 160px | 1 |  |  | 1 |
| `44` | 176px | 17 |  |  | 17 |
| `48` | 192px | 2 |  |  | 2 |
| `56` | 224px | 3 |  |  | 3 |
| `64` | 256px | 3 |  | 2 | 5 |
| `72` | 288px | 3 |  |  | 3 |
| `80` | 320px | 4 |  |  | 4 |
| `96` | 384px | 1 |  |  | 1 |
| `px` | 1px | 2 |  |  | 2 |
| `1/4` | — | 2 |  |  | 2 |
| `1/3` | — | 1 |  |  | 1 |
| `1/2` | — | 1 |  |  | 1 |
| `2xl` | — |  |  | 14 | 14 |
| `3xl` | — |  |  | 29 | 29 |
| `4xl` | — |  |  | 4 | 4 |
| `5xl` | — |  |  | 1 | 1 |
| `7xl` | — |  |  | 7 | 7 |
| `auto` | — | 4 |  |  | 4 |
| `fit` | — | 26 |  |  | 26 |
| `full` | — | 102 |  | 8 | 110 |
| `lg` | — |  |  | 4 | 4 |
| `md` | — |  |  | 31 | 31 |
| `sm` | — |  |  | 2 | 2 |
| `xl` | — |  |  | 1 | 1 |
| `xs` | — |  |  | 8 | 8 |

Most frequent:

| value | count | source | example locations |
|---|---|---|---|
| `min-w-0` | 136 | Tailwind scale | `app/helper/overview/page.tsx:191`, `app/helper/reports/page.tsx:510` (28 files) |
| `w-full` | 102 | Tailwind scale | `app/auth/signin/page.tsx:80`, `app/auth/signin/page.tsx:82` (42 files) |
| `w-4` | 38 | Tailwind scale | `app/helper/settings/profile/page.tsx:260`, `app/helper/settings/profile/page.tsx:283` (20 files) |
| `w-8` | 32 | Tailwind scale | `app/helper/overview/page.tsx:182`, `app/onboarding/page.tsx:77` (18 files) |
| `max-w-md` | 31 | Tailwind scale | `app/auth/confirmed/page.tsx:229`, `app/auth/signin/page.tsx:80` (24 files) |
| `max-w-3xl` | 29 | Tailwind scale | `app/help/page.tsx:158`, `app/helper/reports/payouts/[id]/page.tsx:58` (18 files) |
| `w-fit` | 26 | Tailwind scale | `app/helper/reports/page.tsx:135`, `app/helper/reports/page.tsx:695` (13 files) |
| `w-5` | 20 | Tailwind scale | `app/helper/settings/profile/page.tsx:248`, `app/onboarding/page.tsx:846` (10 files) |

Arbitrary values:

| value | count | source | locations |
|---|---|---|---|
| `w-[230px]` | 5 | hardcoded | `app/settings/payment/page.tsx:835`, `app/settings/payment/page.tsx:865`, `app/settings/payment/page.tsx:894`, `app/settings/payment/page.tsx:953`, `app/settings/payment/page.tsx:973` |
| `max-w-[36rem]` | 3 | hardcoded | `components/support/about-support-content.tsx:49`, `components/support/about-support-content.tsx:86`, `components/support/about-support-content.tsx:138` |
| `max-w-[52rem]` | 3 | hardcoded | `components/support/about-support-content.tsx:48`, `components/support/about-support-content.tsx:85`, `components/support/about-support-content.tsx:137` |
| `max-w-[85vw]` | 3 | hardcoded | `app/helper/tickets/[id]/page.tsx:1364`, `components/layout/mobile-nav.tsx:84`, `components/ticket-chat/ticket-chat.tsx:655` |
| `min-w-[8rem]` | 3 | hardcoded | `components/ui/dropdown-menu.tsx:46`, `components/ui/dropdown-menu.tsx:234`, `components/ui/select.tsx:87` |
| `w-[22px]` | 3 | hardcoded | `components/layout/top-bar.tsx:58`, `components/layout/top-bar.tsx:404`, `components/layout/top-bar.tsx:460` |
| `max-w-[16rem]` | 2 | hardcoded | `components/layout/top-bar.tsx:405`, `components/layout/top-bar.tsx:463` |
| `max-w-[32vw]` | 2 | hardcoded | `components/layout/top-bar.tsx:405`, `components/layout/top-bar.tsx:463` |
| `max-w-[502px]` | 2 | hardcoded | `app/helper/settings/payout/page.tsx:119`, `app/settings/payment/page.tsx:1017` |
| `max-w-[calc(100%-2rem)]` | 2 | hardcoded | `components/ticket-chat/chat-image.tsx:59`, `components/ui/dialog.tsx:63` |
| `min-w-[40rem]` | 2 | hardcoded | `components/ui/list.tsx:25`, `components/ui/list.tsx:87` |
| `w-[82px]` | 2 | hardcoded | `app/projects/[id]/page.tsx:149`, `app/projects/[id]/page.tsx:159` |
| `max-w-[37rem]` | 1 | hardcoded | `components/support/about-support-content.tsx:26` |
| `max-w-[45%]` | 1 | hardcoded | `components/modals/new-ticket-modal.tsx:129` |
| `max-w-[90vw]` | 1 | hardcoded | `components/ticket-chat/chat-image.tsx:59` |
| `max-w-[calc(100vw-2rem)]` | 1 | hardcoded | `components/layout/notifications-panel.tsx:129` |
| `min-w-[36rem]` | 1 | hardcoded | `components/reports/ticket-transactions.tsx:111` |
| `min-w-[var(--radix-select-trigger-width)]` | 1 | hardcoded | `components/ui/select.tsx:101` |
| `w-[18px]` | 1 | hardcoded | `components/layout/top-bar.tsx:519` |
| `w-[300px]` | 1 | hardcoded | `components/payment/distribution-preview.tsx:183` |
| `w-[38px]` | 1 | hardcoded | `app/helpers/page.tsx:597` |
| `w-[440px]` | 1 | hardcoded | `components/ui/drawer-panel.tsx:45` |
| `w-[50px]` | 1 | hardcoded | `app/auth/signin/page.tsx:81` |

### `size-*`

| value | px | `size-` | total |
|---|---|---|---|
| `1` | 4px | 6 | 6 |
| `2` | 8px | 3 | 3 |
| `2.5` | 10px | 1 | 1 |
| `3` | 12px | 1 | 1 |
| `3.5` | 14px | 3 | 3 |
| `4` | 16px | 20 | 20 |
| `5` | 20px | 2 | 2 |
| `6` | 24px | 7 | 7 |
| `7` | 28px | 1 | 1 |
| `8` | 32px | 9 | 9 |
| `10` | 40px | 1 | 1 |
| `full` | — | 2 | 2 |

Most frequent:

| value | count | source | example locations |
|---|---|---|---|
| `size-4` | 20 | Tailwind scale | `app/settings/project/page.tsx:251`, `app/settings/project/page.tsx:278` (10 files) |
| `size-8` | 9 | Tailwind scale | `app/helper/reports/payouts/[id]/page.tsx:98`, `components/ui/avatar.tsx:16` (7 files) |
| `size-6` | 7 | Tailwind scale | `app/settings/payment/page.tsx:1000`, `components/onboarding/onboarding-checklist.tsx:14` (3 files) |
| `size-1` | 6 | Tailwind scale | `app/helper/settings/payout/page.tsx:107`, `app/helper/settings/payout/page.tsx:108` (2 files) |
| `size-3.5` | 3 | Tailwind scale | `components/ui/dropdown-menu.tsx:102`, `components/ui/dropdown-menu.tsx:137` (2 files) |
| `size-2` | 3 | Tailwind scale | `components/ui/dropdown-menu.tsx:139`, `components/ui/radio-group.tsx:39` (3 files) |
| `size-5` | 2 | Tailwind scale | `components/ticket-chat/chat-input.tsx:304`, `components/ui/sidebar-toggle-icon.tsx:26` (2 files) |
| `size-full` | 2 | Tailwind scale | `components/ui/avatar.tsx:31`, `components/ui/avatar.tsx:45` (1 files) |

Arbitrary values:

| value | count | source | locations |
|---|---|---|---|
| `size-[18px]` | 8 | hardcoded | `components/drawers/add-helper-drawer.tsx:313`, `components/drawers/add-helper-drawer.tsx:317`, `components/drawers/add-helper-drawer.tsx:323`, `components/drawers/add-helper-drawer.tsx:327`, `components/drawers/create-sla-drawer.tsx:154`, `components/drawers/create-sla-drawer.tsx:161`, `components/drawers/log-time-drawer.tsx:138`, `components/drawers/log-time-drawer.tsx:148` |
| `size-[42px]` | 6 | hardcoded | `app/helper/settings/payout/page.tsx:99`, `app/helper/settings/payout/page.tsx:112`, `app/settings/payment/page.tsx:999`, `app/settings/payment/page.tsx:1008`, `components/ui/empty-state.tsx:47`, `components/ui/error-state.tsx:47` |
| `size-[22px]` | 2 | hardcoded | `app/helper/settings/payout/page.tsx:103`, `app/settings/payment/page.tsx:1012` |

Observations on the scale tables:

- Padding, margin, gap and `space-*` use no arbitrary values at all.
- Half steps are common alongside whole steps (`0.5`, `1.5`, `2.5`, `3.5` and a single `4.75` in `gap-4.75`), so adjacent values such as `gap-2`/`gap-2.5`/`gap-3` coexist.
- Both `gap-*` (508) and `space-x/y-*` (225) are used for the same job.
- `size-N` (56) and the `h-N w-N` pair are both used for square elements (`h-4` 40 and `w-4` 38 against `size-4` 20).
- Page gutters: `px-8` ×54 and `py-6` ×69 match the documented `px-8 py-6`; `max-w-3xl` ×29 and `max-w-7xl` match the documented page widths.

### Other arbitrary values

Arbitrary-value utilities that are not padding, margin, gap or size (colour, radius, text size, shadow and transition lists are in their own sections):

| value | count | source | locations |
|---|---|---|---|
| `ring-[3px]` | 6 | hardcoded | `components/ui/accordion.tsx:38`, `components/ui/badge.tsx:8`, `components/ui/button.tsx:9`, `components/ui/checkbox.tsx:17`, `components/ui/radio-group.tsx:30`, `components/ui/switch.tsx:16` |
| `[--icon-size:1.2rem]` | 3 | hardcoded | `app/onboarding/page.tsx:799`, `app/onboarding/page.tsx:817`, `app/onboarding/page.tsx:837` |
| `[--icon-size:18px]` | 3 | hardcoded | `components/layout/top-bar.tsx:517`, `components/ui/drawer-panel.tsx:80`, `components/ui/drawer-panel.tsx:100` |
| `[--icon-size:0.75rem]` | 2 | hardcoded | `components/ui/badge.tsx:8`, `components/ui/icon.tsx:9` |
| `grid-cols-[minmax(0,1fr)_auto]` | 2 | hardcoded | `components/payment/distribution-preview.tsx:193`, `components/payment/distribution-preview.tsx:208` |
| `left-[18px]` | 2 | hardcoded | `components/layout/sidebar.tsx:450`, `components/layout/sidebar.tsx:464` |
| `origin-(--radix-dropdown-menu-content-transform-origin)` | 2 | hardcoded | `components/ui/dropdown-menu.tsx:46`, `components/ui/dropdown-menu.tsx:234` |
| `translate-y-[2px]` | 2 | hardcoded | `components/ui/table.tsx:73`, `components/ui/table.tsx:86` |
| `z-[60]` | 2 | hardcoded | `components/payment/distribution-preview.tsx:98`, `components/ui/tooltip.tsx:38` |
| `[--icon-size:0.625rem]` | 1 | hardcoded | `components/onboarding/onboarding-checklist.tsx:76` |
| `[--icon-size:0.875rem]` | 1 | hardcoded | `components/ui/icon.tsx:10` |
| `[--icon-size:1.25rem]` | 1 | hardcoded | `components/ui/icon.tsx:12` |
| `[--icon-size:1.5rem]` | 1 | hardcoded | `components/ui/icon.tsx:13` |
| `[--icon-size:19px]` | 1 | hardcoded | `app/projects/[id]/page.tsx:180` |
| `[--icon-size:2rem]` | 1 | hardcoded | `components/ui/icon.tsx:14` |
| `align-[-2px]` | 1 | hardcoded | `components/payment/distribution-preview.tsx:68` |
| `col-[2/-1]` | 1 | hardcoded | `app/helpers/[id]/page.tsx:667` |
| `grid-cols-[1fr_auto]` | 1 | hardcoded | `components/ui/card.tsx:23` |
| `grid-rows-[0fr]` | 1 | hardcoded | `components/layout/sidebar.tsx:441` |
| `grid-rows-[1fr]` | 1 | hardcoded | `components/layout/sidebar.tsx:441` |
| `grid-rows-[auto_auto]` | 1 | hardcoded | `components/ui/card.tsx:23` |
| `left-[50%]` | 1 | hardcoded | `components/ui/dialog.tsx:63` |
| `origin-(--radix-popover-content-transform-origin)` | 1 | hardcoded | `components/ui/popover.tsx:39` |
| `origin-(--radix-select-content-transform-origin)` | 1 | hardcoded | `components/ui/select.tsx:87` |
| `origin-(--radix-tooltip-content-transform-origin)` | 1 | hardcoded | `components/ui/tooltip.tsx:38` |
| `scale-[0.98]` | 1 | hardcoded | `components/ui/button.tsx:9` |
| `top-[50%]` | 1 | hardcoded | `components/ui/dialog.tsx:63` |
| `translate-x-[-50%]` | 1 | hardcoded | `components/ui/dialog.tsx:63` |
| `translate-y-[-50%]` | 1 | hardcoded | `components/ui/dialog.tsx:63` |
| `translate-y-[calc(-50%_-_2px)]` | 1 | hardcoded | `components/ui/tooltip.tsx:45` |
| `z-[2147483647]` | 1 | hardcoded | `components/layout/notifications-panel.tsx:129` |

Across all utility types, 200 class occurrences in 60 files use an arbitrary value; 123 of them, in 44 files, contain a px or rem length. Files with the most px/rem arbitrary values: `components/layout/top-bar.tsx` 13, `components/support/about-support-content.tsx` 11, `app/settings/payment/page.tsx` 9, `lib/constants.ts` 9, `app/projects/[id]/page.tsx` 6, `components/drawers/add-helper-drawer.tsx` 5, `components/ui/icon.tsx` 5, `app/helper/settings/payout/page.tsx` 4.

Recurring arbitrary sizes that stand in for a missing scale step or token:

- `size-[42px]` ×6 with `SQUIRCLE_RADIUS[42]` (icon tiles; EmptyState/ErrorState and the two payment pages).
- `size-[18px]` ×8 (checkbox-like boxes in two drawers), `[--icon-size:18px]` ×3, `h-[18px] w-[18px]` ×1.
- `h-[22px]`/`w-[22px]`/`size-[22px]` ×9 (TopBar avatars, payment tiles).
- `w-[230px]` ×5 (payment settings column), `h-[3px]` ×6 (ticket-status accent bars).
- `w-[440px]` ×1 is the documented drawer width, defined once in `DrawerPanel`; `min-w-[40rem]` ×2 is the documented list scroll width.
- `z-[2147483647]` on the notifications panel and `z-[60]` ×2 are outside the `z-30`/`z-40`/`z-50` steps used by the primitives.

Lengths in inline styles and grid templates:

| value | count | source | locations |
|---|---|---|---|
| `marginTop: "22px"` | 2 | hardcoded | `app/helper/settings/profile/page.tsx:280`, `app/settings/profile/page.tsx:237` |
| `rowGap: '31.2px'` | 2 | hardcoded | `app/helper/tickets/[id]/page.tsx:950`, `components/ticket-chat/ticket-chat.tsx:385` |
| `rowGap: '16px'` | 2 | hardcoded | `app/helper/tickets/[id]/page.tsx:1073`, `components/ticket-chat/ticket-chat.tsx:389` |
| `padding: "0.75rem 1rem"` (highlighter) | 1 | chat code block (exception) | `components/ticket-chat/code-block.tsx:100` |
| `gridTemplateColumns` literals (list column grids; a `2rem` first column and a `calc(… + 36px)` column recur in 7 of the 9 distinct definitions) | 14 literals, 8 named `*_GRID` constants | hardcoded, page-specific (allowed: "pages keep their own column grids") | `app/helper/reports/page.tsx:100`, `app/helper/reports/page.tsx:107`, `app/helpers/[id]/page.tsx:74`, `app/helpers/page.tsx:607` (+4 repeats of the same literal in that file), `app/reports/support/page.tsx:57`, `app/reports/support/page.tsx:62`, `app/reports/support/page.tsx:68`, `app/user/reports/page.tsx:74`, `app/user/reports/page.tsx:78`, `components/reports/ticket-transactions.tsx:112` |

## 9. Component variants

### Button (`src/components/ui/button.tsx`)

Base classes (cva): `inline-flex w-fit items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-ui font-medium`, transition `[color,background-color,border-color,box-shadow,transform] duration-fast ease-out`, `cursor-pointer active:scale-[0.98]`, disabled `pointer-events-none opacity-50 cursor-not-allowed`, icon sizing `[&_svg:not([class*='size-'])]:size-4`, focus `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`, invalid `aria-invalid:ring-destructive/20 aria-invalid:border-destructive`. Default variant `default`, default size `default`. Other props: `asChild` (Radix Slot), `loading` (spinner over an invisible label, sets `disabled` and `aria-busy`).

| variant | classes |
|---|---|
| `default` | `bg-primary text-primary-foreground btn-depth dark:btn-depth-light hover:bg-primary/90` |
| `destructive` | `bg-destructive text-white btn-depth hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60` |
| `outline` | `border border-border-control bg-background shadow-control hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50` |
| `secondary` | `bg-secondary text-secondary-foreground btn-depth-light dark:btn-depth hover:bg-secondary/80` |
| `ghost` | `hover:bg-surface-hover hover:text-accent-foreground dark:hover:bg-accent/50` |
| `link` | `text-primary underline-offset-4 hover:underline` |
| `brand` | `bg-brand-primary text-brand-foreground btn-depth hover:bg-brand-primary-hover` |
| `lavender` | `bg-brand-primary/10 border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-brand-foreground` |
| `neutral` | `bg-surface-hover border border-border-control text-foreground hover:bg-surface-active` |

| size | classes |
|---|---|
| `default` | `h-8 px-3.5 has-[>svg]:px-3 has-[>i]:px-3` |
| `sm` | `h-7 px-2.5` |
| `lg` | `h-10 px-4 has-[>svg]:px-3.5 has-[>i]:px-3.5` |
| `icon` | `size-8` |
| `icon-sm` | `size-7` |
| `icon-lg` | `size-10` |

Usage: 267 `<Button>` tags in 73 files.

| variant | count | note | example locations |
|---|---|---|---|
| `default` | 39 | 8 explicit + 31 omitted | `app/helper/tickets/[id]/page.tsx:889`, `app/helper/tickets/[id]/page.tsx:1258`, `components/drawers/accept-request-drawer.tsx:56`, … +36 more lines |
| `destructive` | 1 |  | `components/ticket-chat/time-entry-review.tsx:65` |
| `outline` | 97 |  | `app/error.tsx:29`, `app/help/page.tsx:202`, `app/helper/reports/page.tsx:159`, … +94 more lines |
| `secondary` | 0 |  | **not used** |
| `ghost` | 62 |  | `app/helper/reports/page.tsx:564`, `app/helper/reports/page.tsx:652`, `app/helper/reports/page.tsx:823`, … +59 more lines |
| `link` | 0 |  | **not used** |
| `brand` | 27 |  | `app/helpers/page.tsx:476`, `app/helpers/page.tsx:824`, `app/invite/[token]/page.tsx:329`, … +24 more lines |
| `lavender` | 32 |  | `app/helper/reports/page.tsx:468`, `app/helper/reports/payouts/[id]/page.tsx:75`, `app/helper/settings/profile/page.tsx:276`, … +29 more lines |
| `neutral` | 0 |  | **not used** |
| dynamic: `selectedCategory === "All helpers" ? "neutral" : "ghost"` | 1 | expression or unknown value | `app/helpers/page.tsx:488` |
| dynamic: `selectedCategory === "core" ? "neutral" : "ghost"` | 1 | expression or unknown value | `app/helpers/page.tsx:500` |
| dynamic: `selectedCategory === "extended" ? "neutral" : "ghost"` | 1 | expression or unknown value | `app/helpers/page.tsx:512` |
| dynamic: `selectedCategory === "community" ? "neutral" : "ghost"` | 1 | expression or unknown value | `app/helpers/page.tsx:524` |
| dynamic: `filter === "all" ? "lavender" : "outline"` | 1 | expression or unknown value | `app/notifications/page.tsx:69` |
| dynamic: `filter === "unread" ? "lavender" : "outline"` | 1 | expression or unknown value | `app/notifications/page.tsx:76` |
| dynamic: `timePeriod === "current-month" ? "default" : "outline"` | 1 | expression or unknown value | `app/slas/[id]/page.tsx:359` |
| dynamic: `timePeriod === "all-time" ? "default" : "outline"` | 1 | expression or unknown value | `app/slas/[id]/page.tsx:380` |
| dynamic: `helpersView === "view-all" ? "default" : "outline"` | 1 | expression or unknown value | `app/slas/[id]/page.tsx:449` |

| size | count | note | example locations |
|---|---|---|---|
| `default` | 140 | 0 explicit + 140 omitted | `app/error.tsx:26`, `app/error.tsx:29`, `app/help/page.tsx:195`, … +137 more lines |
| `sm` | 116 |  | `app/helper/reports/page.tsx:159`, `app/helper/reports/page.tsx:456`, `app/helper/reports/page.tsx:468`, … +113 more lines |
| `lg` | 3 |  | `components/auth/sign-in-options.tsx:85`, `components/auth/sign-in-options.tsx:105`, `components/auth/sign-in-options.tsx:183` |
| `icon` | 7 |  | `app/helper/tickets/[id]/page.tsx:917`, `components/drawers/add-helper-drawer.tsx:444`, `components/layout/mobile-nav.tsx:46`, … +4 more lines |
| `icon-sm` | 1 |  | `components/modals/sla-confirmation-modal.tsx:57` |
| `icon-lg` | 0 |  | **not used** |

Props on the 267 tags: `className` ×201, `asChild` ×24, `disabled` ×88, `style` ×4, `loading` ×12. `buttonVariants` is not called outside `button.tsx`. The `secondary` and `link` variants and the `icon-lg` size are never used; `neutral` appears only as one branch of four conditional expressions in `app/helpers/page.tsx`. The four `style` props are on ``app/helper/settings/profile/page.tsx:254`, `app/helper/settings/profile/page.tsx:276`, `app/settings/profile/page.tsx:211`, `app/settings/profile/page.tsx:233``.

201 of the 267 Buttons pass a `className`. What those class strings override:

| override in `className` | count | example locations |
|---|---|---|
| text colour/size `text-*` | 92 | `app/help/page.tsx:195`, `app/help/page.tsx:211`, `app/helper/reports/payouts/[id]/page.tsx:60`, `app/helper/reports/payouts/[id]/page.tsx:68`, `app/helper/settings/payout/page.tsx:124`, `app/helper/settings/profile/page.tsx:254`, … +86 more lines |
| background `bg-*` | 52 | `app/error.tsx:26`, `app/help/page.tsx:195`, `app/help/page.tsx:211`, `app/helper/reports/payouts/[id]/page.tsx:60`, `app/helper/reports/payouts/[id]/page.tsx:68`, `app/helper/settings/payout/page.tsx:124`, … +46 more lines |
| `border*` | 41 | `app/helper/reports/payouts/[id]/page.tsx:60`, `app/helper/reports/payouts/[id]/page.tsx:68`, `app/helper/tickets/[id]/page.tsx:1169`, `app/helper/tickets/[id]/page.tsx:1238`, `app/helper/tickets/[id]/page.tsx:1501`, `app/helpers/page.tsx:539`, … +35 more lines |
| padding `p*-` | 36 | `app/helper/settings/payout/page.tsx:124`, `app/onboarding/page.tsx:792`, `app/onboarding/page.tsx:810`, `app/onboarding/page.tsx:829`, `app/settings/payment/page.tsx:1023`, `app/settings/project/page.tsx:244`, … +30 more lines |
| font weight | 16 | `app/helper/settings/payout/page.tsx:124`, `app/helper/tickets/[id]/page.tsx:1331`, `app/helpers/page.tsx:539`, `app/helpers/page.tsx:550`, `app/settings/payment/page.tsx:1023`, `app/settings/project/page.tsx:244`, … +10 more lines |
| radius `rounded*` | 14 | `app/helpers/page.tsx:539`, `app/helpers/page.tsx:550`, `components/drawers/add-helper-drawer.tsx:243`, `components/drawers/add-helper-drawer.tsx:253`, `components/drawers/add-helper-drawer.tsx:444`, `components/drawers/add-helper-drawer.tsx:474`, … +8 more lines |
| height `h-*` | 9 | `app/helper/reports/page.tsx:456`, `app/helper/reports/page.tsx:468`, `app/reports/support/page.tsx:481`, `app/reports/support/page.tsx:493`, `components/layout/public-support-sidebar.tsx:83`, `components/layout/public-support-sidebar.tsx:101`, … +3 more lines |
| hardcoded colour `[#…]` | 5 | `app/helper/settings/payout/page.tsx:124`, `app/onboarding/join/page.tsx:139`, `app/onboarding/page.tsx:882`, `app/settings/payment/page.tsx:1023`, `app/user/settings/payment/page.tsx:211` |
| `shadow*` | 5 | `components/drawers/add-helper-drawer.tsx:243`, `components/drawers/add-helper-drawer.tsx:253`, `components/drawers/log-time-drawer.tsx:98`, `components/drawers/log-time-drawer.tsx:106`, `components/modals/unsaved-changes-modal.tsx:42` |

**Ad-hoc buttons.** 84 raw `<button>` elements in 33 files; 4 are inside primitives (`SortHeader` in `list.tsx`, `TabSelector`, and the back and info buttons in `Header`), leaving 80 in pages and feature components.

| file | count | kind | lines |
|---|---|---|---|
| `app/tickets/page.tsx` | 11 | ad hoc | `:295`, `:315`, `:335`, `:355`, `:445`, `:454`, `:594`, `:603`, `:612`, `:621`, `:630` |
| `app/reports/slas/page.tsx` | 10 | ad hoc | `:309`, `:319`, `:368`, `:378`, `:388`, `:398`, `:481`, `:491`, `:501`, `:511` |
| `app/page.tsx` | 6 | ad hoc | `:268`, `:276`, `:284`, `:337`, `:345`, `:353` |
| `app/slas/page.tsx` | 6 | ad hoc | `:135`, `:146`, `:157`, `:195`, `:204`, `:213` |
| `app/support/tickets/page.tsx` | 6 | ad hoc | `:212`, `:232`, `:285`, `:299`, `:313`, `:327` |
| `components/layout/top-bar.tsx` | 4 | ad hoc | `:399`, `:452`, `:505`, `:512` |
| `app/helpers/page.tsx` | 3 | ad hoc | `:631`, `:640`, `:649` |
| `app/onboarding/page.tsx` | 3 | ad hoc | `:514`, `:926`, `:955` |
| `app/settings/payment/page.tsx` | 3 | ad hoc | `:456`, `:466`, `:1061` |
| `app/settings/project/page.tsx` | 3 | ad hoc | `:288`, `:347`, `:407` |
| `app/helper/reports/page.tsx` | 2 | ad hoc | `:413`, `:424` |
| `app/user/reports/page.tsx` | 2 | ad hoc | `:362`, `:373` |
| `components/drawers/end-ticket-drawer.tsx` | 2 | ad hoc | `:143`, `:206` |
| `components/layout/header.tsx` | 2 | primitive internals | `:86`, `:104` |
| `components/layout/sidebar.tsx` | 2 | ad hoc | `:356`, `:423` |
| `components/onboarding/onboarding-checklist.tsx` | 2 | ad hoc | `:28`, `:109` |
| `app/global-error.tsx` | 1 | ad hoc | `:27` |
| `app/helper/tickets/[id]/page.tsx` | 1 | ad hoc | `:1461` |
| `app/projects/[id]/invite-contributors/contributors-step.tsx` | 1 | ad hoc | `:156` |
| `app/reports/support/page.tsx` | 1 | ad hoc | `:437` |
| `components/auth/sign-in-options.tsx` | 1 | ad hoc | `:157` |
| `components/layout/notifications-panel.tsx` | 1 | ad hoc | `:134` |
| `components/layout/public-support-sidebar.tsx` | 1 | ad hoc | `:146` |
| `components/modals/image-upload-modal.tsx` | 1 | ad hoc | `:197` |
| `components/modals/new-ticket-modal.tsx` | 1 | ad hoc | `:115` |
| `components/payment/distribution-preview.tsx` | 1 | ad hoc | `:65` |
| `components/reports/ticket-transactions.tsx` | 1 | ad hoc | `:54` |
| `components/support/guest-link-banner.tsx` | 1 | ad hoc | `:97` |
| `components/ticket-chat/chat-image.tsx` | 1 | ad hoc | `:43` |
| `components/ticket-chat/code-block.tsx` | 1 | ad hoc | `:71` |
| `components/ticket-chat/time-entry-review.tsx` | 1 | ad hoc | `:369` |
| `components/ui/list.tsx` | 1 | primitive internals | `:67` |
| `components/ui/tab-selector.tsx` | 1 | primitive internals | `:55` |

Traits of the 82 raw buttons outside `components/ui` (the two in `Header` included): has solid fill (bg-brand-primary / bg-primary / bg-foreground / bg-destructive / hex): 1; has `focus-visible:` ring/outline: 17; has `rounded*`: 28; has `border`: 5; has `h-*` height: 5; no className at all: 0; has `type=` attribute: 74.

- Raw buttons whose own class string has no `focus:` or `focus-visible:` class: 65 of 82. Some sit inside a `ListHeader`, which supplies the focus ring to nested buttons through `[&_button:focus-visible]`, so this is an upper bound on buttons without a visible focus style. Locations: `app/global-error.tsx:27`, `app/helper/reports/page.tsx:413`, `app/helper/reports/page.tsx:424`, `app/helper/tickets/[id]/page.tsx:1461`, `app/helpers/page.tsx:631`, `app/helpers/page.tsx:640`, `app/helpers/page.tsx:649`, `app/onboarding/page.tsx:514`, `app/onboarding/page.tsx:926`, `app/onboarding/page.tsx:955`, `app/page.tsx:268`, `app/page.tsx:276`, `app/page.tsx:284`, `app/page.tsx:337`, `app/page.tsx:345`, `app/page.tsx:353`, `app/projects/[id]/invite-contributors/contributors-step.tsx:156`, `app/reports/slas/page.tsx:309`, `app/reports/slas/page.tsx:319`, `app/reports/slas/page.tsx:368`, `app/reports/slas/page.tsx:378`, `app/reports/slas/page.tsx:388`, `app/reports/slas/page.tsx:398`, `app/reports/slas/page.tsx:481`, `app/reports/slas/page.tsx:491`, `app/reports/slas/page.tsx:501`, `app/reports/slas/page.tsx:511`, `app/reports/support/page.tsx:437`, `app/settings/payment/page.tsx:456`, `app/settings/payment/page.tsx:466`, `app/settings/payment/page.tsx:1061`, `app/settings/project/page.tsx:288`, `app/settings/project/page.tsx:347`, `app/settings/project/page.tsx:407`, `app/slas/page.tsx:135`, `app/slas/page.tsx:146`, `app/slas/page.tsx:157`, `app/slas/page.tsx:195`, `app/slas/page.tsx:204`, `app/slas/page.tsx:213`, `app/support/tickets/page.tsx:285`, `app/support/tickets/page.tsx:299`, `app/support/tickets/page.tsx:313`, `app/support/tickets/page.tsx:327`, `app/tickets/page.tsx:445`, `app/tickets/page.tsx:454`, `app/tickets/page.tsx:594`, `app/tickets/page.tsx:603`, `app/tickets/page.tsx:612`, `app/tickets/page.tsx:621`, `app/tickets/page.tsx:630`, `app/user/reports/page.tsx:362`, `app/user/reports/page.tsx:373`, `components/auth/sign-in-options.tsx:157`, `components/layout/top-bar.tsx:512`, `components/modals/image-upload-modal.tsx:197`, `components/modals/new-ticket-modal.tsx:115`, `components/onboarding/onboarding-checklist.tsx:28`, `components/onboarding/onboarding-checklist.tsx:109`, `components/payment/distribution-preview.tsx:65`, `components/reports/ticket-transactions.tsx:54`, `components/support/guest-link-banner.tsx:97`, `components/ticket-chat/chat-image.tsx:43`, `components/ticket-chat/code-block.tsx:71`, `components/ticket-chat/time-entry-review.tsx:369`.
- Raw button with a solid brand fill (re-implements the `brand` variant): `app/global-error.tsx:27` (the global error page, which renders outside the app providers).
- `role="button"` on non-button elements: 9 — `app/helper/reports/page.tsx:844`, `app/helpers/[id]/page.tsx:545`, `app/notifications/page.tsx:116`, `app/reports/support/page.tsx:544`, `app/reports/support/page.tsx:827`, `app/tickets/page.tsx:470`, `app/tickets/page.tsx:654`, `components/layout/notifications-panel.tsx:149`, `components/layout/sidebar.tsx:405`.
- `<a>`/`<Link>` elements styled as buttons with their own `bg-*` + `px-*` + `rounded*` classes instead of `<Button asChild>`: 2 — `components/support/resources-content.tsx:71`, `app/settings/payment/connect/return/page.tsx:69`.

### Badge and chips (`badge.tsx`, `ticket-badges.tsx`, `lib/status-colors.ts`)

Badge base classes (cva): `inline-flex h-5 items-center justify-center rounded-md border px-2 text-xs font-normal w-fit whitespace-nowrap shrink-0 tabular-nums gap-1 overflow-hidden`, `[&>svg]:size-3 [&>i]:[--icon-size:0.75rem]`, focus ring `ring-[3px] ring-ring/50`, `transition-[color,box-shadow]`. Default variant `default`. `asChild` supported.

| variant | classes |
|---|---|
| `default` | `border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90` |
| `secondary` | `border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90` |
| `destructive` | `border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 dark:bg-destructive/60` |
| `outline` | `text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground` |
| `type` | `border-transparent bg-badge-neutral-bg text-badge-neutral-text` |
| `category` | `border-badge-outline-border bg-badge-outline-bg text-badge-outline-text` |
| `info` | `border-transparent bg-badge-info-bg text-badge-info-text` |
| `success` | `border-transparent bg-badge-success-bg text-badge-success-text` |
| `neutral` | `border-transparent bg-badge-neutral-bg text-badge-neutral-text` (identical to `type`) |
| `subdued` | `border-transparent bg-badge-neutral-bg text-badge-muted-text` |
| `urgent` | `border-transparent bg-badge-strong-bg text-badge-strong-text font-semibold` |

Helpers:

| helper | what it returns |
|---|---|
| `TicketStatusBadge` | `<Badge variant>` + `<Icon size={3}>` from `getTicketStatusBadge(status)` |
| `getTicketStatusBadge` | available/unclaimed → `info` + `fi-rr-circle-dashed`; claimed/in-progress → `neutral` + `fi-rr-circle-half-stroke`; completed → `success` + `fi-rr-check-circle`; cancelled → `subdued` + `fi-rr-cross-circle`; anything else → `type`, no icon |
| `TicketPriority` / `getPriorityStyle` | urgent → `<Badge variant="urgent">`; high → `text-xs font-semibold text-badge-emphasis-text`; low/medium/other → `text-xs font-normal text-badge-muted-text` |
| `CategoryBadge` / `getCategoryDotClass` | `<Badge variant="category">` + `size-2 rounded-full` dot: core → `bg-badge-dot-core`, community → `bg-badge-dot-community`, extended → `bg-badge-dot-extended`, unknown → no dot |
| `getStatusBadgeClass` | success statuses → `bg-status-success-bg text-status-success-text`; pending statuses → `bg-status-warning-bg text-status-warning-text`; failed → `bg-status-high-bg text-status-high-text`; cancelled/other → `bg-muted text-muted-foreground` |
| `BADGE_SHAPE_CLASS` | `h-5 rounded-md border-transparent px-2 text-xs font-normal` |

Usage: 37 `<Badge>` tags in 15 files (3 of them inside `ticket-badges.tsx`).

| variant | count | note | example locations |
|---|---|---|---|
| `default` | 12 | 0 explicit + 12 omitted | `app/helper/reports/page.tsx:135`, `app/helper/reports/page.tsx:817`, `app/helper/reports/page.tsx:875`, … +9 more lines |
| `secondary` | 10 |  | `app/helper/reports/payouts/[id]/page.tsx:142`, `app/helper/tickets/[id]/page.tsx:995`, `app/helper/tickets/[id]/page.tsx:1418`, … +7 more lines |
| `destructive` | 0 |  | **not used** |
| `outline` | 7 |  | `app/helper/reports/page.tsx:549`, `app/helper/reports/page.tsx:806`, `app/tickets/page.tsx:494`, … +4 more lines |
| `type` | 5 |  | `app/helper/tickets/[id]/page.tsx:1009`, `app/support/tickets/page.tsx:383`, `app/tickets/page.tsx:519`, … +2 more lines |
| `category` | 1 |  | `components/ui/ticket-badges.tsx:63` |
| `info` | 0 |  | **not used** |
| `success` | 0 |  | **not used** |
| `neutral` | 0 |  | **not used** |
| `subdued` | 0 |  | **not used** |
| `urgent` | 0 |  | **not used** |
| dynamic: `variant` | 1 | expression or unknown value | `components/ui/ticket-badges.tsx:26` |
| dynamic: `style.variant` | 1 | expression or unknown value | `components/ui/ticket-badges.tsx:43` |

The `info`, `success`, `neutral`, `subdued` and `urgent` variants are never written literally; they are reached only through `TicketStatusBadge` and `TicketPriority` (the two dynamic rows). `destructive` is unused. `urgent` cannot render today because the priority data type is low/medium/high (stated in `status-colors.ts`).

| helper | uses (non-import) | files | example locations |
|---|---|---|---|
| `<TicketStatusBadge>` | 7 | 6 | `app/helper/overview/page.tsx:211`, `app/helpers/[id]/page.tsx:591`, `app/slas/[id]/page.tsx:629`, `app/support/tickets/page.tsx:388`, … +3 more lines |
| `<TicketPriority>` | 2 | 1 | `app/tickets/page.tsx:694`, `app/tickets/page.tsx:789` |
| `<CategoryBadge>` | 4 | 3 | `app/helper/settings/profile/page.tsx:225`, `app/helper/settings/profile/page.tsx:299`, `app/helpers/[id]/page.tsx:421`, `app/helpers/page.tsx:769` |
| `getStatusBadgeClass` | 7 | 4 | `app/helper/reports/page.tsx:135`, `app/helper/reports/page.tsx:817`, `app/helper/reports/page.tsx:875`, `app/helpers/[id]/page.tsx:53`, … +3 more lines |
| `getTicketStatusBadge` | 1 | 1 | `components/ui/ticket-badges.tsx:24` |
| `getPriorityStyle` | 1 | 1 | `components/ui/ticket-badges.tsx:39` |
| `getCategoryDotClass` | 1 | 1 | `components/ui/ticket-badges.tsx:61` |
| `BADGE_SHAPE_CLASS` | 0 | 0 | **not used outside its definition** |
| `badgeVariants` | 0 | 0 | **not used outside its definition** |

31 of the 37 Badges pass a `className`. What those class strings contain:

| Badge `className` contains | count | locations |
|---|---|---|
| `text-*` literal | 17 | `app/helper/reports/page.tsx:135`, `app/helper/reports/page.tsx:549`, `app/helper/reports/page.tsx:806`, `app/helper/tickets/[id]/page.tsx:995`, `app/helper/tickets/[id]/page.tsx:1418`, `app/helpers/[id]/page.tsx:426`, `app/helpers/page.tsx:702`, `app/reports/slas/page.tsx:446`, `app/reports/slas/page.tsx:559`, `app/reports/support/page.tsx:569`, `app/tickets/page.tsx:494`, `app/tickets/page.tsx:508`, … +5 more lines |
| `bg-*` literal | 10 | `app/helper/tickets/[id]/page.tsx:995`, `app/helper/tickets/[id]/page.tsx:1418`, `app/helpers/[id]/page.tsx:426`, `app/helpers/page.tsx:702`, `app/reports/slas/page.tsx:446`, `app/reports/slas/page.tsx:559`, `app/tickets/page.tsx:508`, `components/onboarding/onboarding-checklist.tsx:100`, `components/ticket-chat/guest-ticket.tsx:27`, `components/ticket-chat/ticket-chat.tsx:706` |
| getStatusBadgeClass(...) | 4 | `app/helper/reports/page.tsx:135`, `app/helper/reports/page.tsx:817`, `app/helper/reports/page.tsx:875`, `app/reports/support/page.tsx:569` |
| `px-`/`py-`/`h-` | 2 | `app/helper/reports/page.tsx:135`, `app/reports/support/page.tsx:569` |

Ad-hoc status and chip styling outside the primitives:

| value | count | source | locations |
|---|---|---|---|
| Local status → class map on default-palette colours (`bg-green-100 text-green-800`, `bg-yellow-100 text-yellow-800`, `bg-red-100 text-red-800`) | 3 entries | hardcoded | `app/helper/reports/payouts/[id]/page.tsx:18`–`app/helper/reports/payouts/[id]/page.tsx:20` |
| Status pill built from a `<span>` with `rounded-full px-2 py-0.5 text-xs font-medium` and emerald/amber/red palette classes | 1 | hardcoded | `components/ticket-chat/time-entry-review.tsx:110` |
| "Recommended"-style corner labels: `<div>` with `bg-text-tertiary text-white text-xs px-2 py-1 rounded` | 2 | ad hoc | `app/support/get-support/page.tsx:80`, `app/support/sla/page.tsx:48` |
| Small bordered chips built from `<span>`/`<div>`/`<p>` | 3 | ad hoc | `components/ticket-chat/chat-image.tsx:34`, `app/settings/project/page.tsx:286`, `components/ticket-chat/guest-ticket.tsx:94` |
| `<Badge>` with its own `bg-*` class overriding the variant fill | 10 | override | see the `bg-*` row above |
| Status dot `bg-[#f09191]` | 2 | hardcoded | `app/helper/tickets/[id]/page.tsx:1550`, `components/ticket-chat/customer-sidebar-footer.tsx:132` |

Detail of the six pattern-matched pill candidates (element with `rounded*` + `px-1…3` + `text-xs`/`text-ui` + a fill or border):

| location | element | classes (truncated) |
|---|---|---|
| `components/ticket-chat/chat-image.tsx:34` | `<span>` | `my-1 inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground` |
| `components/ticket-chat/time-entry-review.tsx:110` | `<span>` | `cn( "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", status === "accepted" && "bg-emerald-50 text-emerald-700"` |
| `app/settings/project/page.tsx:286` | `<div>` | `mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs` |
| `app/support/get-support/page.tsx:80` | `<div>` | `absolute -top-2 -left-2 bg-text-tertiary text-white text-xs px-2 py-1 rounded` |
| `app/support/sla/page.tsx:48` | `<div>` | `absolute -top-2 -left-2 bg-text-tertiary text-white text-xs px-2 py-1 rounded` |
| `components/ticket-chat/guest-ticket.tsx:94` | `<p>` | `w-fit rounded-md bg-bg-subtle px-3 py-2 text-ui text-text-muted` |

### Card (`src/components/ui/card.tsx`)

No variants. Parts and base classes:

| part | base classes |
|---|---|
| `Card` | `bg-card text-card-foreground flex flex-col gap-4 rounded-lg border border-border-subtle py-5 shadow-none` |
| `CardHeader` | `@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-5` |
| `CardTitle` | `leading-none font-medium` |
| `CardDescription` | `text-muted-foreground text-sm` |
| `CardAction` | `col-start-2 row-span-2 row-start-1 self-start justify-self-end` |
| `CardContent` | `px-6` |
| `CardFooter` | `flex items-center px-6 [.border-t]:pt-5` |

| component | uses | files | with `className` | example locations |
|---|---|---|---|---|
| `<Card>` | 63 | 21 | 54 | `app/auth/signin/page.tsx:82`, `app/help/page.tsx:168`, `app/help/page.tsx:186`, … +60 more lines |
| `<CardHeader>` | 20 | 10 | 5 | `app/auth/signin/page.tsx:83`, `app/invite/[token]/page.tsx:285`, `app/invite/[token]/page.tsx:320`, … +17 more lines |
| `<CardTitle>` | 20 | 10 | 15 | `app/auth/signin/page.tsx:84`, `app/invite/[token]/page.tsx:288`, `app/invite/[token]/page.tsx:323`, … +17 more lines |
| `<CardDescription>` | 21 | 10 | 8 | `app/auth/signin/page.tsx:87`, `app/invite/[token]/page.tsx:290`, `app/invite/[token]/page.tsx:325`, … +18 more lines |
| `<CardAction>` | 0 | 0 | 0 | **not used** |
| `<CardContent>` | 63 | 22 | 58 | `app/auth/signin/page.tsx:93`, `app/help/page.tsx:169`, `app/help/page.tsx:187`, … +60 more lines |
| `<CardFooter>` | 0 | 0 | 0 | **not used** |

Classes passed to `<Card className>` that touch the documented defaults (padding, gap, border, fill, shadow, radius):

| class on `<Card>` | count | example locations |
|---|---|---|
| `py-0` | 33 | `app/helper/overview/page.tsx:105`, `app/helper/overview/page.tsx:114`, `app/helper/overview/page.tsx:123`, `app/helper/overview/page.tsx:143`, … +29 more lines |
| `overflow-hidden` | 8 | `app/page.tsx:264`, `app/page.tsx:333`, `app/support/tickets/page.tsx:218`, `app/support/tickets/page.tsx:238`, … +4 more lines |
| `border-0` | 7 | `app/helper/settings/profile/page.tsx:231`, `app/helper/settings/profile/page.tsx:293`, `app/helper/settings/profile/page.tsx:309`, `app/helpers/[id]/page.tsx:410`, … +3 more lines |
| `bg-muted/40` | 6 | `app/support/tickets/page.tsx:218`, `app/support/tickets/page.tsx:238`, `app/tickets/page.tsx:301`, `app/tickets/page.tsx:321`, … +2 more lines |
| `bg-muted/30` | 1 | `app/help/page.tsx:186` |
| `py-7` | 1 | `app/onboarding/join/page.tsx:95` |
| `gap-6` | 1 | `app/onboarding/join/page.tsx:95` |

`py-0` (33) is the documented list-card override. No `<Card>` re-adds `rounded-lg`, `border-border-subtle`, `bg-card` or a shadow.

**Ad-hoc cards.** 96 elements in 46 files match the card pattern without using `<Card>`: a `rounded-md`/`-lg`/`-xl` class, a bare `border` class and one of `bg-card`, `bg-background`, `bg-white`, `bg-page-muted`, `bg-bg-subtle`, `bg-muted`, `p-3…p-8` or a `shadow-*`, excluding fixed-height controls. This is a heuristic: it includes list containers, callouts and option tiles as well as true cards. 21 files use `<Card>`, 46 contain ad-hoc candidates and 11 contain both. `bg-card` is written outside `card.tsx` 76 in 36 files.

| file | count | lines |
|---|---|---|
| `app/helper/tickets/[id]/page.tsx` | 7 | `:881`, `:1020`, `:1028`, `:1032`, `:1036`, `:1132`, `:1178` |
| `app/tickets/page.tsx` | 7 | `:439`, `:532`, `:536`, `:540`, `:726`, `:730`, `:734` |
| `components/support/rates-and-details-content.tsx` | 6 | `:45`, `:54`, `:67`, `:80`, `:97`, `:115` |
| `components/ticket-chat/customer-chat-intro.tsx` | 5 | `:96`, `:103`, `:111`, `:115`, `:119` |
| `app/helper/reports/payouts/[id]/page.tsx` | 4 | `:90`, `:116`, `:120`, `:124 <article>` |
| `app/onboarding/page.tsx` | 4 | `:608`, `:727`, `:514 <button>`, `:926 <button>` |
| `components/drawers/end-ticket-drawer.tsx` | 4 | `:137`, `:161`, `:176`, `:272` |
| `app/onboarding/waiting/page.tsx` | 3 | `:179`, `:208`, `:226` |
| `app/projects/[id]/page.tsx` | 3 | `:146`, `:178`, `:230` |
| `app/reports/support/page.tsx` | 3 | `:514`, `:615`, `:794` |
| `app/settings/payment/page.tsx` | 3 | `:920`, `:730 <label>`, `:754 <label>` |
| `app/settings/project/page.tsx` | 3 | `:286`, `:342`, `:402` |
| `components/support/about-support-content.tsx` | 3 | `:48`, `:85`, `:137` |
| `components/support/ticket-unavailable-notice.tsx` | 3 | `:36`, `:56`, `:68` |
| `app/helper/reports/page.tsx` | 2 | `:497`, `:758` |
| `app/reports/slas/page.tsx` | 2 | `:355`, `:468` |
| `app/user/reports/page.tsx` | 2 | `:414`, `:659` |
| `components/drawers/add-helper-drawer.tsx` | 2 | `:365`, `:466` |
| `components/layout/notifications-panel.tsx` | 2 | `:125`, `:147` |
| `components/settings/notification-channels-manager.tsx` | 2 | `:120`, `:196` |
| `app/auth/confirmed/page.tsx` | 1 | `:229` |
| `app/helpers/[id]/page.tsx` | 1 | `:507` |
| `app/helpers/page.tsx` | 1 | `:603` |
| `app/landing-page/page.tsx` | 1 | `:199` |
| `app/notifications/page.tsx` | 1 | `:112` |
| `app/onboarding/join/page.tsx` | 1 | `:160` |
| `app/projects/[id]/invite-contributors/contributors-step.tsx` | 1 | `:145` |
| `app/slas/page.tsx` | 1 | `:187` |
| `app/support/chat/page.tsx` | 1 | `:633` |
| `app/support/get-support/page.tsx` | 1 | `:53` |
| `app/support/page.tsx` | 1 | `:597` |
| `app/support/tickets/page.tsx` | 1 | `:281` |
| `app/user/settings/payment/page.tsx` | 1 | `:225` |
| `components/auth/helper-invite-acceptance.tsx` | 1 | `:94` |
| `components/auth/sign-in-options.tsx` | 1 | `:151` |
| `components/drawers/accept-request-drawer.tsx` | 1 | `:89` |
| `components/drawers/log-time-drawer.tsx` | 1 | `:209` |
| `components/layout/public-support-sidebar.tsx` | 1 | `:123` |
| `components/layout/sidebar.tsx` | 1 | `:317` |
| `components/payment/distribution-preview.tsx` | 1 | `:183` |
| `components/reports/ticket-transactions.tsx` | 1 | `:80` |
| `components/support/guest-banner.tsx` | 1 | `:41` |
| `components/support/guest-link-banner.tsx` | 1 | `:87` |
| `components/ticket-chat/chat-input.tsx` | 1 | `:215` |
| `components/ticket-chat/ticket-chat.tsx` | 1 | `:453` |
| `components/ticket-chat/time-entry-review.tsx` | 1 | `:339 <li>` |

### Containers

Definitions:

| component | variants / options | base classes |
|---|---|---|
| `ListHeader` (`list.tsx`) | none | `flex min-h-10 items-center border-b border-border-subtle bg-brand-primary/10 px-6 py-2 text-xs font-medium text-text-muted max-md:min-w-[40rem]`; nested buttons get `rounded-sm`, `hover:text-brand-primary` and `focus-visible:ring-2 ring-brand-primary/40`; children `flex-1` |
| `SortHeader` / `SortIcon` (`list.tsx`) | `active`, `direction` | button `flex items-center gap-2`; icon `size-4 text-muted-foreground` (unsorted) or `size-4 text-brand-primary` (sorted) |
| `ListRow` / `listRowClass` (`list.tsx`) | `interactive`, `tone` = `default` \| `subtle`, `bordered` | `min-h-12 px-6 py-3 text-ui transition-colors duration-fast ease-out hover:bg-surface-hover max-md:min-w-[40rem]`; `subtle` adds `bg-bg-subtle/50`; `bordered` adds `border-b border-border-subtle last:border-b-0`; `interactive` adds `cursor-pointer` and `focus-visible:ring-2 ring-inset ring-brand-primary/40` |
| `Table` family (`table.tsx`) | none | `Table` `w-full caption-bottom text-sm` in a `relative w-full overflow-x-auto` wrapper; `TableHeader` `[&_tr]:border-b`; `TableRow` `hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors`; `TableHead` `text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap`; `TableCell` `p-2 align-middle whitespace-nowrap`; `TableFooter` `bg-muted/50 border-t font-medium`; `TableCaption` `text-muted-foreground mt-4 text-sm` |
| `Dialog` family (`dialog.tsx`) | `DialogContent` `showCloseButton` (default true) | overlay `fixed inset-0 z-50 bg-black/50` + `animate-overlay-in/out`; content `bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border border-border-subtle p-6 shadow-modal sm:max-w-lg max-sm:max-w-full max-sm:rounded-none` + `animate-dialog-in/out`; close `absolute top-4 right-4 rounded-xs opacity-70`; header `flex flex-col gap-2 text-center sm:text-left`; footer `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`; title `text-lg leading-none font-subtitle`; description `text-muted-foreground text-sm` |
| `DrawerPanel` (`drawer-panel.tsx`) | props `title`, `headerAction`, `footer`, `width` (default `w-[440px]`), `backdropClassName` (default `bg-black/20`), `className`, `footerClassName` | overlay `fixed inset-0 z-40` + `animate-overlay-in/out`; panel `fixed right-0 top-0 z-50 flex h-full flex-col border-l border-border bg-background shadow-modal outline-none rounded-l-xl` + `animate-sheet-in/out`, `max-sm:w-full max-sm:rounded-none max-sm:border-l-0`; header `border-b border-border-subtle px-6 py-5`, title `text-lg font-subtitle text-foreground`; footer `border-t border-border-subtle px-6 py-4` |
| `Popover` family (`popover.tsx`) | `align` (default `center`), `sideOffset` (default 4) | content `bg-popover text-popover-foreground z-50 w-72 rounded-md border border-border-subtle p-4 shadow-popover outline-hidden` + `animate-menu-in/out` |
| `EmptyState` (`empty-state.tsx`) | `size` = `default` \| `sm`; `icon`, `title`, `description`, `action` | wrapper `flex flex-col items-center justify-center text-center`, `gap-3 px-6 py-12` (default) or `gap-2 px-6 py-8` (sm); tile `bg-brand-primary/10 text-brand-primary`, `size-[42px]` + `SQUIRCLE_RADIUS[42]` or `size-8` + `SQUIRCLE_RADIUS[32]`; title `text-sm font-medium text-foreground`; description `text-ui text-muted-foreground` |
| `ErrorState` (`error-state.tsx`) | `size` = `default` \| `sm`; `title`, `description`, `onRetry` | same layout; tile `bg-status-high-bg text-status-high-text`; retry `<Button variant="outline" size="sm">` |
| `Skeleton`, `ListSkeleton`, `PageSkeleton` (`skeleton.tsx`) | `ListSkeleton`: `rows` (default 5), `avatar`, `badge` | `Skeleton` `animate-pulse rounded-md bg-surface-hover`; list rows `flex min-h-12 items-center gap-4 px-6 py-3` in `animate-fade-in divide-y divide-border-subtle`; page skeleton header `border-b border-border-subtle px-8 py-5`, body `flex flex-col gap-8 px-8 py-6` |
| `TabSelector` (`tab-selector.tsx`) | none (`options`, `value`, `onChange`) | track `relative inline-flex gap-1 rounded-md bg-bg-subtle p-0.5`; indicator `rounded-md border border-border bg-background shadow-tab transition-[transform,width] duration-base ease-out`; tab `h-7 rounded-md px-3 text-ui`, selected `font-medium text-foreground`, idle `font-normal text-muted-foreground hover:text-foreground`, focus `ring-2 ring-brand-primary/40` |
| `AppShell` (`app-shell.tsx`) | none; route test `isShellRoute` | row `flex flex-1 min-h-0 overflow-hidden print:block print:h-auto print:overflow-visible`; sidebar wrapper `hidden lg:contents`; content column `flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden` |
| `Header` (`header.tsx`) | props `title`, `subtitle`, `showBackButton`, `backButtonText`, `backButtonHref`, `info`, `inlineRightContent`, `leadingIcon`, `className`, `backgroundColor`, `titleClassName`, `aboveTitle`, `actions` | `sticky top-0 z-30 shrink-0 border-b border-border-subtle px-8 py-5` + `bg-background` unless `backgroundColor` is set (inline style); title `truncate text-title font-medium text-foreground`; subtitle `text-ui font-normal text-muted-foreground`; back button `rounded-md p-1 hover:bg-surface-hover` with focus ring |

Usage (tags outside the component's own file):

| component | uses outside its own file | files | with `className` | example locations |
|---|---|---|---|---|
| `<ListHeader>` | 19 | 12 | 0 | `app/helper/overview/page.tsx:145`, `app/helper/reports/page.tsx:498`, `app/helper/reports/page.tsx:759`, … +16 more lines |
| `<ListRow>` | 0 | 0 | 0 | **not used** |
| `<SortHeader>` | 32 | 4 | 0 | `app/helper/reports/page.tsx:511`, `app/helper/reports/page.tsx:514`, `app/helper/reports/page.tsx:517`, … +29 more lines |
| `<SortIcon>` | 6 | 6 | 0 | `app/helpers/page.tsx:77`, `app/page.tsx:159`, `app/reports/slas/page.tsx:48`, … +3 more lines |
| `<Table>` | 0 | 0 | 0 | **not used** |
| `<TableHeader>` | 0 | 0 | 0 | **not used** |
| `<TableBody>` | 0 | 0 | 0 | **not used** |
| `<TableRow>` | 0 | 0 | 0 | **not used** |
| `<TableHead>` | 0 | 0 | 0 | **not used** |
| `<TableCell>` | 0 | 0 | 0 | **not used** |
| `<TableFooter>` | 0 | 0 | 0 | **not used** |
| `<TableCaption>` | 0 | 0 | 0 | **not used** |
| `<Dialog>` | 13 | 12 | 0 | `app/helper/tickets/[id]/page.tsx:1600`, `components/auth/guest-adoption-confirm-dialog.tsx:17`, `components/modals/image-upload-modal.tsx:178`, … +10 more lines |
| `<DialogContent>` | 13 | 12 | 13 | `app/helper/tickets/[id]/page.tsx:1607`, `components/auth/guest-adoption-confirm-dialog.tsx:18`, `components/modals/image-upload-modal.tsx:179`, … +10 more lines |
| `<DialogHeader>` | 12 | 11 | 2 | `app/helper/tickets/[id]/page.tsx:1608`, `components/auth/guest-adoption-confirm-dialog.tsx:19`, `components/modals/image-upload-modal.tsx:180`, … +9 more lines |
| `<DialogTitle>` | 13 | 12 | 2 | `app/helper/tickets/[id]/page.tsx:1609`, `components/auth/guest-adoption-confirm-dialog.tsx:20`, `components/modals/image-upload-modal.tsx:181`, … +10 more lines |
| `<DialogDescription>` | 11 | 10 | 7 | `app/helper/tickets/[id]/page.tsx:1610`, `components/auth/guest-adoption-confirm-dialog.tsx:21`, `components/modals/image-upload-modal.tsx:182`, … +8 more lines |
| `<DialogFooter>` | 11 | 9 | 5 | `app/helper/tickets/[id]/page.tsx:1614`, `components/auth/guest-adoption-confirm-dialog.tsx:36`, `components/modals/image-upload-modal.tsx:247`, … +8 more lines |
| `<DialogTrigger>` | 0 | 0 | 0 | **not used** |
| `<DialogClose>` | 0 | 0 | 0 | **not used** |
| `<DrawerPanel>` | 5 | 5 | 2 | `components/drawers/accept-request-drawer.tsx:46`, `components/drawers/add-helper-drawer.tsx:235`, `components/drawers/create-sla-drawer.tsx:102`, … +2 more lines |
| `<Popover>` | 1 | 1 | 0 | `components/payment/distribution-preview.tsx:54` |
| `<PopoverTrigger>` | 1 | 1 | 0 | `components/payment/distribution-preview.tsx:64` |
| `<PopoverContent>` | 1 | 1 | 1 | `components/payment/distribution-preview.tsx:93` |
| `<PopoverAnchor>` | 0 | 0 | 0 | **not used** |
| `<PopoverArrow>` | 1 | 1 | 1 | `components/payment/distribution-preview.tsx:123` |
| `<EmptyState>` | 20 | 15 | 1 | `app/helper/overview/page.tsx:158`, `app/helper/reports/page.tsx:580`, `app/helper/reports/page.tsx:839`, … +17 more lines |
| `<ErrorState>` | 13 | 10 | 0 | `app/helper/overview/page.tsx:156`, `app/helper/reports/page.tsx:530`, `app/helper/reports/page.tsx:790`, … +10 more lines |
| `<Skeleton>` | 8 | 1 | 8 | `app/helper/reports/payouts/[id]/page.tsx:98`, `app/helper/reports/payouts/[id]/page.tsx:100`, `app/helper/reports/payouts/[id]/page.tsx:101`, … +5 more lines |
| `<ListSkeleton>` | 26 | 20 | 9 | `app/helper/overview/page.tsx:154`, `app/helper/reports/page.tsx:528`, `app/helper/reports/page.tsx:788`, … +23 more lines |
| `<PageSkeleton>` | 5 | 4 | 0 | `app/loading.tsx:8`, `app/page.tsx:178`, `app/support/chat/page.tsx:551`, … +2 more lines |
| `<TabSelector>` | 2 | 1 | 0 | `app/page.tsx:253`, `app/page.tsx:324` |
| `<AppShell>` | 1 | 1 | 0 | `app/layout.tsx:79` |
| `<Header>` | 48 | 33 | 1 | `app/help/page.tsx:155`, `app/helper/overview/page.tsx:77`, `app/helper/reports/page.tsx:407`, … +45 more lines |

- **`ListRow` is never rendered as a component.** Rows use the `listRowClass()` helper instead: 23 in 12 files. Options at those call sites: `interactive` ×9, `tone` ×2 (both the unclaimed-ticket rows in `app/tickets/page.tsx`), `bordered` ×11 (same-line matches).
- **The whole `Table` family is unused.** Four raw `<table>` elements exist instead: `app/helper/reports/payouts/[id]/page.tsx:170`, `app/slas/[id]/page.tsx:490`, `app/slas/[id]/page.tsx:540`, `app/slas/[id]/page.tsx:566` (with 11 `<tr>`, 17 `<th>` and 19 `<td>`).
- `DialogTrigger`, `DialogClose`, `PopoverAnchor`, `CardAction` and `CardFooter` are unused. `Popover` is used in one file.
- `SortHeader` is used in 4 files (32 tags); 6 other files import `SortIcon` into a page-specific sort button.
- The lavender header band `bg-brand-primary/10` is written 35 times in total, of which 2 are the `ListHeader` and `PageSkeleton` definitions; the rest are tints on other elements (tiles, selected states, buttons).

Props passed:

**DrawerPanel props (5 uses)**

| prop | passed | values | example locations |
|---|---|---|---|
| `title` | 5 |  | `components/drawers/accept-request-drawer.tsx:46`, `components/drawers/add-helper-drawer.tsx:235`, `components/drawers/create-sla-drawer.tsx:102`, … +2 more lines |
| `headerAction` | 1 |  | `components/drawers/accept-request-drawer.tsx:46` |
| `footer` | 4 |  | `components/drawers/accept-request-drawer.tsx:46`, `components/drawers/add-helper-drawer.tsx:235`, `components/drawers/end-ticket-drawer.tsx:100`, … +1 more lines |
| `width` | 0 |  | **never passed** |
| `backdropClassName` | 0 |  | **never passed** |
| `className` | 2 | `shadow-2xl` ×2 | `components/drawers/add-helper-drawer.tsx:235`, `components/drawers/log-time-drawer.tsx:90` |
| `footerClassName` | 3 | `border-t-0` ×3 | `components/drawers/add-helper-drawer.tsx:235`, `components/drawers/end-ticket-drawer.tsx:100`, `components/drawers/log-time-drawer.tsx:90` |

**DialogContent props (13 uses)**

| prop | passed | values | example locations |
|---|---|---|---|
| `className` | 13 | `sm:max-w-md` ×8, `sm:max-w-lg` ×1, `gap-0 p-0 sm:max-w-md` ×1, `w-auto max-w-[calc(100%-2rem)] sm:max-w-[90vw] p-2` ×1, `gap-4.75 sm:max-w-md` ×1, `sm:max-w-lg max-h-[90vh] flex flex-col` ×1 | `app/helper/tickets/[id]/page.tsx:1607`, `components/auth/guest-adoption-confirm-dialog.tsx:18`, `components/modals/image-upload-modal.tsx:179`, … +10 more lines |
| `showCloseButton` | 4 | `false` ×3, `!isRemoving` ×1 | `components/modals/remove-helper-modal.tsx:35`, `components/modals/sla-confirmation-modal.tsx:40`, `components/modals/unsaved-changes-modal.tsx:33`, … +1 more lines |

**PopoverContent props (1 uses)**

| prop | passed | values | example locations |
|---|---|---|---|
| `className` | 1 | `z-[60] w-auto max-w-xs rounded-md border-0 bg-fore` ×1 | `components/payment/distribution-preview.tsx:93` |
| `align` | 0 |  | **never passed** |
| `side` | 1 | `top` ×1 | `components/payment/distribution-preview.tsx:93` |

**EmptyState props (20 uses)**

| prop | passed | values | example locations |
|---|---|---|---|
| `icon` | 8 |  | `app/helper/overview/page.tsx:158`, `app/helpers/page.tsx:819`, `app/helpers/page.tsx:833`, … +5 more lines |
| `description` | 8 |  | `app/helper/overview/page.tsx:158`, `app/helpers/page.tsx:819`, `app/helpers/page.tsx:833`, … +5 more lines |
| `action` | 3 |  | `app/helpers/page.tsx:819`, `app/support/tickets/page.tsx:268`, `app/user/overview/page.tsx:194` |
| `size` | 13 | `sm` ×13 | `app/helper/overview/page.tsx:158`, `app/helper/reports/page.tsx:580`, `app/helper/reports/page.tsx:839`, … +10 more lines |
| `className` | 1 | `items-start px-0 text-left` ×1 | `components/support/resources-content.tsx:67` |

**ErrorState props (13 uses)**

| prop | passed | values | example locations |
|---|---|---|---|
| `title` | 3 |  | `app/helper/reports/payouts/[id]/page.tsx:117`, `app/user/reports/page.tsx:448`, `app/user/reports/page.tsx:691` |
| `description` | 0 |  | **never passed** |
| `onRetry` | 13 |  | `app/helper/overview/page.tsx:156`, `app/helper/reports/page.tsx:530`, `app/helper/reports/page.tsx:790`, … +10 more lines |
| `size` | 11 | `sm` ×11 | `app/helper/overview/page.tsx:156`, `app/helper/reports/page.tsx:530`, `app/helper/reports/page.tsx:790`, … +8 more lines |
| `className` | 0 |  | **never passed** |

**ListSkeleton props (26 uses)**

| prop | passed | values | example locations |
|---|---|---|---|
| `rows` | 26 | `5` ×15, `4` ×5, `3` ×4, `2` ×2 | `app/helper/overview/page.tsx:154`, `app/helper/reports/page.tsx:528`, `app/helper/reports/page.tsx:788`, … +23 more lines |
| `avatar` | 5 | `false` ×5 | `app/helper/settings/payout/page.tsx:74`, `app/helper/settings/profile/page.tsx:200`, `app/landing-page/page.tsx:193`, … +2 more lines |
| `badge` | 7 | `false` ×7 | `app/helper/settings/payout/page.tsx:74`, `app/helper/settings/profile/page.tsx:200`, `app/helper/tickets/[id]/page.tsx:1378`, … +4 more lines |
| `className` | 9 | `max-w-3xl divide-y-0` ×3, `divide-y-0 [&>div]:px-0` ×3, `rounded-lg border border-border-subtle` ×1, `rounded-lg border border-border-subtle bg-card` ×1, `max-w-xl divide-y-0 [&>div]:px-0` ×1 | `app/helper/settings/payout/page.tsx:74`, `app/helper/settings/profile/page.tsx:200`, `app/helper/tickets/[id]/page.tsx:1378`, … +6 more lines |

**Skeleton props (8 uses)**

| prop | passed | values | example locations |
|---|---|---|---|
| `className` | 8 | `size-8 rounded-md` ×1, `h-4 w-20` ×1, `h-3 w-32` ×1, `h-4 w-36` ×1, `h-3 w-24` ×1, `h-3.5 w-1/3` ×1, `h-3.5 w-1/2` ×1, `h-3.5 w-1/4` ×1 | `app/helper/reports/payouts/[id]/page.tsx:98`, `app/helper/reports/payouts/[id]/page.tsx:100`, `app/helper/reports/payouts/[id]/page.tsx:101`, … +5 more lines |
| `style` | 0 |  | **never passed** |

**Header props (48 uses)**

| prop | passed | values | example locations |
|---|---|---|---|
| `subtitle` | 40 |  | `app/help/page.tsx:155`, `app/helper/overview/page.tsx:77`, `app/helper/reports/page.tsx:407`, … +37 more lines |
| `showBackButton` | 3 | `true` ×2, `showBackButton` ×1 | `app/helper/tickets/[id]/page.tsx:877`, `app/helper/tickets/[id]/page.tsx:906`, `components/ticket-chat/ticket-chat.tsx:338` |
| `backButtonText` | 0 |  | **never passed** |
| `backButtonHref` | 0 |  | **never passed** |
| `info` | 1 |  | `app/settings/payment/page.tsx:450` |
| `inlineRightContent` | 2 |  | `app/helper/tickets/[id]/page.tsx:906`, `components/ticket-chat/ticket-chat.tsx:338` |
| `leadingIcon` | 1 |  | `components/ticket-chat/ticket-chat.tsx:338` |
| `className` | 1 | `pl-14` ×1 | `app/landing-page/page.tsx:103` |
| `backgroundColor` | 1 | `headerBackgroundColor` ×1 | `components/ticket-chat/ticket-chat.tsx:338` |
| `titleClassName` | 3 | `text-xl` ×2, `headerTitleClassName` ×1 | `app/helper/tickets/[id]/page.tsx:877`, `app/helper/tickets/[id]/page.tsx:906`, `components/ticket-chat/ticket-chat.tsx:338` |
| `aboveTitle` | 3 |  | `app/helpers/[id]/page.tsx:372`, `app/helpers/[id]/page.tsx:383`, `app/helpers/[id]/page.tsx:406` |
| `actions` | 4 |  | `app/helper/tickets/[id]/page.tsx:906`, `app/helpers/page.tsx:472`, `app/slas/page.tsx:119`, … +1 more lines |

- `DrawerPanel`: `width` and `backdropClassName` are never passed, so every drawer is 440px. Two drawers add `shadow-2xl` on top of the panel's `shadow-modal`; three remove the footer divider with `border-t-0`.
- `DialogContent`: all 13 pass a width class; `sm:max-w-md` (8) is more common than the primitive's own default `sm:max-w-lg`.
- `EmptyState`/`ErrorState`: the `sm` size is used 13 of 20 and 11 of 13 times.
- `Header`: `backButtonText` and `backButtonHref` are never passed. `titleClassName="text-xl"` is passed twice and a dynamic value once, replacing `text-title` on those pages.
- `SelectTrigger` (not in the brief's list, noted for completeness): {'dynamic': 11, 'outline': 2, 'default (omitted)': 5}.

## 10. Icon libraries

| Library | Import statements | Usages |
|---|---|---|
| `@flaticon/flaticon-uicons` (CSS imported once in `globals.css` line 4) through `Icon` (`src/components/ui/icon.tsx`) | 75 files import `@/components/ui/icon` | 305 `<Icon>` tags in 75 files; 359 `"fi-…"` string literals, 81 distinct glyphs |
| `lucide-react` | 24 imported names in 22 files | 41 JSX usages of 5 distinct icons |
| Other icon packages (`react-icons`, `@heroicons/*`, `@radix-ui/react-icons`, `@tabler/*`, Font Awesome, MUI icons) | 0 | 0 |

### Flaticon UIcons

- Families: `fi-rr-*` 355, `fi-brands-*` 4 (regular rounded and brands only).
- `<Icon>` names: 302 literal, 3 dynamic (`components/auth/role-option-cards.tsx:81` `option.icon`, `components/ui/empty-state.tsx:50` `icon`, `components/ui/ticket-badges.tsx:27` `icon`).
- `size` prop: `4 (default, omitted)` ×213, `3` ×34, `3.5` ×29, `5` ×18, `6` ×7, `size === "sm" ? 4 : 5` ×2, `4` ×1, `8` ×1. Off-scale sizes are set with `[--icon-size:…]` classes (see §8: `18px` ×3, `1.2rem` ×3, `19px` ×1, `0.625rem` ×1).
- Raw `<i className="… fi …">` that bypasses `Icon`: 2 — `components/layout/public-support-sidebar.tsx:29`, `components/layout/sidebar.tsx:41`.

All glyph names with reference counts: `fi-rr-info` ×46, `fi-rr-arrow-up-right-from-square` ×23, `fi-rr-check` ×20, `fi-rr-plus` ×18, `fi-rr-arrow-left` ×14, `fi-rr-menu-dots-vertical` ×13, `fi-rr-comment` ×12, `fi-rr-download` ×12, `fi-rr-copy` ×11, `fi-rr-interrogation` ×10, `fi-rr-user` ×10, `fi-rr-cross` ×9, `fi-rr-clock` ×8, `fi-rr-angle-small-down` ×8, `fi-rr-comments` ×7, `fi-rr-search` ×7, `fi-rr-document` ×6, `fi-rr-envelope` ×5, `fi-rr-trash` ×5, `fi-rr-users` ×5, `fi-rr-credit-card` ×5, `fi-rr-arrow-right` ×4, `fi-rr-file-spreadsheet` ×4, `fi-rr-list` ×4, `fi-rr-check-circle` ×4, `fi-rr-bell` ×4, `fi-brands-github` ×4, `fi-rr-user-add` ×3, `fi-rr-cross-circle` ×3, `fi-rr-sign-in-alt` ×3, `fi-rr-angle-small-up` ×3, `fi-rr-browser` ×3, `fi-rr-star-octogram` ×3, `fi-rr-apps` ×3, `fi-rr-settings` ×3, `fi-rr-angle-small-right` ×3, `fi-rr-book-alt` ×2, `fi-rr-bank` ×2, `fi-rr-sidebar-flip` ×2, `fi-rr-folder-open` ×2, `fi-rr-add-folder` ×2, `fi-rr-refresh` ×2, `fi-rr-edit` ×2, `fi-rr-folder` ×2, `fi-rr-upload` ×2, `fi-rr-calendar-clock` ×1, `fi-rr-check-double` ×1, `fi-rr-flask` ×1, `fi-rr-shield-exclamation` ×1, `fi-rr-menu-dots` ×1, `fi-rr-angle-small-left` ×1, `fi-rr-sparkles` ×1, `fi-rr-shield` ×1, `fi-rr-wrench-simple` ×1, `fi-rr-life-ring` ×1, `fi-rr-menu-burger` ×1, `fi-rr-paint-brush` ×1, `fi-rr-plug` ×1, `fi-rr-list-check` ×1, `fi-rr-lock` ×1, `fi-rr-cross-small` ×1, `fi-rr-paper-plane` ×1, `fi-rr-target` ×1, `fi-rr-image-slash` ×1, `fi-rr-b` ×1, `fi-rr-italic` ×1, `fi-rr-strikethrough` ×1, `fi-rr-link` ×1, `fi-rr-code-simple` ×1, `fi-rr-square-code` ×1, `fi-rr-picture` ×1, `fi-rr-smile` ×1, `fi-rr-at` ×1, `fi-rr-video-camera-alt` ×1, `fi-rr-microphone` ×1, `fi-rr-paper-plane-top` ×1, `fi-rr-user-xmark` ×1, `fi-rr-inbox` ×1, `fi-rr-exclamation` ×1, `fi-rr-circle-dashed` ×1, `fi-rr-circle-half-stroke` ×1.

### Lucide

| icon | importing files | JSX uses | files |
|---|---|---|---|
| `Loader2` | 19 | 36 | `app/helper/settings/profile/page.tsx` ×2, `app/invite/[token]/page.tsx` ×1, `app/onboarding/join/page.tsx` ×1, `app/onboarding/page.tsx` ×6, `app/onboarding/waiting/page.tsx` ×2, `app/projects/[id]/page.tsx` ×1, `app/settings/payment/connect/return/page.tsx` ×1, `app/settings/profile/page.tsx` ×1, `app/settings/project/page.tsx` ×7, `components/auth/helper-invite-acceptance.tsx` ×1, `components/auth/role-option-cards.tsx` ×1, `components/auth/sign-in-options.tsx` ×3, `components/modals/image-upload-modal.tsx` ×1, `components/settings/notification-channels-manager.tsx` ×2, `components/settings/personal-notification-settings.tsx` ×1, `components/support/guest-banner.tsx` ×1, `components/support/ticket-unavailable-notice.tsx` ×1, `components/ticket-chat/chat-input.tsx` ×2, `components/ui/button.tsx` ×1 |
| `CircleIcon` | 2 | 2 | `components/ui/dropdown-menu.tsx` ×1, `components/ui/radio-group.tsx` ×1 |
| `ChevronDown` | 1 | 1 | `components/ui/list.tsx` ×1 |
| `ChevronUp` | 1 | 1 | `components/ui/list.tsx` ×1 |
| `ChevronsUpDown` | 1 | 1 | `components/ui/list.tsx` ×1 |

Every Lucide import is one of the allowed uses: `Loader2` (spinner), `CircleIcon` (the radio dot in `radio-group.tsx` and the radio item in `dropdown-menu.tsx`) and the three chevrons inside `SortIcon` in `list.tsx`. **No Lucide icon is used beyond the allowed set.**

`Loader2` is imported by 19 files and rendered 36 times (one of them inside `Button`'s `loading` state). CLAUDE.md restricts it to buttons, the chat composer, image upload and small inline actions; whether each of the 35 direct uses meets that rule was not classified one by one. Files with the most direct uses: `app/settings/project/page.tsx` 7, `app/onboarding/page.tsx` 6, `components/auth/sign-in-options.tsx` 3. `<Button loading>` is used 12 times. A separate SVG spinner, `Loader` (`components/ui/loader.tsx`), is rendered in 12 files for page-level loading.

### Inline `<svg>`

12 inline `<svg>` elements in 10 files:

| component | count | fill | locations |
|---|---|---|---|
| `GithubIcon` (the same GitHub mark, defined locally in four files; `fi-brands-github` is also used 4 times through `Icon`) | 4 | `currentColor` | `app/helper/settings/profile/page.tsx:28`, `app/helpers/[id]/page.tsx:182`, `app/helpers/page.tsx:63`, `app/settings/profile/page.tsx:20` |
| Provider marks in the sign-in buttons | 2 | `currentColor` (on the element or its paths) | `components/auth/sign-in-options.tsx:98`, `components/auth/sign-in-options.tsx:118` |
| 12×12 status glyphs inside badges | 3 | `none` (stroke) | `app/helper/reports/page.tsx:137`, `app/helper/reports/page.tsx:142`, `app/reports/slas/page.tsx:563` |
| `Logo` (brand) | 1 | `none` | `components/brand/logo.tsx:20` |
| `Loader` (spinner; mask uses `fill="white"`/`fill="black"`) | 1 | `none` | `components/ui/loader.tsx:37` |
| `SidebarToggleIcon` (`sidebar-toggle-icon.tsx`: 20×20, `stroke="currentColor"`, `strokeWidth` 1.5, `size-5 shrink-0`, optional `mirrored` → `-scale-x-100`) | 1 | `none` | `components/ui/sidebar-toggle-icon.tsx:17` |

### Images and brand icons

Image elements in source (21): 2 use a file from `public/` (`/images/stripe-svg.svg`, the Stripe brand tile); the other 19 take runtime URLs (project logos, avatars, chat images, upload preview).

| file | bytes | references in src (non-test) | locations |
|---|---|---|---|
| `public/file.svg` | 391 | 0 | **unreferenced** |
| `public/globe.svg` | 1035 | 0 | **unreferenced** |
| `public/images/ex-logo.png` | 749622 | 0 | **unreferenced** |
| `public/images/logo-algorax.png` | 4231 | 0 | **unreferenced** |
| `public/images/logo-velvet.png` | 124574 | 0 | **unreferenced** |
| `public/images/stripe-s.png` | 455 | 0 | **unreferenced** |
| `public/images/stripe-svg.svg` | 853 | 2 | `app/helper/settings/payout/page.tsx:101`, `app/settings/payment/page.tsx:1010` |
| `public/images/velvet.png` | 502 | 0 | **unreferenced** |
| `public/images/velvet2.png` | 652 | 0 | **unreferenced** |
| `public/next.svg` | 1375 | 0 | **unreferenced** |
| `public/vercel.svg` | 128 | 0 | **unreferenced** |
| `public/window.svg` | 385 | 0 | **unreferenced** |

Only `public/images/stripe-svg.svg` is referenced from non-test source. The other eleven files in `public/` have no reference in the scanned files: the five create-next-app SVGs (`file`, `globe`, `next`, `vercel`, `window`) and six images under `public/images/` (`ex-logo.png` is 749,622 bytes). `src/app/favicon.ico` is the only image file under `src/`. The GitHub mark has no file in `public/`; it exists as the inline `GithubIcon` SVG and as `fi-brands-github`.

## 11. Summary of findings

### Tokenised versus hardcoded, per category

| Category | Token | Tailwind default (not a project token) | Hardcoded | Notes |
|---|---|---|---|---|
| Colour classes | 2351 | 93 keyword (`transparent` 62, `white`/`black`/`current` 31) | 101 default-palette + 27 hex = 128 | 15 of the 27 hex classes are Stripe/GitHub exceptions |
| Colour literals in ts/tsx | — | — | 45 hex in 14 files, plus 6 RGB tuples in `lib/report-pdf.ts` | 29 of 45 under a CLAUDE.md exception, 16 not |
| Radius | 246 | 67 | 16 | 9 of the hardcoded are the squircle map, 7 are outside it |
| Shadow | 18 | 42 (15 are `shadow-none`) | 0 | no arbitrary or inline shadows |
| Gradients | 1 (CSS button sheen) | — | 4 elements, 10 hex stops | two files |
| Font size | 133 | 729 in the documented scale + 80 outside it | 4 | plus one inline `fontSize: "11px"` |
| Font weight | 81 | 401 documented + 12 `font-bold` | 0 | |
| Spacing and sizing | 0 (no spacing tokens exist) | 3121 | 91 | all arbitrary values are heights, widths or `size-*` |
| Motion | 130 | 142 (`transition-*`, `animate-spin`/`pulse`/`in`/`out`, accordion) | 0 | no `transition-all` |
| Icons | 305 `<Icon>` (UIcons) | 41 Lucide, all allowed | 12 inline `<svg>`, 2 raw `<i>` | |

Defined but unused tokens: 8 colour tokens (`sidebar-ring`, `sidebar-accent-foreground`, `sidebar-accent`, `sidebar-primary-foreground`, `sidebar-primary`, `chart-5`, `chart-4`, `chart-1`), `text-2xs`, `animate-leave`, `.font-mono-id`.

### Top offending files

Counts per file of: default-palette colour classes, arbitrary hex colour classes, `*-white`/`*-black` classes, arbitrary radii (outside `lib/constants.ts`), default `shadow-sm/xs/md/2xl`, type outside the documented scale (`text-lg…4xl`, arbitrary sizes, `font-bold`), arbitrary sizes/spacing, raw `<button>` elements (outside `components/ui` and `Header`) and ad-hoc card candidates. 97 files have at least one. Top 20 by total:

| file | default-palette colour | hex colour class | `*-white`/`*-black` | arbitrary radius | default `shadow-*` | off-scale type | arbitrary size/spacing | raw `<button>` | ad-hoc card | total |
|---|---|---|---|---|---|---|---|---|---|---|
| `app/tickets/page.tsx` |  |  |  |  |  | 10 | 4 | 11 | 7 | 32 |
| `components/ticket-chat/ticket-chat.tsx` | 21 |  | 1 |  |  |  | 1 |  | 1 | 24 |
| `app/helper/tickets/[id]/page.tsx` | 4 | 1 | 1 |  | 1 | 6 | 1 | 1 | 7 | 22 |
| `app/onboarding/page.tsx` |  | 2 | 1 |  |  | 11 |  | 3 | 4 | 21 |
| `app/settings/payment/page.tsx` |  | 5 | 1 |  |  |  | 9 | 3 | 3 | 21 |
| `components/layout/top-bar.tsx` |  |  | 1 |  |  | 1 | 13 | 4 |  | 19 |
| `components/ticket-chat/time-entry-review.tsx` | 15 |  |  |  |  |  | 2 | 1 | 1 | 19 |
| `components/support/about-support-content.tsx` |  |  |  |  |  | 4 | 11 |  | 3 | 18 |
| `components/support/rates-and-details-content.tsx` |  | 6 |  |  |  | 6 |  |  | 6 | 18 |
| `app/projects/[id]/page.tsx` | 1 |  |  |  | 3 | 5 | 4 |  | 3 | 16 |
| `app/helper/reports/payouts/[id]/page.tsx` | 10 |  |  |  |  | 1 |  |  | 4 | 15 |
| `app/reports/slas/page.tsx` |  |  | 2 |  |  |  |  | 10 | 2 | 14 |
| `components/drawers/add-helper-drawer.tsx` | 4 |  |  |  | 3 |  | 5 |  | 2 | 14 |
| `app/slas/[id]/page.tsx` |  |  | 1 |  |  | 11 |  |  |  | 12 |
| `app/support/tickets/page.tsx` |  |  |  |  |  | 2 | 2 | 6 | 1 | 11 |
| `components/drawers/end-ticket-drawer.tsx` | 5 |  |  |  |  |  |  | 2 | 4 | 11 |
| `components/ui/select.tsx` |  |  | 7 |  | 1 |  | 3 |  |  | 11 |
| `components/layout/sandbox-banner.tsx` | 9 |  |  |  |  |  |  |  |  | 9 |
| `components/support/ticket-unavailable-notice.tsx` |  |  |  |  | 3 | 3 |  |  | 3 | 9 |
| `app/helper/settings/payout/page.tsx` |  | 3 | 1 |  |  |  | 4 |  |  | 8 |

The columns mix different kinds of finding and the card column is heuristic, so the total is a rough ordering, not a score. `components/ui/*` files appear because of their built-in arbitrary values and default shadows (`shadow-xs` on form controls).

### Inconsistencies found

**Colour**

1. Warning, error and success states are styled three ways: the `status-*` tokens (`getStatusBadgeClass`, 17 class occurrences in total), the `badge-*` tokens (Badge variants) and default-palette classes (101 occurrences: amber 56, red 31, green 9, yellow 3, emerald 2). Amber has no token at all; every sandbox banner, warning callout and pending pill uses `amber-*` directly.
2. Error text uses both `text-destructive` (16) and `text-red-500/600/700` (12). Success ticks use `text-green-600` (4) alongside `text-status-success-text` (6).
3. Gradient stops (10) and the `#f09191` status dot (2) are hex values outside every exception. The four gradients have no dark-mode variant.
4. `slaColors` in `app/slas/page.tsx` redeclares four avatar-palette hex values instead of reading them from `lib/constants`. `avatarColorsHex` holds only the light palette, so inline avatar fills do not switch with the theme, while the `bg-avatar-N` classes do.
5. `"#554abf"` is repeated three times in `settings/branding` as the default project colour; it equals the light `brand-primary` token.
6. The PDF export's `BRAND` colour is `[59, 91, 219]` (a blue), labelled as an approximation of `brand-primary` (`#554abf`, purple).
7. `app/settings/payment/page.tsx:999`–`1000` gives the tile `bg-[#24292f]` and the `Logo` inside it `text-[#24292f]`, the same colour.
8. Text-colour tokens are used as fills: `bg-text-tertiary` (3), `bg-muted-foreground` (6), `bg-foreground` (5); `bg-border-subtle`/`bg-border` (10) are used for divider lines.
9. Alpha steps on tokens are not from a fixed set: `/5`, `/8` (as `/[0.08]`), `/10`, `/15`, `/20`, `/30`, `/40`, `/50`, `/60`, `/70`, `/80`, `/90` are all in use.
10. `chart-2` and `chart-3` colour notification icons; `chart-1`, `-4`, `-5` and five `sidebar-*` tokens are unused.
11. `text-white` (21) is used on fills where a `*-foreground` token exists (for example `brand-foreground`, 32 uses).

**Radius**

12. Bare `rounded` (25) and `rounded-sm` (13) both mean 4px.
13. `rounded-[12px]` (4, `app/support/page.tsx`) and `rounded-[11px]` (2, `skeleton.tsx`) repeat squircle-map values inline rather than through `SQUIRCLE_RADIUS`.
14. The `@theme` comment assigns `rounded-sm` to badges; the Badge primitive and CLAUDE.md use `rounded-md`.
15. `--radius` (10px) drives the chat code block and matches no radius token.

**Shadow**

16. `shadow-sm` (16), `shadow-md` (3) and `shadow-2xl` (2) are used next to the five shadow tokens; `shadow-sm` appears on cards, although the Card default is no shadow.
17. Two drawers pass `shadow-2xl` to `DrawerPanel`, which already has `shadow-modal`.
18. `shadow-popover` collides by name with the `popover` colour token.

**Typography**

19. `text-2xl` (31) duplicates `text-title` (1); `text-3xl` (2) duplicates `text-display` (1). Titles rendered through `Header` use the token, titles rendered directly use the default class.
20. `text-lg` (25) and `text-xl` (20) carry the 18px and 20px headings but are not in the documented scale; `Header` receives `titleClassName="text-xl"` on the ticket page.
21. `text-2xs` (11px) is unused, while 11px is set by hand in `HEADING_STYLE` (`fontSize: "11px"`) and in the code-block CSS; `text-[11.25px]` exists once in the TopBar.
22. `text-[0.8125rem]` repeats the `text-ui` size.
23. `font-bold` (12) is outside the documented weights.
24. The long mono font stack is repeated as an inline `fontFamily` string six times instead of `font-mono` (with `tabular-nums`), and `.font-mono-id`, which exists for this, is unused.
25. `fontFamily: 'Cousine, monospace'` references a font the app does not load.
26. Outfit is applied to the TopBar project avatar only, through an arbitrary class; `ProfileAvatar` initials do not use it.

**Spacing and layout**

27. There are no spacing tokens; 3121 scale classes use 261 distinct class names, with half steps (`gap-2.5`, `py-2.5`, `px-3.5`, `gap-4.75`) mixed with whole steps.
28. `gap-*` (508) and `space-x/y-*` (225) coexist; `size-N` and `h-N w-N` coexist.
29. Arbitrary sizes recur without a shared constant: `size-[42px]` (6), `size-[18px]` (8), 22px (9), `w-[230px]` (5), `h-[3px]` (6).
30. Inline lengths `marginTop: "22px"` (2), `rowGap: '31.2px'` (2) and `rowGap: '16px'` (2) are duplicated between `app/helper/tickets/[id]/page.tsx` and `components/ticket-chat/ticket-chat.tsx`.
31. List grid templates built on the same `2rem … calc(… + 36px)` columns are declared in seven constants across four files; `'2rem repeat(11, 1fr)'` is written inline five times in `app/helpers/page.tsx`.
32. `z-[2147483647]` and `z-[60]` sit outside the z-index steps used by the primitives.

**Components**

33. Button: `secondary`, `link` and `icon-lg` are unused; `neutral` is reachable only in one file. 52 Buttons override the background, 92 the text colour or size, 36 the padding and 9 the height through `className`; 5 carry hex brand colours and 4 an inline `style`.
34. 80 raw `<button>` elements exist outside the primitives, concentrated in the list pages (`app/tickets/page.tsx` 11, `app/reports/slas/page.tsx` 10); up to 65 of them have no focus class of their own. Nine non-button elements carry `role="button"`.
35. Badge: 31 of 37 pass a `className`; 10 override the fill with their own `bg-*`. `type` and `neutral` are identical. `destructive` is unused and `urgent` cannot occur with today's data. `BADGE_SHAPE_CLASS` and `badgeVariants` are exported and unused.
36. Status pills exist outside Badge: a palette-based map in the payout page, a `<span>` pill in `time-entry-review.tsx`, and inline SVG status glyphs in two report pages.
37. Card: 63 `<Card>` in 21 files against 96 card-like `<div>`s in 46 files (heuristic); `bg-card` is written 76 times outside the primitive. `CardAction` and `CardFooter` are unused.
38. Lists: `ListHeader` (19) and `listRowClass()` (23 calls) are used, but the `ListRow` component never is. The `Table` primitive family is entirely unused while four raw `<table>`s exist.
39. Dialog: 8 of 13 `DialogContent`s override the default `sm:max-w-lg` with `sm:max-w-md`.
40. Header: `backButtonText` and `backButtonHref` are never passed.

**Motion**

41. `transition-colors` appears 73 times and `duration-fast` 31 times; transitions without a duration class use Tailwind's 150ms default instead of the 120ms token. `animate-leave` is unused.

**Icons and assets**

42. The GitHub mark is defined four times as a local `GithubIcon` SVG and also used four times as `fi-brands-github`.
43. Two sidebars render a raw `<i className="fi …">` instead of `Icon`.
44. Eleven of the twelve files in `public/` are unreferenced, including a 750 KB PNG and the create-next-app placeholder SVGs.

**Documentation**

45. CLAUDE.md's token table omits `support-header`, the shadcn base colours, `--radius`, the `btn-depth` tokens and `animate-leave`; gives no value for `text-heading`; names `font-medium` twice in the weight list; and documents `text-2xs`, which nothing uses (details in §2.9).

### What is consistent

- Motion durations and easings: no numeric `duration-*`, no `transition-all`.
- No grey-family default-palette classes; neutral greys all come from tokens.
- No `rgb()`/`hsl()`/`oklch()` literals and no inline `boxShadow` in ts/tsx.
- No arbitrary padding, margin or gap values.
- Lucide is confined to the three allowed uses.
- `DrawerPanel` width is never overridden; `<Card>` never re-adds its default classes.
- Negative tracking is only applied to 14px text.
