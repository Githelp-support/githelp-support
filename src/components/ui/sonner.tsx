"use client"

import type React from "react"

import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Global toaster (mounted once in the root layout). Styled with the tokens;
 * sonner keeps its own stacking and enter/exit motion.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const theme = "light"

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border-subtle)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "font-sans text-ui rounded-lg border border-border-subtle shadow-popover",
          title: "text-ui font-medium",
          description: "text-ui text-muted-foreground",
          closeButton: "border-border-subtle bg-background text-muted-foreground hover:text-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
