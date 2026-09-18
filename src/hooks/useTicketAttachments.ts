import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import {
    TICKET_ATTACHMENTS_BUCKET,
    ticketAttachmentMarkdown,
    uploadTicketAttachment,
    validateTicketAttachment,
} from "@/lib/ticket-attachments";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Signed URL for an attachment path in the private ticket-attachments bucket.
 * Cached per path and refreshed before the signature expires.
 */
export function useTicketAttachmentUrl(path: string | null) {
    return useQuery({
        queryKey: ["ticket-attachment-url", path],
        queryFn: async () => {
            const { data, error } = await supabase.storage
                .from(TICKET_ATTACHMENTS_BUCKET)
                .createSignedUrl(path as string, SIGNED_URL_TTL_SECONDS);
            if (error) throw error;
            return data.signedUrl;
        },
        enabled: !!path,
        staleTime: (SIGNED_URL_TTL_SECONDS - 10 * 60) * 1000,
        gcTime: (SIGNED_URL_TTL_SECONDS - 5 * 60) * 1000,
        retry: 1,
    });
}

/**
 * Uploads images picked, pasted or dropped into the chat input and hands the
 * resulting markdown to `onAttached` (one call per uploaded image).
 * `storagePrefix` is `{projectId}/{ticketId}`; uploads are disabled without it.
 */
export function useTicketAttachmentUpload(
    storagePrefix: string | undefined,
    onAttached: (markdown: string) => void,
) {
    const [pending, setPending] = useState(0);

    const uploadFiles = useCallback(
        async (files: File[]) => {
            if (!storagePrefix || files.length === 0) return;
            setPending((n) => n + files.length);
            for (const file of files) {
                try {
                    const invalid = validateTicketAttachment(file);
                    if (invalid) {
                        toast.error(invalid);
                        continue;
                    }
                    const path = await uploadTicketAttachment(file, storagePrefix);
                    onAttached(ticketAttachmentMarkdown(path, file.name));
                } catch (error) {
                    console.error("Failed to upload attachment:", error);
                    toast.error("Failed to upload image. Please try again.");
                } finally {
                    setPending((n) => n - 1);
                }
            }
        },
        [storagePrefix, onAttached],
    );

    return { uploadFiles, isUploading: pending > 0 };
}
