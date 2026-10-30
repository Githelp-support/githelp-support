"use client"

import { Button } from "@/components/ui/button"
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
      date: new Date().toLocaleDateString("en-GB"),
      hours: validation.hours,
      minutes: validation.minutes,
      note: note.trim() || undefined, // Include note if provided
    }

    onLogTime(entry)

    // Reset form
    setTimeType("together")
    setHours("")
    setMinutes("")
    setNote("") // Reset note field
    onClose()
  }

  const handleHoursChange = (value: string) => {
    setHours(value)
    if (durationError) setDurationError(null)
  }
  const handleMinutesChange = (value: string) => {
    setMinutes(value)
    if (durationError) setDurationError(null)
  }

  if (!isOpen) return null

  return (
    <DrawerPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Log time"
      footer={
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!hours && !minutes} variant="default" className="flex-1">
            Log time
          </Button>
        </div>
      }
    >
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div>
          <h3 className="font-medium text-foreground mb-4">Type of time</h3>
          <RadioGroup value={timeType} onValueChange={(value) => setTimeType(value as "together" | "solo")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="together" id="together" />
              <Label htmlFor="together" className="text-sm text-muted-foreground">
                Together - Time spent actively working with the user
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="solo" id="solo" />
              <Label htmlFor="solo" className="text-sm text-muted-foreground">
                Solo - Time spent researching or preparing solutions
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div>
          <h3 className="font-medium text-foreground mb-4">Duration</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1">
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
                  className="border-input"
                />
              </FormField>
            </div>
            <div className="flex-1">
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
                  className="border-input"
                />
              </FormField>
            </div>
          </div>
          {durationError && (
            <p id="duration-error" role="alert" className="mt-2 text-sm text-destructive">
              {durationError}
            </p>
          )}
        </div>

        <div>
          <FormField label="Note (optional)" id="note">
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about what you worked on..."
              className="border-input min-h-[80px] resize-none"
            />
          </FormField>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 border border-border">
          <h4 className="font-medium text-foreground mb-2">Time tracking</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Log time as you work on the ticket. Together time is billed at the full rate, while solo time may be billed
            at a reduced rate depending on the SLA agreement.
          </p>
        </div>
      </div>
    </DrawerPanel>
  )
}
