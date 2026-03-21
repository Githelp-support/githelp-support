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
