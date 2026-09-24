"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Download, ExternalLink } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatAmount, usePaymentTransfer, type PaymentTransfer } from "@/hooks/usePayments"
import { buildPayoutStatement } from "@/lib/helper-payout-reports"

const STATUS_BADGE_CLASS: Record<PaymentTransfer["status"], string> = {
  completed: "bg-green-100 text-green-800 hover:bg-green-100",
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  failed: "bg-red-100 text-red-800 hover:bg-red-100",
}

// "12 August 2026" — long form for a document people file away.
const formatLongDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

function Field({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-sm break-all text-gray-900" : "text-sm text-gray-900 break-words"}>
        {value || "—"}
      </dd>
    </div>
  )
}

/**
 * Printable payout statement: the helper's proof of payment for one payout.
 * "Download PDF" uses the browser's print dialog, where "Save as PDF" is
 * available everywhere; the app chrome is hidden via `print:` variants.
 */
export default function HelperPayoutStatementPage() {
  const params = useParams<{ id: string }>()
  const transferId = typeof params?.id === "string" ? params.id : undefined
  const { data: transfer, isLoading, isError } = usePaymentTransfer(transferId)
  const statement = useMemo(() => (transfer ? buildPayoutStatement(transfer) : null), [transfer])

  const ticketHref = statement?.ticketId ? `/helper/tickets/${statement.ticketId}` : null

  return (
    <div className="h-screen flex overflow-hidden print:h-auto print:overflow-visible print:block">
      <div className="print:hidden contents">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible print:block">
        <div className="print:hidden">
          <Header title="Payout statement" subtitle="Proof of payment for a single payout" />
        </div>

        <main className="flex-1 overflow-auto p-6 print:overflow-visible print:p-0">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
              <Button asChild variant="outline" size="sm" className="text-muted-foreground border-border bg-transparent">
                <Link href="/helper/reports">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to reports
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                {ticketHref && (
                  <Button asChild variant="outline" size="sm" className="text-muted-foreground border-border bg-transparent">
                    <Link href={ticketHref}>
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open ticket
                    </Link>
                  </Button>
                )}
                <Button
                  variant="lavender"
                  size="sm"
                  type="button"
                  disabled={!statement}
                  onClick={() => window.print()}
                  title="Opens your browser's print dialog, where you can save the statement as a PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="bg-white rounded-lg border border-[#E1E1E1] px-6 py-8 text-center text-muted-foreground text-[14px]">
                Loading payout...
              </div>
            ) : isError || !statement ? (
              <div className="bg-white rounded-lg border border-[#E1E1E1] px-6 py-8 text-center text-muted-foreground text-[14px]">
                This payout could not be found, or you do not have access to it.
              </div>
            ) : (
              <article className="bg-white rounded-lg border border-[#E1E1E1] print:border-0 print:rounded-none">
                <header className="px-8 py-6 border-b border-border flex items-start justify-between gap-6">
                  <div className="flex items-center gap-3">
                    <Logo className="text-brand-primary" />
                    <div>
                      <div className="text-lg font-semibold text-gray-900">Githelp</div>
                      <div className="text-sm text-muted-foreground">Payout statement</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Reference</div>
                    <div className="font-mono text-sm text-gray-900 break-all">{statement.reference}</div>
                    <div className="text-xs text-muted-foreground mt-2">{formatLongDate(statement.date)}</div>
                  </div>
                </header>

                <section className="px-8 py-6 border-b border-border">
                  <div className="flex items-start gap-3">
                    <Badge variant="secondary" className={STATUS_BADGE_CLASS[statement.status]}>
                      {statement.statusLabel}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      {statement.statusNote}
                      {statement.failureReason && (
                        <div className="mt-1 text-red-700">Reason: {statement.failureReason}</div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="px-8 py-6 border-b border-border grid gap-6 sm:grid-cols-2">
                  <dl className="space-y-3">
                    <div className="text-sm font-medium text-gray-900">Paid to</div>
                    <Field label="Name" value={statement.payee.name} />
                    <Field label="Email" value={statement.payee.email} />
                    <Field label="Stripe account" value={statement.payee.stripeAccountId} mono />
                  </dl>
                  <dl className="space-y-3">
                    <div className="text-sm font-medium text-gray-900">Paid by</div>
                    <Field label="Platform" value="Githelp" />
                    <Field label="On behalf of project" value={statement.projectName} />
                    <Field label="Method" value="Stripe Connect transfer" />
                  </dl>
                </section>

                <section className="px-8 py-6 border-b border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 font-medium">Description</th>
                        <th className="pb-2 font-medium">Ticket</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border">
                        <td className="py-3 pr-4 text-gray-900">
                          <div>Helper payout for support ticket</div>
                          <div className="text-xs text-muted-foreground">{statement.ticketTitle}</div>
                          {statement.slaName && (
                            <div className="text-xs text-muted-foreground">SLA: {statement.slaName}</div>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-mono tabular-nums text-gray-900 align-top">{statement.ticketShortId}</td>
                        <td className="py-3 pr-4 text-gray-900 align-top">{statement.ticketType}</td>
                        <td className="py-3 text-right tabular-nums text-gray-900 align-top">
                          {formatAmount(statement.amountSmallestUnit, statement.currency)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border">
                        <td colSpan={3} className="pt-3 text-right font-medium text-gray-900">
                          {statement.status === "completed"
                            ? "Total paid out"
                            : statement.status === "failed"
                              ? "Total (not paid)"
                              : "Total due"}
                        </td>
                        <td className="pt-3 text-right font-semibold tabular-nums text-gray-900">
                          {formatAmount(statement.amountSmallestUnit, statement.currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </section>

                <section className="px-8 py-6 border-b border-border">
                  <div className="text-sm font-medium text-gray-900 mb-3">References</div>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Field label="Payout ID" value={statement.payoutId} mono />
                    <Field label="Stripe transfer ID" value={statement.stripeTransferId} mono />
                    <Field label="Ticket ID" value={statement.ticketId} mono />
                    <Field label="Customer payment ID" value={statement.paymentId} mono />
                  </dl>
                </section>

                <footer className="px-8 py-4 text-xs text-muted-foreground space-y-1">
                  <p>
                    This statement confirms a transfer from Githelp to the helper&apos;s connected Stripe account for
                    the work listed above. It is not a tax invoice; the helper is responsible for reporting this
                    income in line with local rules.
                  </p>
                  <p>Generated on {formatLongDate(new Date().toISOString())}.</p>
                </footer>
              </article>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
