/**
 * Shared card treatment for the invitation flow.
 *
 * The Card primitive sets `border border-border-subtle py-5` and `px-6` on
 * header/content; `cn()` (tailwind-merge) resolves these overrides so the
 * 1px ring comes from `shadow-card` (`--card-shadow`, ring colour `--ring-card`)
 * instead of a border. Light and dark values live in :root/.dark in globals.css.
 * The transition covers the theme switch (background, ring/shadow); the card
 * has no hover or focus state of its own.
 */
export const inviteCardClassName =
  "w-full max-w-md border-0 bg-surface-card shadow-card rounded-lg py-8 max-md:py-6 animate-enter transition-[background-color,border-color,box-shadow,opacity] duration-fast ease-out"

export const inviteCardSectionClassName = "px-8 max-md:px-6"
