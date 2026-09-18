"use client"

import { useState } from "react"
import { ImageOff } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useTicketAttachmentUrl } from "@/hooks/useTicketAttachments"
import { parseTicketAttachmentPath } from "@/lib/ticket-attachments"

export interface ChatImageProps {
  src?: string
  alt?: string
}

/**
 * Image inside a chat message. Ticket attachments are stored privately, so
 * their `attachment:` reference is exchanged for a signed URL first; any other
 * image URL is shown as is. Click to view full size.
 */
export function ChatImage({ src, alt }: ChatImageProps) {
  const attachmentPath = parseTicketAttachmentPath(src)
  const { data: signedUrl, isLoading, isError } = useTicketAttachmentUrl(attachmentPath)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  const url = attachmentPath ? signedUrl : src
  const label = alt || "image"

  if (attachmentPath && isLoading) {
    return <span className="my-1 block h-40 w-64 max-w-full animate-pulse rounded-lg bg-muted" aria-label="Loading image" />
  }

  if (!url || isError || failed) {
    return (
      <span className="my-1 inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        <ImageOff className="h-4 w-4 shrink-0" />
        Image unavailable
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="my-1 block max-w-full cursor-zoom-in overflow-hidden rounded-lg border border-border"
        title="View full size"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed / user-supplied URL, not a static asset */}
        <img
          src={url}
          alt={label}
          loading="lazy"
          onError={() => setFailed(true)}
          className="block max-h-80 max-w-full object-contain"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-auto max-w-[calc(100%-2rem)] sm:max-w-[90vw] p-2">
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <DialogDescription className="sr-only">Full size image</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed / user-supplied URL, not a static asset */}
          <img src={url} alt={label} className="max-h-[85vh] max-w-full rounded object-contain" />
        </DialogContent>
      </Dialog>
    </>
  )
}
