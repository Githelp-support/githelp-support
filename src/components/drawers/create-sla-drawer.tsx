"use client"

import { useState } from "react"
import { toast } from "sonner"
import { DrawerPanel } from "@/components/ui/drawer-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/ui/form-field"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateSLA, useUpdateSLA } from "@/hooks/useSLAs"
import {
  EMPTY_SLA_FORM,
  SLA_FREQUENCY_OPTIONS,
  frequencyPerLabel,
  slaFormToRow,
  slaRowToForm,
  validateSlaForm,
  type SlaFormErrors,
  type SlaFormValues,
  type SlaPaymentFrequency,
  type SlaRow,
} from "@/lib/sla"
import { cn } from "@/lib/utils"

interface CreateSLADrawerProps {
  isOpen: boolean
  onClose: () => void
  /** Project the agreement belongs to (create mode). */
  projectId?: string
  /** When set, the drawer edits this SLA instead of creating a new one. */
  sla?: SlaRow | null
  /** Called with the saved row after a successful create or update. */
  onSaved?: (sla: SlaRow, mode: "create" | "edit") => void
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="pt-2">
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}

function ToggleCard({
  selected,
  onSelect,
  title,
  description,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex-1 rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer",
        selected ? "border-brand-primary bg-brand-primary/5" : "border-border hover:bg-muted/40",
      )}
    >
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
    </button>
  )
}

/**
 * Create or edit a Service Level Agreement. Form values are plain strings
 * (money in major units, time in hours) and are mapped to the `slas` row
 * shape by `slaFormToRow`; edit mode is seeded from `slaRowToForm`.
 */
export function CreateSLADrawer({ isOpen, onClose, projectId, sla, onSaved }: CreateSLADrawerProps) {
  // The body mounts fresh every time the drawer opens (and per SLA being
  // edited), so form state is seeded once in useState instead of an effect.
  if (!isOpen) return null
  return (
    <SlaDrawerBody
      key={sla?.id ?? "new"}
      onClose={onClose}
      projectId={projectId}
      sla={sla ?? null}
      onSaved={onSaved}
    />
  )
}

function SlaDrawerBody({
  onClose,
  projectId,
  sla,
  onSaved,
}: {
  onClose: () => void
  projectId?: string
  sla: SlaRow | null
  onSaved?: (sla: SlaRow, mode: "create" | "edit") => void
}) {
  const isEdit = !!sla
  const [values, setValues] = useState<SlaFormValues>(() =>
    sla ? slaRowToForm(sla) : { ...EMPTY_SLA_FORM, startDate: new Date().toISOString().slice(0, 10) },
  )
  const [errors, setErrors] = useState<SlaFormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const createSla = useCreateSLA()
  const updateSla = useUpdateSLA()
  const saving = createSla.isPending || updateSla.isPending

  const set = <K extends keyof SlaFormValues>(field: K, value: SlaFormValues[K]) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value }
      if (submitted) setErrors(validateSlaForm(next))
      return next
    })
  }

  const handleSubmit = async () => {
    setSubmitted(true)
    const nextErrors = validateSlaForm(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const targetProjectId = sla?.project_id ?? projectId
    if (!targetProjectId) {
      toast.error("Select a project before creating an SLA")
      return
    }

    const row = slaFormToRow(values, targetProjectId)
    try {
      if (isEdit && sla) {
        const { project_id: _projectId, ...updates } = row
        const saved = await updateSla.mutateAsync({ id: sla.id, updates })
        toast.success("Agreement updated")
        onSaved?.(saved, "edit")
      } else {
        const saved = await createSla.mutateAsync(row)
        toast.success("Agreement created")
        onSaved?.(saved, "create")
      }
      onClose()
    } catch (e) {
      console.error("Failed to save SLA", e)
      toast.error(e instanceof Error ? e.message : "Could not save the agreement")
    }
  }

  const limited = values.supportLimitation === "limited"
  const perLabel = frequencyPerLabel(values.paymentFrequency)

  return (
    <DrawerPanel
      isOpen
      onClose={onClose}
      title={isEdit ? "Edit agreement" : "Create new SLA"}
      width="w-[520px]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="lavender" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create SLA"}
          </Button>
        </div>
      }
    >
      <form
        className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
      >
        <SectionTitle hint="Who the agreement is with and when it runs.">Agreement</SectionTitle>

        <FormField label="Agreement name" id="sla-name" hint={errors.name} error={!!errors.name}>
          <Input
            id="sla-name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Acme Corp — Gold support"
            aria-invalid={!!errors.name}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Main contact" id="sla-contact-name">
            <Input
              id="sla-contact-name"
              value={values.contactName}
              onChange={(e) => set("contactName", e.target.value)}
              placeholder="Jane Doe"
            />
          </FormField>
          <FormField label="Contact email" id="sla-contact-email" hint={errors.contactEmail} error={!!errors.contactEmail}>
            <Input
              id="sla-contact-email"
              type="email"
              value={values.contactEmail}
              onChange={(e) => set("contactEmail", e.target.value)}
              placeholder="jane@acme.example"
              aria-invalid={!!errors.contactEmail}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start date" id="sla-start" hint={errors.startDate} error={!!errors.startDate}>
            <Input
              id="sla-start"
              type="date"
              value={values.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              aria-invalid={!!errors.startDate}
            />
          </FormField>
          <FormField label="End date" id="sla-end" hint={errors.endDate ?? "Leave empty for an open-ended agreement."} error={!!errors.endDate}>
            <Input
              id="sla-end"
              type="date"
              value={values.endDate}
              onChange={(e) => set("endDate", e.target.value)}
              aria-invalid={!!errors.endDate}
            />
          </FormField>
        </div>

        <SectionTitle hint="How much helper time the subscription includes each billing period.">Support included</SectionTitle>

        <div className="flex gap-3">
          <ToggleCard
            selected={limited}
            onSelect={() => set("supportLimitation", "limited")}
            title="Limited"
            description="A fixed number of hours per period; extra time is billed as overage."
          />
          <ToggleCard
            selected={!limited}
            onSelect={() => set("supportLimitation", "unlimited")}
            title="Unlimited"
            description="No cap on hours; nothing is billed beyond the subscription."
          />
        </div>

        {limited && (
          <>
            <FormField
              label={`Hours included ${perLabel}`}
              id="sla-hours"
              hint={errors.hoursIncluded ?? "Decimals are fine, e.g. 7.5"}
              error={!!errors.hoursIncluded}
            >
              <Input
                id="sla-hours"
                inputMode="decimal"
                value={values.hoursIncluded}
                onChange={(e) => set("hoursIncluded", e.target.value)}
                placeholder="10"
                aria-invalid={!!errors.hoursIncluded}
              />
            </FormField>
            <label className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 cursor-pointer">
              <div>
                <div className="text-sm font-medium text-foreground">Roll over unused hours</div>
                <div className="text-xs text-muted-foreground">Unused time carries into the next period.</div>
              </div>
              <Switch checked={values.minutesRollover} onCheckedChange={(checked) => set("minutesRollover", checked)} />
            </label>
          </>
        )}

        <SectionTitle hint="Charged automatically to the customer's saved card through Stripe.">Subscription</SectionTitle>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Price" id="sla-price" hint={errors.subscriptionAmount} error={!!errors.subscriptionAmount}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">USD</span>
              <Input
                id="sla-price"
                inputMode="decimal"
                className="pl-12"
                value={values.subscriptionAmount}
                onChange={(e) => set("subscriptionAmount", e.target.value)}
                placeholder="499.00"
                aria-invalid={!!errors.subscriptionAmount}
              />
            </div>
          </FormField>
          <FormField label="Billed" id="sla-frequency">
            <Select value={values.paymentFrequency} onValueChange={(v) => set("paymentFrequency", v as SlaPaymentFrequency)}>
              <SelectTrigger id="sla-frequency" className="w-full">
                <SelectValue placeholder="Choose frequency" />
              </SelectTrigger>
              <SelectContent>
                {SLA_FREQUENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        {limited && (
          <>
            <SectionTitle hint="Applied to minutes beyond the included hours. Leave empty for no overage charge.">Overage pricing</SectionTitle>
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Start price" id="sla-start-price" hint={errors.ticketStartPrice} error={!!errors.ticketStartPrice}>
                <Input
                  id="sla-start-price"
                  inputMode="decimal"
                  value={values.ticketStartPrice}
                  onChange={(e) => set("ticketStartPrice", e.target.value)}
                  placeholder="0.00"
                  aria-invalid={!!errors.ticketStartPrice}
                />
              </FormField>
              <FormField label="Per min, first 60" id="sla-first60" hint={errors.pricePerMinuteFirst60} error={!!errors.pricePerMinuteFirst60}>
                <Input
                  id="sla-first60"
                  inputMode="decimal"
                  value={values.pricePerMinuteFirst60}
                  onChange={(e) => set("pricePerMinuteFirst60", e.target.value)}
                  placeholder="1.50"
                  aria-invalid={!!errors.pricePerMinuteFirst60}
                />
              </FormField>
              <FormField label="Per min, after 60" id="sla-after60" hint={errors.pricePerMinuteAfter60} error={!!errors.pricePerMinuteAfter60}>
                <Input
                  id="sla-after60"
                  inputMode="decimal"
                  value={values.pricePerMinuteAfter60}
                  onChange={(e) => set("pricePerMinuteAfter60", e.target.value)}
                  placeholder="1.00"
                  aria-invalid={!!errors.pricePerMinuteAfter60}
                />
              </FormField>
            </div>
          </>
        )}

        <SectionTitle hint="Shown to the customer as the guarantees of this agreement.">Response guarantees</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Max response time (hours)" id="sla-response" hint={errors.maxResponseTimeHours} error={!!errors.maxResponseTimeHours}>
            <Input
              id="sla-response"
              inputMode="decimal"
              value={values.maxResponseTimeHours}
              onChange={(e) => set("maxResponseTimeHours", e.target.value)}
              placeholder="4"
              aria-invalid={!!errors.maxResponseTimeHours}
            />
          </FormField>
          <FormField label="Max downtime (hours)" id="sla-downtime" hint={errors.maxDowntimeHours} error={!!errors.maxDowntimeHours}>
            <Input
              id="sla-downtime"
              inputMode="decimal"
              value={values.maxDowntimeHours}
              onChange={(e) => set("maxDowntimeHours", e.target.value)}
              placeholder="8"
              aria-invalid={!!errors.maxDowntimeHours}
            />
          </FormField>
        </div>
        {/* Keeps Enter-to-submit working without a visible button in the form body. */}
        <button type="submit" className="hidden" aria-hidden />
      </form>
    </DrawerPanel>
  )
}
