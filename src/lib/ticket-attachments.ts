import { supabase } from "@/lib/supabase/client"

/**
 * Images shared in the ticket chat.
 *
 * Files live in the private `ticket-attachments` bucket (see backend migration
 * 20260918120000_ticket_attachments_bucket) under
 * `{projectId}/{ticketId}/{file}` — or `{projectId}/{userId}/{file}` for images
 * attached before the ticket exists (the first message creates the ticket).
 *
 * A message stores a stable `![name](attachment:{path})` reference, never a
 * signed URL: signed URLs expire, so an embedded one turns into a broken image
 * an hour later. The reference is exchanged for a fresh signed URL at render
 * time (useTicketAttachmentUrl), which also means storage RLS decides who can
 * see the image.
 */
export const TICKET_ATTACHMENTS_BUCKET = "ticket-attachments"
export const TICKET_ATTACHMENT_MAX_MB = 6
export const TICKET_ATTACHMENT_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"]

const ATTACHMENT_SCHEME = "attachment:"

const EXTENSION_BY_MIME: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
}

/** Returns a user-facing error when the file can't be attached, otherwise null. */
export function validateTicketAttachment(file: File): string | null {
    if (!TICKET_ATTACHMENT_MIME_TYPES.includes(file.type)) {
        return "Only PNG, JPEG, GIF and WebP images can be attached."
    }
    if (file.size > TICKET_ATTACHMENT_MAX_MB * 1024 * 1024) {
        return `Images must be smaller than ${TICKET_ATTACHMENT_MAX_MB}MB.`
    }
    return null
}

/**
 * Uploads an image and returns its path inside the bucket.
 * `storagePrefix` is `{projectId}/{ticketId}` (or `{projectId}/{userId}` before the ticket exists).
 */
export async function uploadTicketAttachment(file: File, storagePrefix: string): Promise<string> {
    const invalid = validateTicketAttachment(file)
    if (invalid) throw new Error(invalid)

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const path = `${storagePrefix}/${unique}.${EXTENSION_BY_MIME[file.type]}`

    // No upsert: names are unique and the bucket only grants insert + select.
    const { error } = await supabase.storage
        .from(TICKET_ATTACHMENTS_BUCKET)
        .upload(path, file, { contentType: file.type, cacheControl: "3600" })
    if (error) throw error

    return path
}

/** Markdown that embeds an uploaded attachment in a message. */
export function ticketAttachmentMarkdown(path: string, fileName?: string): string {
    const alt = (fileName ?? "").replace(/[\[\]\r\n]/g, "").trim() || "image"
    return `![${alt}](${ATTACHMENT_SCHEME}${path})`
}

/**
 * Bucket path for an image `src` that points at a ticket attachment, or null
 * for any other image. Besides `attachment:` references this recognises the
 * signed URLs older messages embedded, so those keep rendering after the
 * original signature expired.
 */
export function parseTicketAttachmentPath(src: string | null | undefined): string | null {
    if (!src) return null
    if (src.startsWith(ATTACHMENT_SCHEME)) {
        return src.slice(ATTACHMENT_SCHEME.length) || null
    }
    const match = /\/storage\/v1\/object\/(?:sign|authenticated)\/ticket-attachments\/([^?#]+)/.exec(src)
    if (!match) return null
    try {
        return decodeURIComponent(match[1])
    } catch {
        return null
    }
}

/** Message text without attachment markup — for ticket titles and other plain-text previews. */
export function stripTicketAttachments(text: string): string {
    return text
        .replace(/!\[[^\]]*\]\((?:attachment:|[^)\s]*\/ticket-attachments\/)[^)]*\)/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

/** Appends attachment markdown to a draft message, keeping it on its own line. */
export function appendToDraft(draft: string, markdown: string): string {
    const separator = draft.length === 0 || draft.endsWith("\n") ? "" : "\n"
    return `${draft}${separator}${markdown}\n`
}
