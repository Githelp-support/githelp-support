import { beforeEach, describe, expect, it, vi } from "vitest"

const upload = vi.fn()
vi.mock("@/lib/supabase/client", () => ({
    supabase: {
        storage: { from: vi.fn(() => ({ upload })) },
    },
}))

import { supabase } from "@/lib/supabase/client"
import {
    appendToDraft,
    parseTicketAttachmentPath,
    stripTicketAttachments,
    ticketAttachmentMarkdown,
    uploadTicketAttachment,
    validateTicketAttachment,
} from "./ticket-attachments"

const png = (size = 10, name = "shot.png") => new File([new Uint8Array(size)], name, { type: "image/png" })

describe("ticket attachments", () => {
    beforeEach(() => vi.clearAllMocks())

    it("builds markdown with a stable attachment: reference", () => {
        expect(ticketAttachmentMarkdown("p/t/1.png", "my [shot].png")).toBe("![my shot.png](attachment:p/t/1.png)")
        expect(ticketAttachmentMarkdown("p/t/1.png")).toBe("![image](attachment:p/t/1.png)")
    })

    it("parses attachment references and legacy signed URLs, ignores other images", () => {
        expect(parseTicketAttachmentPath("attachment:p/t/1.png")).toBe("p/t/1.png")
        expect(
            parseTicketAttachmentPath(
                "https://x.supabase.co/storage/v1/object/sign/ticket-attachments/p/t/1.png?token=abc",
            ),
        ).toBe("p/t/1.png")
        expect(parseTicketAttachmentPath("https://example.com/cat.png")).toBeNull()
        expect(parseTicketAttachmentPath("attachment:")).toBeNull()
        expect(parseTicketAttachmentPath(undefined)).toBeNull()
    })

    it("strips attachment markup for plain-text previews", () => {
        expect(stripTicketAttachments("It crashes\n![a.png](attachment:p/t/1.png)\n")).toBe("It crashes")
        expect(stripTicketAttachments("![a.png](attachment:p/t/1.png)")).toBe("")
        expect(stripTicketAttachments("see ![cat](https://example.com/cat.png)")).toBe(
            "see ![cat](https://example.com/cat.png)",
        )
    })

    it("appends to a draft on its own line", () => {
        expect(appendToDraft("", "![a](attachment:x)")).toBe("![a](attachment:x)\n")
        expect(appendToDraft("hello", "![a](attachment:x)")).toBe("hello\n![a](attachment:x)\n")
        expect(appendToDraft("hello\n", "![a](attachment:x)")).toBe("hello\n![a](attachment:x)\n")
    })

    it("rejects unsupported types and oversized files", () => {
        expect(validateTicketAttachment(png())).toBeNull()
        expect(validateTicketAttachment(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }))).toMatch(/PNG/)
        expect(validateTicketAttachment(png(6 * 1024 * 1024 + 1))).toMatch(/6MB/)
    })

    it("uploads under the prefix without upsert and returns the path", async () => {
        upload.mockResolvedValueOnce({ data: {}, error: null })
        const path = await uploadTicketAttachment(png(), "proj/ticket")
        expect(supabase.storage.from).toHaveBeenCalledWith("ticket-attachments")
        expect(path).toMatch(/^proj\/ticket\/\d+-[a-z0-9]+\.png$/)
        const [uploadedPath, , options] = upload.mock.calls[0]
        expect(uploadedPath).toBe(path)
        expect(options).toEqual({ contentType: "image/png", cacheControl: "3600" })
    })

    it("throws when storage rejects the upload", async () => {
        upload.mockResolvedValueOnce({ data: null, error: new Error("new row violates row-level security policy") })
        await expect(uploadTicketAttachment(png(), "proj/ticket")).rejects.toThrow(/row-level security/)
    })
})
