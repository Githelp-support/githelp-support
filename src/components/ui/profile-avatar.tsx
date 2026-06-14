"use client"

import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getAvatarColorHexForId } from "@/lib/constants"
import { cn } from "@/lib/utils"

export type ProfileAvatarSize = "sm" | "md" | "lg"

type SizePreset = {
  dimensions: string
  rounded: string
  text: string
}

/**
 * Size presets matching the dimensions currently used across the app:
 * - sm: sidebar (w-7 h-7 rounded-[10px])
 * - md: right-sidebar participants / helpers list (w-8 h-8 rounded-[11px])
 * - lg: profile header (w-12 h-12 rounded-[16.5px])
 */
const SIZE_PRESETS: Record<ProfileAvatarSize, SizePreset> = {
  sm: { dimensions: "w-7 h-7", rounded: "rounded-[10px]", text: "text-sm" },
  md: { dimensions: "w-8 h-8", rounded: "rounded-[11px]", text: "text-sm" },
  lg: { dimensions: "w-12 h-12", rounded: "rounded-[16.5px]", text: "text-[21px]" },
}

export interface ProfileAvatarProps {
  /** Stable identifier (user_id, helper_id, etc.) — drives the deterministic fallback color. */
  id: string | null | undefined
  /** Display name; the first character is used as the fallback initial. */
  name?: string | null
  /** Optional avatar image. When non-empty, an <img> is rendered; otherwise the colored fallback shows. */
  avatarUrl?: string | null
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
