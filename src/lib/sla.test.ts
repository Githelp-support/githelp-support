import { describe, expect, it } from "vitest"
import {
    computePeriodUsage,
    formatSlaAmount,
    formatSlaMinutes,
    isSlaCovering,
    isUnlimitedSla,
    normalizeSlaAccessCode,
    parseHoursToMinutes,
    parseMoneyToSmallestUnit,
    periodLabel,
    slaFormToRow,
    slaRowToForm,
    slaStatusTab,
    validateSlaForm,
    EMPTY_SLA_FORM,
    type SlaRow,
} from "./sla"

function row(overrides: Partial<SlaRow> = {}): SlaRow {
    return {
        id: "sla-1",
        created_at: "2026-09-01T00:00:00.000Z",
        project_id: "proj-1",
        organization_id: null,
        name: "Gold support",
        contact_name: "Ada",
        contact_email: "ada@example.com",
        space_id: null,
        support_limit_smallest_unit: 0,
        time_period: "monthly",
        minutes_included: 600,
        minutes_rollover: true,
        subscription_amount_smallest_unit: 49900,
        currency: "usd",
        payment_frequency: "monthly",
        ticket_start_price: 1000,
        ticket_price_minute_first_60: 150,
        ticket_price_minute_after_60: 100,
        max_response_time_minutes: 240,
        max_downtime: 8,
        status: "active",
        start_date: "2026-09-01",
        end_date: null,
        updated_at: "2026-09-01T00:00:00.000Z",
        deleted_at: null,
        access_code: "ABCD-1234-EFGH",
        stripe_subscription_id: null,
        stripe_price_id: null,
        stripe_mode: null,
        ...overrides,
    }
}

describe("parsing", () => {
    it("parses money and hours from free text", () => {
        expect(parseMoneyToSmallestUnit("499.00")).toBe(49900)
        expect(parseMoneyToSmallestUnit("USD 1,50")).toBe(150)
        expect(parseMoneyToSmallestUnit("")).toBeNull()
        expect(parseMoneyToSmallestUnit("-5")).toBeNull()
        expect(parseHoursToMinutes("7.5")).toBe(450)
        expect(parseHoursToMinutes("10 hours")).toBe(600)
        expect(parseHoursToMinutes("abc")).toBeNull()
    })

    it("normalises access codes", () => {
        expect(normalizeSlaAccessCode("abcd1234efgh")).toBe("ABCD-1234-EFGH")
        expect(normalizeSlaAccessCode(" abcd-1234 efgh ")).toBe("ABCD-1234-EFGH")
        expect(normalizeSlaAccessCode("abc")).toBeNull()
    })
})

describe("formatting", () => {
    it("formats amounts, minutes and status tabs", () => {
        expect(formatSlaAmount(49900, "usd")).toBe("USD 499.00")
        expect(formatSlaMinutes(0)).toBe("0m")
        expect(formatSlaMinutes(90)).toBe("1h 30m")
        expect(formatSlaMinutes(120)).toBe("2h")
        expect(slaStatusTab("active")).toBe("active")
        expect(slaStatusTab("inactive")).toBe("inactive")
        expect(slaStatusTab("expired")).toBe("ended")
        expect(slaStatusTab("cancelled")).toBe("ended")
    })

    it("labels monthly periods by month and others by range", () => {
        expect(periodLabel({ period_start: "2026-09-01", period_end: "2026-10-01" }, "monthly")).toBe("September 2026")
        expect(periodLabel({ period_start: "2026-07-01", period_end: "2026-10-01" }, "quarterly")).toBe("1 Jul 2026 – 30 Sep 2026")
    })
})

describe("coverage and usage", () => {
    it("covers only active, unexpired, undeleted SLAs", () => {
        expect(isSlaCovering(row(), "2026-09-16T00:00:00.000Z")).toBe(true)
        expect(isSlaCovering(row({ status: "inactive" }))).toBe(false)
        expect(isSlaCovering(row({ end_date: "2026-09-01" }), "2026-09-16T00:00:00.000Z")).toBe(false)
        expect(isSlaCovering(row({ end_date: "2026-09-16" }), "2026-09-16T00:00:00.000Z")).toBe(true)
        expect(isSlaCovering(row({ deleted_at: "2026-09-02T00:00:00.000Z" }))).toBe(false)
    })

    it("computes remaining, overage and percent", () => {
        expect(computePeriodUsage({ minutes_included: 600, minutes_rolled_over: 60, minutes_consumed: 330 })).toMatchObject({
            minutesAvailable: 660,
            minutesRemaining: 330,
            overageMinutes: 0,
            percentUsed: 50,
        })
        expect(computePeriodUsage({ minutes_included: 100, minutes_rolled_over: 0, minutes_consumed: 130 })).toMatchObject({
            minutesRemaining: 0,
            overageMinutes: 30,
            percentUsed: 100,
        })
        expect(computePeriodUsage({ minutes_included: 0, minutes_rolled_over: 0, minutes_consumed: 0 }).percentUsed).toBe(0)
    })
})

describe("form mapping", () => {
    it("validates required fields", () => {
        const errors = validateSlaForm({ ...EMPTY_SLA_FORM, name: "", hoursIncluded: "", subscriptionAmount: "" })
        expect(errors.name).toBeDefined()
        expect(errors.hoursIncluded).toBeDefined()
        expect(errors.subscriptionAmount).toBeDefined()
        expect(validateSlaForm({ ...EMPTY_SLA_FORM, name: "x", hoursIncluded: "10", subscriptionAmount: "499", contactEmail: "nope" }).contactEmail).toBeDefined()
        expect(validateSlaForm({ ...EMPTY_SLA_FORM, name: "x", hoursIncluded: "10", subscriptionAmount: "499", startDate: "2026-09-10", endDate: "2026-09-01" }).endDate).toBeDefined()
        expect(validateSlaForm({ ...EMPTY_SLA_FORM, name: "x", supportLimitation: "unlimited", subscriptionAmount: "499" })).toEqual({})
    })

    it("round-trips a row through the form", () => {
        const original = row()
        const form = slaRowToForm(original)
        expect(form.supportLimitation).toBe("limited")
        expect(form.hoursIncluded).toBe("10")
        expect(form.subscriptionAmount).toBe("499.00")
        expect(form.maxResponseTimeHours).toBe("4")
        const back = slaFormToRow(form, "proj-1")
        expect(back).toMatchObject({
            project_id: "proj-1",
            name: "Gold support",
            minutes_included: 600,
            minutes_rollover: true,
            subscription_amount_smallest_unit: 49900,
            payment_frequency: "monthly",
            ticket_start_price: 1000,
            ticket_price_minute_first_60: 150,
            ticket_price_minute_after_60: 100,
            max_response_time_minutes: 240,
            max_downtime: 8,
            start_date: "2026-09-01",
            end_date: null,
        })
    })

    it("stores unlimited SLAs as zero minutes and zero overage", () => {
        const back = slaFormToRow({ ...EMPTY_SLA_FORM, name: "Unlimited", supportLimitation: "unlimited", subscriptionAmount: "999", pricePerMinuteFirst60: "5" }, "proj-1")
        expect(back.minutes_included).toBe(0)
        expect(back.ticket_price_minute_first_60).toBe(0)
        expect(isUnlimitedSla(row({ minutes_included: 0, ticket_start_price: 0, ticket_price_minute_first_60: 0, ticket_price_minute_after_60: 0 }))).toBe(true)
        expect(isUnlimitedSla(row())).toBe(false)
    })
})
