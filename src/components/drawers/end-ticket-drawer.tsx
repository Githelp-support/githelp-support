"use client"

import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { DrawerPanel } from "@/components/ui/drawer-panel"
import { Info } from "lucide-react"
import { useState } from "react"
import type { TimeEntry } from "./log-time-drawer"

interface EndTicketDrawerProps {
  isOpen: boolean
  onClose: () => void
  onEndTicket: (outcome: string) => void
  timeEntries?: TimeEntry[]
}

export function EndTicketDrawer({ isOpen, onClose, onEndTicket, timeEntries = [] }: EndTicketDrawerProps) {
  const [supportOutcome, setSupportOutcome] = useState("")

  const formatTimeEntry = (entry: TimeEntry) => {
    return {
      type: entry.type === "together" ? "Together" : "Solo",
      date: entry.date,
      hours: `${String(entry.hours).padStart(2, "0")}:${String(entry.minutes).padStart(2, "0")} h`,
    }
  }

  const getTotalTime = () => {
    const totalMinutes = timeEntries.reduce((acc, entry) => {
      return acc + entry.hours * 60 + entry.minutes
    }, 0)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} h`
  }

  const handleEndTicket = () => {
    onEndTicket(supportOutcome)
    onClose()
  }

  if (!isOpen) return null

  return (
    <DrawerPanel
      isOpen={isOpen}
      onClose={onClose}
      title="End ticket"
      footer={
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleEndTicket} disabled={!supportOutcome} variant="default" className="flex-1">
            End ticket
          </Button>
        </div>
      }
    >
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div>
          <h3 className="font-medium text-foreground mb-4">How did the support go?</h3>
          <RadioGroup value={supportOutcome} onValueChange={setSupportOutcome}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="able-to-help" id="able-to-help" />
              <Label htmlFor="able-to-help" className="text-sm text-muted-foreground">
                Was able to help
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="not-able-to-help" id="not-able-to-help" />
              <Label htmlFor="not-able-to-help" className="text-sm text-muted-foreground flex items-center gap-2">
                Was not able to help
                <Info className="w-4 h-4 text-muted-foreground" />
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div>
          <h3 className="font-medium text-foreground mb-4">Logged time</h3>
          {timeEntries.length > 0 ? (
            <div className="space-y-3">
              {timeEntries.map((entry) => {
                const formatted = formatTimeEntry(entry)
                return (
                  <div key={entry.id} className="py-2 border-b border-border">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">{formatted.type === "Together" ? "T" : "S"}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{formatted.type}</p>
                          <p className="text-xs text-muted-foreground">{formatted.date}</p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatted.hours}</span>
                    </div>
                    {entry.note && <p className="text-xs text-muted-foreground mt-1 ml-11">{entry.note}</p>}
                  </div>
                )
              })}
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Total time</span>
                <span className="text-sm font-medium text-foreground">{getTotalTime()}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No time logged yet</p>
          )}
        </div>

        <div className="bg-muted/50 rounded-lg p-4 border border-border">
          <h4 className="font-medium text-foreground mb-2">Completed support</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If the support was completed successfully, log the time spent. If you were not able to help, consider
            adjusting any time spent, in accordance with the user&apos;s expectations and actual delivery.
          </p>
        </div>
      </div>
    </DrawerPanel>
  )
}
