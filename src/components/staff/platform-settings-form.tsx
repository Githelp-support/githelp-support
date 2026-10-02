"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type PlatformSettings, usePlatformSettings, useUpdatePlatformSettings } from "@/hooks/useStaff"
import { dollarsToCents } from "@/components/unlisted/repo"

const centsToInput = (cents: number) => (cents / 100).toFixed(2)

/** GitHelp-wide defaults for unclaimed projects and outreach. */
export function PlatformSettingsForm() {
  const { data: settings, isLoading, error } = usePlatformSettings()
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error || !settings) return <p className="text-sm text-red-700">Could not load settings.</p>
  return <SettingsEditor settings={settings} />
}

function SettingsEditor({ settings }: { settings: PlatformSettings }) {
  const update = useUpdatePlatformSettings()
  const [form, setForm] = useState<Record<string, string>>(() => ({
    unlisted_start_price: centsToInput(settings.unlisted_start_price),
    unlisted_price_minute_first_60: centsToInput(settings.unlisted_price_minute_first_60),
    unlisted_price_minute_after_60: centsToInput(settings.unlisted_price_minute_after_60),
    unlisted_default_estimated_minutes: String(settings.unlisted_default_estimated_minutes),
    independent_helper_percentage: String(settings.independent_helper_percentage),
    outreach_threshold_requests: String(settings.outreach_threshold_requests),
    outreach_cooldown_days: String(settings.outreach_cooldown_days),
  }))

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const money: Array<keyof PlatformSettings> = ["unlisted_start_price", "unlisted_price_minute_first_60", "unlisted_price_minute_after_60"]
    const ints: Array<[keyof PlatformSettings, number, number]> = [
      ["unlisted_default_estimated_minutes", 1, 600],
      ["independent_helper_percentage", 0, 100],
      ["outreach_threshold_requests", 1, 1000],
      ["outreach_cooldown_days", 1, 365],
    ]
    const patch: Partial<PlatformSettings> = {}
    for (const key of money) {
      const cents = dollarsToCents(form[key] ?? "")
      if (cents === null || Number.isNaN(cents)) {
        toast.error("Prices must be amounts like 10 or 1.50.")
        return
      }
      patch[key] = cents
    }
    for (const [key, min, max] of ints) {
      const n = Number(form[key])
      if (!Number.isInteger(n) || n < min || n > max) {
        toast.error(`${key.replace(/_/g, " ")} must be a whole number between ${min} and ${max}.`)
        return
      }
      patch[key] = n
    }
    try {
      await update.mutateAsync(patch)
      toast.success("Settings saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings")
    }
  }

  const field = (key: string, label: string, hint?: string) => (
    <div className="space-y-1">
      <Label htmlFor={`setting-${key}`}>{label}</Label>
      <Input id={`setting-${key}`} value={form[key] ?? ""} onChange={set(key)} inputMode="decimal" className="max-w-[180px]" />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )

  return (
    <form onSubmit={save} className="space-y-5 max-w-xl">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Default pricing for unclaimed projects (USD)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {field("unlisted_start_price", "Start price")}
          {field("unlisted_price_minute_first_60", "Per minute, first hour")}
          {field("unlisted_price_minute_after_60", "Per minute, after an hour")}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Applies to new tickets on projects not yet claimed by their maintainers. Changing it doesn&apos;t affect open holds.
        </p>
      </div>
      {field("unlisted_default_estimated_minutes", "Estimated minutes for the card hold")}
      {field("independent_helper_percentage", "Independent helper share (%)", "Of each payment after Stripe's fee; GitHelp keeps the rest.")}
      {field("outreach_threshold_requests", "Requests before an invitation is queued")}
      {field("outreach_cooldown_days", "Days between invitations to the same repository")}
      <Button type="submit" variant="lavender" className="cursor-pointer" disabled={update.isPending}>
        {update.isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  )
}
