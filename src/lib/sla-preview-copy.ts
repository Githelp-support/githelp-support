/**
 * Static preview data for the admin SLA list empty state.
 * Preview UI only; no API calls or DB writes.
 */

export const SLAS_PREVIEW_DISCLAIMER =
    "You have no SLAs yet. You are currently seeing a preview of what this page will look like once you create your first agreement."

export type SlaPreviewRow = {
    id: string
    name: string
    contact: string
    includedTime: string
    price: string
    customer: string
    status: "Active" | "Payment pending"
    accessCode: string
    created: string
}

export const SLA_PREVIEW_ROWS: SlaPreviewRow[] = [
    {
        id: "preview-sla-1",
        name: "Acme Corp — Gold support",
        contact: "jane@acme.example",
        includedTime: "20h per month",
        price: "USD 1,499.00 per month",
        customer: "Linked",
        status: "Active",
        accessCode: "A1B2-C3D4-E5F6",
        created: "1 May 2026",
    },
    {
        id: "preview-sla-2",
        name: "Northwind — Standard",
        contact: "ops@northwind.example",
        includedTime: "5h per month",
        price: "USD 399.00 per month",
        customer: "Awaiting customer",
        status: "Payment pending",
        accessCode: "9F8E-7D6C-5B4A",
        created: "28 Apr 2026",
    },
    {
        id: "preview-sla-3",
        name: "Globex — Enterprise",
        contact: "it@globex.example",
        includedTime: "Unlimited",
        price: "USD 12,000.00 per year",
        customer: "Linked",
        status: "Active",
        accessCode: "1122-3344-5566",
        created: "2 Apr 2026",
    },
]
