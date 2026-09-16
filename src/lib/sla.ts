/**
 * Pure helpers shared by every SLA surface (admin, helper, customer).
 * No API calls here — only mapping, labelling and arithmetic.
 */
import type { Database } from "@/types/database"

export type SlaRow = Database["public"]["Tables"]["slas"]["Row"]
export type SlaInsert = Database["public"]["Tables"]["slas"]["Insert"]
export type SlaUpdate = Database["public"]["Tables"]["slas"]["Update"]
export type SlaBillingPeriodRow = Database["public"]["Tables"]["sla_billing_periods"]["Row"]
export type SlaStatus = SlaRow["status"]
export type SlaPaymentFrequency = SlaRow["payment_frequency"]

/** Admin list tabs collapse the DB enum: inactive+expired+cancelled read as "not active". */
export type SlaStatusTab = "active" | "inactive" | "ended"

export const SLA_STATUS_LABELS: Record<SlaStatus, string> = {
    active: "Active",
    inactive: "Payment pending",
    expired: "Expired",
    cancelled: "Cancelled",
}

export const SLA_STATUS_BADGE_CLASS: Record<SlaStatus, string> = {
    active: "bg-green-100 text-green-800 hover:bg-green-100",
    inactive: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    expired: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    cancelled: "bg-red-100 text-red-800 hover:bg-red-100",
}

export function slaStatusTab(status: SlaStatus): SlaStatusTab {
    if (status === "active") return "active"
    if (status === "inactive") return "inactive"
    return "ended"
}

export const SLA_FREQUENCY_OPTIONS: Array<{ value: SlaPaymentFrequency; label: string; perLabel: string }> = [
    { value: "monthly", label: "Monthly", perLabel: "per month" },
    { value: "quarterly", label: "Quarterly", perLabel: "per quarter" },
    { value: "halfyear", label: "Every 6 months", perLabel: "per half year" },
    { value: "yearly", label: "Yearly", perLabel: "per year" },
]

export function frequencyLabel(frequency: SlaPaymentFrequency | null | undefined): string {
    const match = SLA_FREQUENCY_OPTIONS.find((o) => o.value === frequency)
    if (match) return match.label
    if (frequency === "weekly") return "Weekly"
    if (frequency === "daily") return "Daily"
    return "Monthly"
}

export function frequencyPerLabel(frequency: SlaPaymentFrequency | null | undefined): string {
    const match = SLA_FREQUENCY_OPTIONS.find((o) => o.value === frequency)
    if (match) return match.perLabel
    if (frequency === "weekly") return "per week"
    if (frequency === "daily") return "per day"
    return "per month"
}

/** "USD 12.34" from the smallest unit; currency codes are stored lowercase. */
export function formatSlaAmount(smallestUnit: number, currency: string | null | undefined): string {
    const code = (currency || "usd").toUpperCase()
    return `${code} ${(smallestUnit / 100).toFixed(2)}`
}

/** "12h 30m", "45m" or "0m" for a minute count. */
export function formatSlaMinutes(minutes: number): string {
    const total = Math.max(0, Math.round(minutes))
    const hours = Math.floor(total / 60)
    const rest = total % 60
    if (hours === 0) return `${rest}m`
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "12 Sep 2026" — locale-independent so labels match across browsers and tests. */
function formatDayMonthYear(date: Date): string {
    return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** "12 Sep 2026" for a YYYY-MM-DD or ISO date; "—" when missing. */
export function formatSlaDate(value: string | null | undefined): string {
    if (!value) return "—"
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return formatDayMonthYear(date)
}

/** Whether an SLA covers new work today (mirrors the backend rule). */
export function isSlaCovering(sla: Pick<SlaRow, "status" | "end_date" | "deleted_at">, todayIso?: string): boolean {
    if (sla.deleted_at) return false
    if (sla.status !== "active") return false
    if (sla.end_date) {
        const today = (todayIso ?? new Date().toISOString()).slice(0, 10)
        if (sla.end_date < today) return false
    }
    return true
}

export interface SlaPeriodUsage {
    minutesIncluded: number
    minutesRolledOver: number
    minutesConsumed: number
    minutesAvailable: number
    minutesRemaining: number
    overageMinutes: number
    /** 0–100, consumed as a share of available (capped at 100). */
    percentUsed: number
}

export function computePeriodUsage(
    period: Pick<SlaBillingPeriodRow, "minutes_included" | "minutes_consumed" | "minutes_rolled_over">,
): SlaPeriodUsage {
    const available = period.minutes_included + period.minutes_rolled_over
    const remaining = Math.max(0, available - period.minutes_consumed)
    const overage = Math.max(0, period.minutes_consumed - available)
    const percent = available > 0 ? Math.min(100, Math.round((period.minutes_consumed / available) * 100)) : period.minutes_consumed > 0 ? 100 : 0
    return {
        minutesIncluded: period.minutes_included,
        minutesRolledOver: period.minutes_rolled_over,
        minutesConsumed: period.minutes_consumed,
        minutesAvailable: available,
        minutesRemaining: remaining,
        overageMinutes: overage,
        percentUsed: percent,
    }
}

/** "September 2026" style label for a period row, from its start date. */
export function periodLabel(period: Pick<SlaBillingPeriodRow, "period_start" | "period_end">, frequency?: SlaPaymentFrequency | null): string {
    const start = formatSlaDate(period.period_start)
    if (frequency === "monthly" || !frequency) {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(period.period_start)
        if (m) {
            const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
            return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
        }
    }
    // period_end is exclusive; show the last inclusive day.
    const endMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(period.period_end)
    let endLabel = formatSlaDate(period.period_end)
    if (endMatch) {
        const d = new Date(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3]) - 1)
        endLabel = formatDayMonthYear(d)
    }
    return `${start} – ${endLabel}`
}

/* ---------------------------------------------------------------------------
 * Create / edit form ↔ row mapping
 * ------------------------------------------------------------------------- */

export interface SlaFormValues {
    name: string
    contactName: string
    contactEmail: string
    /** "unlimited" hides the minutes field and stores 0 minutes + no overage. */
    supportLimitation: "limited" | "unlimited"
    /** Hours included per period, as typed (e.g. "10" or "7.5"). */
    hoursIncluded: string
    minutesRollover: boolean
    /** Major units as typed, e.g. "499.00". */
    subscriptionAmount: string
    paymentFrequency: SlaPaymentFrequency
    /** Overage pricing, major units as typed. */
    ticketStartPrice: string
    pricePerMinuteFirst60: string
    pricePerMinuteAfter60: string
    /** Hours as typed; stored as minutes. Empty = not set. */
    maxResponseTimeHours: string
    /** Hours as typed; stored as `max_downtime` (integer hours). Empty = not set. */
    maxDowntimeHours: string
    startDate: string
    endDate: string
}

export const EMPTY_SLA_FORM: SlaFormValues = {
    name: "",
    contactName: "",
    contactEmail: "",
    supportLimitation: "limited",
    hoursIncluded: "",
    minutesRollover: false,
    subscriptionAmount: "",
    paymentFrequency: "monthly",
    ticketStartPrice: "",
    pricePerMinuteFirst60: "",
    pricePerMinuteAfter60: "",
    maxResponseTimeHours: "",
    maxDowntimeHours: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
}

/** Parse "12.34", "12,34", " 12 " → 1234 smallest units; null when not a number. */
export function parseMoneyToSmallestUnit(input: string): number | null {
    const cleaned = input.replace(/[^0-9.,-]/g, "").replace(",", ".")
    if (cleaned === "" || cleaned === "." || cleaned === "-") return null
    const value = Number(cleaned)
    if (!Number.isFinite(value) || value < 0) return null
    return Math.round(value * 100)
}

/** Parse "7.5" hours → 450 minutes; null when not a number. */
export function parseHoursToMinutes(input: string): number | null {
    const cleaned = input.replace(/[^0-9.,]/g, "").replace(",", ".")
    if (cleaned === "" || cleaned === ".") return null
    const value = Number(cleaned)
    if (!Number.isFinite(value) || value < 0) return null
    return Math.round(value * 60)
}

export interface SlaFormErrors {
    name?: string
    contactEmail?: string
    hoursIncluded?: string
    subscriptionAmount?: string
    pricePerMinuteFirst60?: string
    pricePerMinuteAfter60?: string
    ticketStartPrice?: string
    maxResponseTimeHours?: string
    maxDowntimeHours?: string
    startDate?: string
    endDate?: string
}

export function validateSlaForm(values: SlaFormValues): SlaFormErrors {
    const errors: SlaFormErrors = {}
    if (!values.name.trim()) errors.name = "Give the agreement a name"
    if (values.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim())) {
        errors.contactEmail = "Enter a valid email address"
    }
    if (values.supportLimitation === "limited") {
        const minutes = parseHoursToMinutes(values.hoursIncluded)
        if (minutes === null || minutes <= 0) errors.hoursIncluded = "Enter the hours included per period"
        if (values.pricePerMinuteFirst60.trim() && parseMoneyToSmallestUnit(values.pricePerMinuteFirst60) === null) {
            errors.pricePerMinuteFirst60 = "Enter an amount like 1.50"
        }
        if (values.pricePerMinuteAfter60.trim() && parseMoneyToSmallestUnit(values.pricePerMinuteAfter60) === null) {
            errors.pricePerMinuteAfter60 = "Enter an amount like 1.00"
        }
        if (values.ticketStartPrice.trim() && parseMoneyToSmallestUnit(values.ticketStartPrice) === null) {
            errors.ticketStartPrice = "Enter an amount like 10.00"
        }
    }
    if (parseMoneyToSmallestUnit(values.subscriptionAmount) === null) {
        errors.subscriptionAmount = "Enter the subscription price, e.g. 499.00"
    }
    if (values.maxResponseTimeHours.trim() && parseHoursToMinutes(values.maxResponseTimeHours) === null) {
        errors.maxResponseTimeHours = "Enter hours, e.g. 4"
    }
    if (values.maxDowntimeHours.trim() && parseHoursToMinutes(values.maxDowntimeHours) === null) {
        errors.maxDowntimeHours = "Enter hours, e.g. 8"
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.startDate)) errors.startDate = "Pick a start date"
    if (values.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.endDate)) errors.endDate = "Pick a valid end date"
    if (values.endDate && values.startDate && values.endDate < values.startDate) {
        errors.endDate = "End date must be after the start date"
    }
    return errors
}

/** Build the insert/update payload from validated form values. */
export function slaFormToRow(values: SlaFormValues, projectId: string): SlaInsert {
    const limited = values.supportLimitation === "limited"
    const minutesIncluded = limited ? parseHoursToMinutes(values.hoursIncluded) ?? 0 : 0
    const maxResponse = values.maxResponseTimeHours.trim() ? parseHoursToMinutes(values.maxResponseTimeHours) : null
    const maxDowntimeMinutes = values.maxDowntimeHours.trim() ? parseHoursToMinutes(values.maxDowntimeHours) : null
    return {
        project_id: projectId,
        name: values.name.trim(),
        contact_name: values.contactName.trim() || null,
        contact_email: values.contactEmail.trim() || null,
        // 0 minutes + no overage pricing is how "unlimited" is represented; the
        // backend never bills overage when the per-minute price is 0.
        minutes_included: minutesIncluded,
        minutes_rollover: limited ? values.minutesRollover : false,
        subscription_amount_smallest_unit: parseMoneyToSmallestUnit(values.subscriptionAmount) ?? 0,
        currency: "usd",
        payment_frequency: values.paymentFrequency,
        time_period: values.paymentFrequency,
        ticket_start_price: limited ? parseMoneyToSmallestUnit(values.ticketStartPrice) ?? 0 : 0,
        ticket_price_minute_first_60: limited ? parseMoneyToSmallestUnit(values.pricePerMinuteFirst60) ?? 0 : 0,
        ticket_price_minute_after_60: limited ? parseMoneyToSmallestUnit(values.pricePerMinuteAfter60) ?? 0 : 0,
        max_response_time_minutes: maxResponse,
        // Stored as hours (smallint) — the column predates minute precision.
        max_downtime: maxDowntimeMinutes === null ? null : Math.round(maxDowntimeMinutes / 60),
        start_date: values.startDate,
        end_date: values.endDate || null,
    }
}

/** Populate the form from an existing row (for editing). */
export function slaRowToForm(row: SlaRow): SlaFormValues {
    const unlimited = row.minutes_included === 0 && row.ticket_price_minute_first_60 === 0 && row.ticket_price_minute_after_60 === 0 && row.ticket_start_price === 0
    const money = (v: number) => (v > 0 ? (v / 100).toFixed(2) : "")
    return {
        name: row.name ?? "",
        contactName: row.contact_name ?? "",
        contactEmail: row.contact_email ?? "",
        supportLimitation: unlimited ? "unlimited" : "limited",
        hoursIncluded: row.minutes_included > 0 ? String(Math.round((row.minutes_included / 60) * 100) / 100) : "",
        minutesRollover: row.minutes_rollover,
        subscriptionAmount: (row.subscription_amount_smallest_unit / 100).toFixed(2),
        paymentFrequency: row.payment_frequency,
        ticketStartPrice: money(row.ticket_start_price),
        pricePerMinuteFirst60: money(row.ticket_price_minute_first_60),
        pricePerMinuteAfter60: money(row.ticket_price_minute_after_60),
        maxResponseTimeHours: row.max_response_time_minutes != null ? String(Math.round((row.max_response_time_minutes / 60) * 100) / 100) : "",
        maxDowntimeHours: row.max_downtime != null ? String(row.max_downtime) : "",
        startDate: row.start_date ?? new Date().toISOString().slice(0, 10),
        endDate: row.end_date ?? "",
    }
}

/** True when the SLA has no included-minute limit (see slaFormToRow). */
export function isUnlimitedSla(row: Pick<SlaRow, "minutes_included" | "ticket_price_minute_first_60" | "ticket_price_minute_after_60" | "ticket_start_price">): boolean {
    return row.minutes_included === 0 && row.ticket_price_minute_first_60 === 0 && row.ticket_price_minute_after_60 === 0 && row.ticket_start_price === 0
}

/** "ABCD-1234-EFGH" from any spacing/casing; null when not 12 characters. */
export function normalizeSlaAccessCode(raw: string): string | null {
    const compact = raw.replace(/[^0-9a-z]/gi, "").toUpperCase()
    if (compact.length !== 12) return null
    return `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}`
}
