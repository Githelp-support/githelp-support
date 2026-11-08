/**
 * Shared card treatment for the invitation flow.
 *
 * The Card primitive sets `border border-border-subtle py-5` and `px-6` on
 * header/content; `cn()` (tailwind-merge) resolves these overrides so the
 * 1px ring comes from `shadow-card` (`--ring-card`) instead of a border.
 */
export const inviteCardClassName =
  "w-full max-w-md border-0 shadow-card rounded-lg py-8 max-md:py-6 animate-enter"

export const inviteCardSectionClassName = "px-8 max-md:px-6"
