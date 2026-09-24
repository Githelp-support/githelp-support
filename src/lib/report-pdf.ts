/**
 * Browser-side rendering of a `ReportDocument` (see `report-export.ts`) to
 * a downloadable PDF via jsPDF, plus the matching CSV download. jsPDF is
 * imported lazily so the Reports pages don't carry it in their initial bundle.
 */
import type { ReportDocument, ReportSection } from "@/lib/report-export"

const MARGIN = 14
const BRAND = [59, 91, 219] as const // brand-primary, approximated for print
const TEXT = [17, 24, 39] as const
const MUTED = [107, 114, 128] as const

function triggerDownload(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    // Give the browser a tick to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Saves `csv` as `<fileName>.csv`. A BOM is prepended so Excel reads it as UTF-8. */
export function downloadCsv(fileName: string, csv: string): void {
    triggerDownload(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${fileName}.csv`)
}

/** Renders the document with jsPDF and saves it as `<fileName>.pdf`. */
export async function downloadReportPdf(report: ReportDocument): Promise<void> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")])

    const wide = report.sections.some((s) => s.columns.length > 7)
    const pdf = new jsPDF({ orientation: wide ? "landscape" : "portrait", unit: "mm", format: "a4" })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const contentWidth = pageWidth - MARGIN * 2

    // Header block
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(18)
    pdf.setTextColor(...BRAND)
    pdf.text("Githelp", MARGIN, 20)
    pdf.setFontSize(14)
    pdf.setTextColor(...TEXT)
    pdf.text(report.title, MARGIN, 28)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(11)
    pdf.setTextColor(...MUTED)
    pdf.text(report.period, MARGIN, 34)

    // Meta pairs in two columns
    pdf.setFontSize(9)
    let y = 42
    const half = Math.ceil(report.meta.length / 2)
    report.meta.forEach(([label, value], index) => {
        const column = index < half ? 0 : 1
        const row = index < half ? index : index - half
        const x = MARGIN + column * (contentWidth / 2)
        const lineY = y + row * 5
        pdf.setTextColor(...MUTED)
        pdf.text(`${label}:`, x, lineY)
        pdf.setTextColor(...TEXT)
        pdf.text(String(value), x + 26, lineY)
    })
    y += half * 5 + 4

    const drawSection = (section: ReportSection) => {
        if (y > pageHeight - 40) {
            pdf.addPage()
            y = MARGIN + 6
        }
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(11)
        pdf.setTextColor(...TEXT)
        pdf.text(section.heading, MARGIN, y)
        y += 4
        if (section.note) {
            pdf.setFont("helvetica", "normal")
            pdf.setFontSize(8)
            pdf.setTextColor(...MUTED)
            pdf.text(pdf.splitTextToSize(section.note, contentWidth), MARGIN, y)
            y += 4
        }

        if (section.rows.length === 0) {
            pdf.setFont("helvetica", "italic")
            pdf.setFontSize(9)
            pdf.setTextColor(...MUTED)
            pdf.text(section.emptyMessage ?? "Nothing to report.", MARGIN, y + 2)
            y += 8
        } else {
            const columnStyles: Record<number, { halign: "left" | "right" }> = {}
            section.columns.forEach((column, index) => {
                if (column.align === "right") columnStyles[index] = { halign: "right" }
            })
            autoTable(pdf, {
                startY: y,
                margin: { left: MARGIN, right: MARGIN },
                head: [section.columns.map((c) => c.label)],
                body: section.rows,
                theme: "grid",
                styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, textColor: [...TEXT], lineColor: [225, 225, 225] },
                headStyles: { fillColor: [...BRAND], textColor: 255, fontStyle: "bold" },
                alternateRowStyles: { fillColor: [247, 249, 255] },
                columnStyles,
                didParseCell: (data) => {
                    if (data.section === "head" && columnStyles[data.column.index]) data.cell.styles.halign = "right"
                },
            })
            y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3
        }

        if (section.totals?.length) {
            if (y > pageHeight - 30) {
                pdf.addPage()
                y = MARGIN + 6
            }
            pdf.setFontSize(9)
            for (const [label, value] of section.totals) {
                pdf.setFont("helvetica", "normal")
                pdf.setTextColor(...MUTED)
                pdf.text(label, pageWidth - MARGIN - 60, y, { align: "right" })
                pdf.setFont("helvetica", "bold")
                pdf.setTextColor(...TEXT)
                pdf.text(value, pageWidth - MARGIN, y, { align: "right" })
                y += 4.5
            }
        }
        y += 6
    }

    for (const section of report.sections) drawSection(section)

    // Footer note (may need a page)
    const noteLines = pdf.splitTextToSize(report.footerNote, contentWidth) as string[]
    if (y + noteLines.length * 4 > pageHeight - 20) {
        pdf.addPage()
        y = MARGIN + 6
    }
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.setTextColor(...MUTED)
    pdf.text(noteLines, MARGIN, y)

    // Page numbers
    const pages = pdf.getNumberOfPages()
    for (let page = 1; page <= pages; page++) {
        pdf.setPage(page)
        pdf.setFontSize(8)
        pdf.setTextColor(...MUTED)
        pdf.text(`${report.title} · ${report.period}`, MARGIN, pageHeight - 8)
        pdf.text(`Page ${page} of ${pages}`, pageWidth - MARGIN, pageHeight - 8, { align: "right" })
    }

    pdf.save(`${report.fileName}.pdf`)
}
