import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const createSignedUrl = vi.fn()
vi.mock("@/lib/supabase/client", () => ({
    supabase: {
        storage: { from: vi.fn(() => ({ createSignedUrl })) },
    },
}))

import { MarkdownContent } from "./markdown-content"
import { TicketChatInput } from "./chat-input"

function renderWithQuery(ui: React.ReactElement) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe("chat image attachments", () => {
    beforeEach(() => vi.clearAllMocks())

    it("renders an attachment: reference through a freshly signed URL", async () => {
        createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/1.png?token=t" }, error: null })
        renderWithQuery(<MarkdownContent content={"Look:\n![shot.png](attachment:proj/ticket/1.png)"} />)
        const img = await screen.findByAltText("shot.png")
        expect(img).toHaveAttribute("src", "https://signed.example/1.png?token=t")
        expect(createSignedUrl).toHaveBeenCalledWith("proj/ticket/1.png", 3600)
    })

    it("re-signs legacy messages that embedded an expiring signed URL", async () => {
        createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/fresh" }, error: null })
        renderWithQuery(
            <MarkdownContent
                content={"![attachment](https://x.supabase.co/storage/v1/object/sign/ticket-attachments/proj/ticket/2.png?token=old)"}
            />,
        )
        expect(await screen.findByAltText("attachment")).toHaveAttribute("src", "https://signed.example/fresh")
        expect(createSignedUrl).toHaveBeenCalledWith("proj/ticket/2.png", 3600)
    })

    it("shows a placeholder when the image can't be accessed", async () => {
        createSignedUrl.mockResolvedValue({ data: null, error: new Error("Object not found") })
        renderWithQuery(<MarkdownContent content={"![x](attachment:proj/ticket/3.png)"} />)
        // The hook retries once (~1s backoff) before giving up.
        expect(await screen.findByText("Image unavailable", undefined, { timeout: 4000 })).toBeInTheDocument()
    })

    it("renders external images directly without signing", () => {
        renderWithQuery(<MarkdownContent content={"![cat](https://example.com/cat.png)"} />)
        expect(screen.getByAltText("cat")).toHaveAttribute("src", "https://example.com/cat.png")
        expect(createSignedUrl).not.toHaveBeenCalled()
    })

    it("still strips unsafe URL schemes", () => {
        const { container } = renderWithQuery(<MarkdownContent content={"[x](javascript:alert(1))"} />)
        expect(container.querySelector("a")?.getAttribute("href")).toBe("")
    })
})

describe("TicketChatInput image paste / drop", () => {
    const image = new File([new Uint8Array(4)], "screenshot.png", { type: "image/png" })

    it("hands pasted images to onImageFiles", async () => {
        const onImageFiles = vi.fn()
        render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} onImageFiles={onImageFiles} />)
        fireEvent.paste(screen.getByRole("textbox"), {
            clipboardData: { files: [image], getData: () => "" },
        })
        await waitFor(() => expect(onImageFiles).toHaveBeenCalledWith([image]))
    })

    it("keeps a paste that also carries text as a text paste", () => {
        const onImageFiles = vi.fn()
        render(<TicketChatInput value="" onChange={() => {}} onSend={() => {}} onImageFiles={onImageFiles} />)
        fireEvent.paste(screen.getByRole("textbox"), {
            clipboardData: { files: [image], getData: () => "copied cell" },
        })
        expect(onImageFiles).not.toHaveBeenCalled()
    })

    it("hands dropped images to onImageFiles", () => {
        const onImageFiles = vi.fn()
        const { container } = render(
            <TicketChatInput value="" onChange={() => {}} onSend={() => {}} onImageFiles={onImageFiles} />,
        )
        fireEvent.drop(container.firstChild as Element, {
            dataTransfer: { files: [image], types: ["Files"] },
        })
        expect(onImageFiles).toHaveBeenCalledWith([image])
    })
})
