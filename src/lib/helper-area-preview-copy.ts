/**
 * Shared copy and static preview data for helper Support / Reports empty states.
 * Preview UI only; no API calls or DB writes.
 */

export const SUPPORT_TICKETS_PREVIEW_DISCLAIMER =
    "There are no real tickets in this project yet. The cards below are a preview of how available tickets will look."

export const REPORTS_PAYOUTS_PREVIEW_DISCLAIMER =
    "You have no payouts yet. You are currently seeing a preview of what this page will look like once you have completed your first tickets."

export const REPORTS_MONTHLY_PREVIEW_DISCLAIMER =
    "Monthly aggregates are not available yet. The figures below are placeholders for preview only."

export type SupportTicketPreviewCard = {
    id: string
    title: string
    customer: string
    avatar: string
    description: string
    topics: string[]
    helpType: string
    timestamp: string
}

export const SUPPORT_TICKET_PREVIEW_CARDS: SupportTicketPreviewCard[] = [
    {
        id: "preview-support-1",
        title: "Dashboard sidebar collapses on navigation",
        customer: "Preview Customer",
        avatar: "P",
        description:
            "When switching between Analytics and Settings, the sidebar sometimes collapses unexpectedly. Steps to reproduce are attached in the full ticket.",
        topics: ["Bug", "UI"],
        helpType: "default",
        timestamp: "10.05.2026, 09:00",
    },
    {
        id: "preview-support-2",
        title: "Question about webhook retry policy",
        customer: "Preview Customer",
        avatar: "P",
        description:
            "We need clarification on how many times failed webhooks are retried and whether exponential backoff applies.",
        topics: ["Question", "API"],
        helpType: "default",
        timestamp: "09.05.2026, 14:30",
    },
    {
        id: "preview-support-3",
        title: "Feature request: export tickets to CSV",
        customer: "Preview Customer",
        avatar: "P",
        description:
            "Support managers would like a one-click export of filtered tickets for weekly reporting.",
        topics: ["General"],
        helpType: "default",
        timestamp: "08.05.2026, 11:15",
    },
]

export type PayoutPreviewRow = {
    id: string
    ticketId: string
    date: string
    ticketType: string
    amount: string
    status: "pending" | "completed"
}

export const PAYOUT_PREVIEW_ROWS: PayoutPreviewRow[] = [
    {
        id: "preview-payout-1",
        ticketId: "a1b2c3d",
        date: "01/05/2026",
        ticketType: "Bug",
        amount: "USD 42.00",
        status: "completed",
    },
    {
        id: "preview-payout-2",
        ticketId: "e4f5g6h",
        date: "28/04/2026",
        ticketType: "Question",
        amount: "USD 18.50",
        status: "pending",
    },
    {
        id: "preview-payout-3",
        ticketId: "i7j8k9l",
        date: "15/04/2026",
        ticketType: "General",
        amount: "USD 120.00",
        status: "completed",
    },
    {
        id: "preview-payout-4",
        ticketId: "m0n1o2p",
        date: "02/04/2026",
        ticketType: "Bug",
        amount: "USD 65.25",
        status: "pending",
    },
]

export const MONTHLY_PREVIEW_STATS: { label: string; value: string }[] = [
    { label: "Tickets closed (preview)", value: "—" },
    { label: "Hours logged (preview)", value: "—" },
    { label: "Earnings (preview)", value: "—" },
]

/* ---------------------------------------------------------------------------
 * End-user ("User" role) Reports page — shown only while the customer has no
 * tickets/payments yet. Once real rows exist the preview is never rendered.
 * ------------------------------------------------------------------------- */

export const USER_REPORTS_PREVIEW_DISCLAIMER =
    "You have no tickets yet. You are currently seeing a preview of what this page will look like once you have your first tickets and payments."

export type UserPaymentPreviewRow = {
    id: string
    ticketShortId: string
    ticketTitle: string
    projectName: string
    date: string
    ticketType: string
    amount: string
    status: "Paid" | "On hold" | "Pending"
}

export const USER_PAYMENT_PREVIEW_ROWS: UserPaymentPreviewRow[] = [
    {
        id: "preview-user-payment-1",
        ticketShortId: "a1b2c3d",
        ticketTitle: "Login page throws 500 after password reset",
        projectName: "Preview Project",
        date: "01/05/2026",
        ticketType: "Bug",
        amount: "USD 42.00",
        status: "Paid",
    },
    {
        id: "preview-user-payment-2",
        ticketShortId: "e4f5g6h",
        ticketTitle: "How do webhooks retry on failure?",
        projectName: "Preview Project",
        date: "28/04/2026",
        ticketType: "Question",
        amount: "USD 18.50",
        status: "On hold",
    },
    {
        id: "preview-user-payment-3",
        ticketShortId: "i7j8k9l",
        ticketTitle: "Export tickets to CSV",
        projectName: "Preview Project",
        date: "15/04/2026",
        ticketType: "General",
        amount: "USD 120.00",
        status: "Paid",
    },
]

export type UserMonthlyPreviewRow = {
    id: string
    period: string
    ticketCount: number
    amount: string
}

export const USER_MONTHLY_PREVIEW_ROWS: UserMonthlyPreviewRow[] = [
    { id: "preview-user-month-1", period: "May 2026", ticketCount: 1, amount: "USD 42.00" },
    { id: "preview-user-month-2", period: "April 2026", ticketCount: 2, amount: "USD 138.50" },
]

export type HelperMonthlyPreviewRow = {
    id: string
    period: string
    description: string
    earnings: string
    status: "Paid out" | "Pending"
}

export const HELPER_MONTHLY_PREVIEW_ROWS: HelperMonthlyPreviewRow[] = [
    {
        id: "preview-helper-month-1",
        period: "May 2026",
        description: "1 ticket · Total time logged: 1h 10m",
        earnings: "USD 42.00",
        status: "Pending",
    },
    {
        id: "preview-helper-month-2",
        period: "April 2026",
        description: "3 tickets · Total time logged: 4h 35m",
        earnings: "USD 203.75",
        status: "Paid out",
    },
]
