"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { DrawerPanel } from "@/components/ui/drawer-panel"
import { useState } from "react"

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
}

export function LogTimeDrawer({ isOpen, onClose, onLogTime }: LogTimeDrawerProps) {
  const [timeType, setTimeType] = useState<"together" | "solo">("together")
  const [hours, setHours] = useState("")
  const [minutes, setMinutes] = useState("")
  const [note, setNote] = useState("") // Added note state

  const handleSubmit = () => {
    const hoursNum = Number.parseInt(hours) || 0
    const minutesNum = Number.parseInt(minutes) || 0

    if (hoursNum === 0 && minutesNum === 0) {
      return
    }

    const entry: TimeEntry = {
      id: Date.now().toString(),
      type: timeType,
      date: new Date().toLocaleDateString("en-GB"),
      hours: hoursNum,
      minutes: minutesNum,
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
              <Label htmlFor="hours" className="text-sm text-muted-foreground mb-2 block">
                Hours
              </Label>
              <Input
                id="hours"
                type="number"
                min="0"
                max="23"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="border-input"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="minutes" className="text-sm text-muted-foreground mb-2 block">
                Minutes
              </Label>
              <Input
                id="minutes"
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
                className="border-input"
              />
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="note" className="text-sm text-muted-foreground mb-2 block">
            Note (optional)
          </Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note about what you worked on..."
            className="border-input min-h-[80px] resize-none"
          />
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
