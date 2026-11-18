"use client"

import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Icon } from "@/components/ui/icon"
import { getAvatarColorHexForId, SQUIRCLE_RADIUS } from "@/lib/constants"
import { cn } from "@/lib/utils"

export type ProfileAvatarSize = "sm" | "md" | "lg"

type SizePreset = {
  dimensions: string
  rounded: string
  text: string
  /** Box of the ghost glyph in a guest avatar, proportional to the avatar. */
  guestIcon: string
}

/**
 * Size presets matching the dimensions used across the app. Corners come
 * from the shared squircle map so every avatar keeps the same proportion:
 * - sm: sidebar (28px)
 * - md: right-sidebar participants / helpers list (32px)
 * - lg: profile header (48px)
 * Initials stay proportional to their avatar (text-[21px] in the 48px one).
 */
const SIZE_PRESETS: Record<ProfileAvatarSize, SizePreset> = {
  sm: { dimensions: "w-7 h-7", rounded: SQUIRCLE_RADIUS[28], text: "text-sm", guestIcon: "[--icon-size:1rem]" },
  md: { dimensions: "w-8 h-8", rounded: SQUIRCLE_RADIUS[32], text: "text-sm", guestIcon: "[--icon-size:1.125rem]" },
  lg: { dimensions: "w-12 h-12", rounded: SQUIRCLE_RADIUS[48], text: "text-[21px]", guestIcon: "[--icon-size:1.75rem]" },
}

export interface ProfileAvatarProps {
  /** Stable identifier (user_id, helper_id, etc.) — drives the deterministic fallback color. */
  id: string | null | undefined
  /** Display name; the first character is used as the fallback initial. */
  name?: string | null
  /** Optional avatar image. When non-empty, an <img> is rendered; otherwise the colored fallback shows. */
  avatarUrl?: string | null
  /**
   * The person is a guest (visitor without an account): shows the ghost on
   * the guest tile instead of an image or a coloured initial.
   */
  guest?: boolean
  /** Size preset. Defaults to `md`. */
  size?: ProfileAvatarSize
  /** Custom corner radius override (e.g. `"9.625px"` or `9.625`). Falls back to the size preset. */
  radius?: string | number
  /** Additional classes applied to the outer Avatar element. */
  className?: string
}

function normalizeRadius(radius: string | number | undefined): string | undefined {
  if (radius == null) return undefined
  return typeof radius === "number" ? `${radius}px` : radius
}

export function ProfileAvatar({
  id,
  name,
  avatarUrl,
  guest = false,
  size = "md",
  radius,
  className,
}: ProfileAvatarProps) {
  const preset = SIZE_PRESETS[size]
  const fallbackChar = (name?.trim()?.[0] || "U").toUpperCase()
  const bgColor = getAvatarColorHexForId(id)
  const hasImage = typeof avatarUrl === "string" && avatarUrl.length > 0

  const radiusOverride = normalizeRadius(radius)
  const containerStyle: React.CSSProperties | undefined = radiusOverride
    ? { borderRadius: radiusOverride }
    : undefined
  const fallbackStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    ...(radiusOverride ? { borderRadius: radiusOverride } : {}),
  }

  if (guest) {
    return (
      <span
        data-slot="guest-avatar"
        role="img"
        aria-label="Guest"
        className={cn(
          preset.dimensions,
          radiusOverride ? undefined : preset.rounded,
          "flex shrink-0 items-center justify-center bg-avatar-guest-bg text-avatar-guest-fg",
          className
        )}
        style={containerStyle}
      >
        <Icon name="fi-sr-ghost" className={preset.guestIcon} />
      </span>
    )
  }

  return (
    <Avatar
      className={cn(
        preset.dimensions,
        radiusOverride ? undefined : preset.rounded,
        "shrink-0",
        className
      )}
      style={containerStyle}
    >
      {hasImage ? <AvatarImage src={avatarUrl as string} alt={name ?? ""} /> : null}
      <AvatarFallback
        className={cn(
          "font-medium text-foreground",
          preset.text,
          radiusOverride ? undefined : preset.rounded
        )}
        style={fallbackStyle}
      >
        {fallbackChar}
      </AvatarFallback>
    </Avatar>
  )
}
