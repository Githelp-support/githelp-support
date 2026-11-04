/**
 * Shared constants: avatar/helper color palette (Tailwind classes and hex for charts).
 * Use avatarColorClasses for AvatarFallback/backgrounds; avatarColorsHex for charts or inline styles.
 */

/** Tailwind classes for avatar/helper backgrounds by index (use index % length) */
export const avatarColorClasses = [
  "bg-avatar-1",
  "bg-avatar-2",
  "bg-avatar-3",
  "bg-avatar-4",
  "bg-avatar-5",
  "bg-avatar-6",
  "bg-avatar-7",
  "bg-avatar-8",
  "bg-avatar-9",
] as const

/** Hex values for the same palette (e.g. charts, external tools) */
export const avatarColorsHex = [
  "#f4bccc",
  "#d1f7ea",
  "#bcedf6",
  "#f6e6bc",
  "#cbbcf6",
  "#d0f6bc",
  "#f7f3d1",
  "#e1d5f7",
  "#bce5f6",
] as const

export function getAvatarColorClass(index: number): string {
  return avatarColorClasses[index % avatarColorClasses.length]
}

export function getAvatarColorHex(index: number): string {
  return avatarColorsHex[index % avatarColorsHex.length]
}

/**
 * Deterministic per-identity color lookup. Same id → same color across every
 * page, no matter what order rows arrived in. Prefer passing a stable id
 * (user_id, helper_id, ticket_id); fall back to email or name only if no id
 * is available.
 */
function hashStringToIndex(input: string | null | undefined, modulo: number): number {
  const s = (input ?? "").trim() || "?"
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (Math.imul(hash, 31) + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % modulo
}

export function getAvatarColorClassForId(id: string | null | undefined): string {
  return avatarColorClasses[hashStringToIndex(id, avatarColorClasses.length)]
}

export function getAvatarColorHexForId(id: string | null | undefined): string {
  return avatarColorsHex[hashStringToIndex(id, avatarColorsHex.length)]
}

/**
 * GitHelp's proportional "squircle" corner for avatars, project logos and
 * icon tiles: about 34% of the element size. Keys are the pixel size of the
 * element; values are literal Tailwind classes so the compiler can see them.
 */
export const SQUIRCLE_RADIUS = {
  20: "rounded-[7px]",
  22: "rounded-[8px]",
  24: "rounded-[8px]",
  28: "rounded-[10px]",
  32: "rounded-[11px]",
  36: "rounded-[12px]",
  42: "rounded-[14px]",
  48: "rounded-[16.5px]",
} as const

export type SquircleSize = keyof typeof SQUIRCLE_RADIUS

/** Radius class for a squircle of `sizePx`; unknown sizes get the 9px fallback used by the project switcher. */
export function squircleRadiusClass(sizePx: number): string {
  return (SQUIRCLE_RADIUS as Record<number, string>)[sizePx] ?? "rounded-[9px]"
}

/** Tooltip (native `title`) for buttons that are not wired to any functionality yet. */
export const ILLUSTRATIVE_BUTTON_TOOLTIP = "This button is currently just illustrative"

/** Tooltip shown when pressing "Confirm creation" in the SLA setup flow, which is not wired to any backend yet. */
export const SLA_CREATION_UNAVAILABLE_TOOLTIP =
  "Creating SLAs is not available yet. This setup flow is shown for illustration only."

/** Slug of Githelp's own project — its public support landing page lives at /support/[slug] */
export const GITHELP_SUPPORT_SLUG = "githelp"

/** Path to Githelp's own public support landing page */
export const GITHELP_SUPPORT_URL = `/support/${GITHELP_SUPPORT_SLUG}`
