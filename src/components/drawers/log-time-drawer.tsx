"use client"

import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { FormField } from "@/components/ui/form-field"
import { DrawerPanel } from "@/components/ui/drawer-panel"
import { useState } from "react"
import { validateLoggedDuration, type TimeEntryReviewStatus } from "@/lib/time-entries"

interface LogTimeDrawerProps {
  isOpen: boolean
  onClose: () => void
  onLogTime: (entry: TimeEntry) => void
}

export interface TimeEntry {
  id: string
  type: "together" | "solo"
  date: string
  hours: number
  minutes: number
  note?: string // Added optional note field
  /** Customer review of a persisted entry; absent for an entry the drawer just created. */
  reviewStatus?: TimeEntryReviewStatus
  declineReason?: string | null
  autoAccepted?: boolean
  /** `projects_helpers.helper_id` of whoever logged a persisted entry. */
  helperId?: string
  /** User who logged a persisted entry, for the Logged time avatar. */
  helperUser?: { id: string; name: string; avatarUrl: string | null }
}

export function LogTimeDrawer({ isOpen, onClose, onLogTime }: LogTimeDrawerProps) {
  const [timeType, setTimeType] = useState<"together" | "solo">("together")
  const [hours, setHours] = useState("")
  const [minutes, setMinutes] = useState("")
  const [note, setNote] = useState("") // Added note state
  const [durationError, setDurationError] = useState<string | null>(null)

  // The drawer stays mounted while closed (exit animation); reset the form on close.
  const resetForm = () => {
    setTimeType("together")
    setHours("")
    setMinutes("")
    setNote("")
    setDurationError(null)
  }
  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = () => {
    // Whole numbers only, minutes < 60, total between 1 minute and 24 hours;
    // a zero or negative entry must never reach the database.
    const validation = validateLoggedDuration(hours, minutes)
    if (!validation.ok) {
      setDurationError(validation.error)
      return
    }
    setDurationError(null)

    const entry: TimeEntry = {
      id: Date.now().toString(),
      type: timeType,
      date: formatDate(new Date()),
      hours: validation.hours,
      minutes: validation.minutes,
      note: note.trim() || undefined, // Include note if provided
    }

    onLogTime(entry)
    handleClose()
  }

  const handleHoursChange = (value: string) => {
    setHours(value)
    if (durationError) setDurationError(null)
  }
  const handleMinutesChange = (value: string) => {
    setMinutes(value)
    if (durationError) setDurationError(null)
  }

  return (
    <DrawerPanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Log time"
      className="shadow-2xl"
      footerClassName="border-t-0"
      footer={
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-md text-ui font-medium shadow-sm"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="log-time-form"
            disabled={!hours && !minutes}
            variant="default"
            className="flex-1 py-2.5 rounded-md text-ui font-medium bg-brand-primary hover:bg-brand-primary/90 text-brand-foreground shadow-md"
          >
            Log time
          </Button>
        </div>
      }
    >
      <form
        id="log-time-form"
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="flex-1 px-6 py-5 space-y-6 overflow-auto">
          <div className="space-y-3">
            <Label className="text-ui font-semibold text-foreground">Type of time</Label>
            <RadioGroup
              value={timeType}
              onValueChange={(value) => setTimeType(value as "together" | "solo")}
              className="grid gap-2.5"
            >
              <div className="flex items-center space-x-2.5">
                <RadioGroupItem
                  value="together"
                  id="together"
                  className="size-[18px] border-muted-foreground/40 data-[state=checked]:border-primary"
                />
                <Label htmlFor="together" className="cursor-pointer text-sm font-normal text-foreground/80">
                  Together - Time spent actively working with the user
                </Label>
              </div>
              <div className="flex items-center space-x-2.5">
                <RadioGroupItem
                  value="solo"
                  id="solo"
                  className="size-[18px] border-muted-foreground/40 data-[state=checked]:border-primary"
                />
                <Label htmlFor="solo" className="cursor-pointer text-sm font-normal text-foreground/80">
                  Solo - Time spent researching or preparing solutions
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Hours" id="hours">
                <Input
                  id="hours"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="24"
                  step="1"
                  value={hours}
                  onChange={(e) => handleHoursChange(e.target.value)}
                  placeholder="0"
                  aria-invalid={!!durationError}
                  aria-describedby={durationError ? "duration-error" : undefined}
                  className="h-10 rounded-lg border-border"
                />
              </FormField>
              <FormField label="Minutes" id="minutes">
                <Input
                  id="minutes"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="59"
                  step="1"
                  value={minutes}
                  onChange={(e) => handleMinutesChange(e.target.value)}
                  placeholder="0"
                  aria-invalid={!!durationError}
                  aria-describedby={durationError ? "duration-error" : undefined}
                  className="h-10 rounded-lg border-border"
                />
              </FormField>
            </div>
            {durationError && (
              <p id="duration-error" role="alert" className="text-xs leading-relaxed text-destructive">
                {durationError}
              </p>
            )}
          </div>

          <FormField label="Note (optional)" id="note">
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about what you worked on..."
              className="rounded-lg border-border min-h-20 resize-none"
            />
          </FormField>

          <div className="rounded-lg border border-border-subtle bg-bg-subtle p-4">
            <h4 className="text-ui font-semibold text-foreground mb-1">Time tracking</h4>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Log time as you work on the ticket. We recommend writing a short note, so it is easier for the user to
              follow what the time logged is for.
            </p>
          </div>
        </div>
      </form>
    </DrawerPanel>
  )
}
