"use client"

import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"

/** The chat header's "End session" action. Presentation only: the page decides what ending means. */
export function EndSessionButton(props: Omit<ComponentProps<typeof Button>, "variant" | "children">) {
  return (
    <Button type="button" variant="outline" {...props}>
      <Icon name="fi-rr-sign-out-alt" />
      End session
    </Button>
  )
}
