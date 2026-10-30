"use client"

import { CalendarClock } from "lucide-react"
import { Header } from "@/components/layout/header"

/**
 * Helper availability settings. Nothing in the backend reads availability yet
 * (no table, no effect on notifications or claiming), so instead of controls
 * that look like they persist, the page says so plainly.
 */
export default function HelperSettingsPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Settings" subtitle="Helper settings" />

      <main className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-3xl divide-y divide-border-subtle">
          <div className="max-w-2xl">
            <div className="bg-background rounded-lg p-6">
              <div className="flex items-start gap-3">
                <CalendarClock className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">Availability settings are coming soon</h2>
                  <p className="text-sm text-muted-foreground">
                    You will be able to mark yourself unavailable and set working hours here. Until then, every active
                    helper is notified about new tickets and can claim them.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
