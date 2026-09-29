"use client"

import { ImageUploadModal } from "@/components/modals/image-upload-modal"
import {
  TICKET_ATTACHMENT_MAX_MB,
  TICKET_ATTACHMENT_MIME_TYPES,
  ticketAttachmentMarkdown,
  uploadTicketAttachment,
} from "@/lib/ticket-attachments"

export interface AttachImageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `{projectId}/{ticketId}` — folder inside the ticket-attachments bucket. */
  storagePrefix: string
  /** Called with the markdown to add to the message once the image is uploaded. */
  onAttached: (markdown: string) => void
}

/** "Attach image" dialog of the ticket chat (customer and helper side). */
export function AttachImageModal({ open, onOpenChange, storagePrefix, onAttached }: AttachImageModalProps) {
  return (
    <ImageUploadModal
      open={open}
      onOpenChange={onOpenChange}
      uploadFile={async (file) => ticketAttachmentMarkdown(await uploadTicketAttachment(file, storagePrefix), file.name)}
      onUploadComplete={onAttached}
      title="Attach Image"
      description="Upload an image to attach to this ticket"
      maxFileSizeMB={TICKET_ATTACHMENT_MAX_MB}
      acceptedFileTypes={TICKET_ATTACHMENT_MIME_TYPES}
    />
  )
}
