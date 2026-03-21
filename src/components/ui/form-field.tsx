"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface FormFieldProps {
  /** Label text; if omitted, no label is rendered */
  label?: string
  /** Id for the control; used for label htmlFor when label is present */
  id?: string
  /** Optional hint or error shown below the control */
  hint?: string
  /** When true, hint is styled as error */
  error?: boolean
  /** Form control(s); use a single Input, Select, Textarea, etc. */
  children: React.ReactNode
  className?: string
  /** Optional additional content (e.g. icon) next to the label */
  labelAction?: React.ReactNode
}

/**
 * Wraps a form control with a consistent label and optional hint.
 * Single purpose: layout and styling for labeled fields.
 */
export function FormField({
  label,
  id,
  hint,
  error,
  children,
  className,
  labelAction,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {(label != null || labelAction != null) && (
        <div className="flex items-center justify-between gap-2">
          {label != null && (
            <Label htmlFor={id} className="text-sm font-medium text-foreground">
              {label}
            </Label>
          )}
          {labelAction}
        </div>
      )}
      {children}
      {hint != null && (
        <p
          className={cn(
            "text-xs",
            error ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
