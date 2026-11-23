import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import TicketDetailPage from "./page"

Element.prototype.scrollIntoView = vi.fn()

const { mutation, mocks } = vi.hoisted(() => {
  const mutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    data: undefined,
    error: null,
  })
  const mocks = {
  useParams: vi.fn(),
  useUser: vi.fn(),
  useTicket: vi.fn(),
  useTicketWithDetails: vi.fn(),
  useTicketPaymentStatus: vi.fn(),
  useTicketMessages: vi.fn(),
  useTicketParticipants: vi.fn(),
  useTimeEntries: vi.fn(),
  useCurrentHelper: vi.fn(),
  useProject: vi.fn(),
  useProjectBranding: vi.fn(),
  useProjectPaymentSettings: vi.fn(),
  useProjectRole: vi.fn(),
  useHelperClaimedTicketsSidebar: vi.fn(),
  useAdminActiveTicketsSidebar: vi.fn(),
  useTicketAttachmentUpload: vi.fn(),
  }
  return { mutation, mocks }
})

vi.mock("next/navigation", () => ({ useParams: mocks.useParams, useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/contexts/user-context", () => ({ useUser: mocks.useUser }))
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock("@/hooks/useTickets", () => ({ useTicket: mocks.useTicket, useUpdateTicket: mutation }))
vi.mock("@/hooks/useTicketsWithDetails", () => ({ useTicketWithDetails: mocks.useTicketWithDetails }))
vi.mock("@/hooks/useTicketPaymentStatus", () => ({ useTicketPaymentStatus: mocks.useTicketPaymentStatus }))
vi.mock("@/hooks/useCaptureTicket", () => ({ useCaptureTicket: mutation }))
vi.mock("@/hooks/useTicketMessages", () => ({ useTicketMessages: mocks.useTicketMessages, useSendMessage: mutation }))
vi.mock("@/hooks/useRealtimeMessages", () => ({ useRealtimeMessages: vi.fn() }))
vi.mock("@/hooks/useRealtimeTicket", () => ({ useRealtimeTicket: vi.fn() }))
vi.mock("@/hooks/useTicketParticipants", () => ({
  useTicketParticipants: mocks.useTicketParticipants,
  useClaimTicket: mutation,
  useEnsureParticipant: mutation,
  useUpdateLastReadMessage: mutation,
}))
vi.mock("@/hooks/useTimeEntries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useTimeEntries")>()),
  useTimeEntries: mocks.useTimeEntries,
  useCreateTimeEntry: mutation,
  useDeleteTimeEntry: mutation,
  useRequestTimeEntryReview: mutation,
}))
vi.mock("@/hooks/useCurrentHelper", () => ({ useCurrentHelper: mocks.useCurrentHelper }))
vi.mock("@/hooks/useProject", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useProject")>()),
  useProject: mocks.useProject,
  useProjectBranding: mocks.useProjectBranding,
  useProjectPaymentSettings: mocks.useProjectPaymentSettings,
}))
vi.mock("@/hooks/useProjectResponseTime", () => ({ useProjectAverageResponseTime: () => ({ data: null }) }))
vi.mock("@/hooks/useProjectRole", () => ({ useProjectRole: mocks.useProjectRole }))
vi.mock("@/hooks/useHelpers", () => ({ useAddSelfAsHelper: mutation }))
vi.mock("@/hooks/useHelperTickets", () => ({
  useHelperClaimedTicketsSidebar: mocks.useHelperClaimedTicketsSidebar,
  useAdminActiveTicketsSidebar: mocks.useAdminActiveTicketsSidebar,
}))
vi.mock("@/hooks/useTicketAttachments", () => ({ useTicketAttachmentUpload: mocks.useTicketAttachmentUpload }))
vi.mock("@/components/layout/app-shell", () => ({ useSetProjectPageHref: vi.fn() }))
vi.mock("@/components/layout/header", () => ({
  Header: ({ title, actions, inlineRightContent }: { title: string; actions?: React.ReactNode; inlineRightContent?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {inlineRightContent}
      {actions}
    </header>
  ),
}))
vi.mock("@/components/ticket-chat/markdown-content", () => ({
  MarkdownContent: ({ content }: { content: string }) => <div>{content}</div>,
}))
vi.mock("@/components/ticket-chat/chat-input", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ticket-chat/chat-input")>()),
  TicketChatInput: ({ placeholder, toolbarEndContent }: { placeholder?: string; toolbarEndContent?: React.ReactNode }) => (
    <div data-testid="composer">
      <textarea aria-label="Message" placeholder={placeholder} />
      {toolbarEndContent}
    </div>
  ),
}))
vi.mock("@/components/ticket-chat/attach-image-modal", () => ({ AttachImageModal: () => null }))
vi.mock("@/components/ticket-chat/end-session-request", () => ({ EndSessionRequestedHelperBanner: () => null }))
vi.mock("@/components/drawers/end-ticket-drawer", () => ({ EndTicketDrawer: () => null }))
vi.mock("@/components/drawers/log-time-drawer", () => ({ LogTimeDrawer: () => null }))

describe("helper ticket page frame", () => {
  beforeEach(() => {
    mocks.useParams.mockReturnValue({ id: "t1" })
    mocks.useUser.mockReturnValue({ user: { id: "u1", name: "Helper", role: "helper", avatar_url: null } })
    mocks.useTicket.mockReturnValue({
      data: {
        id: "t1",
        project_id: "p1",
        status: "claimed",
        title: "Build fails",
        description: "It fails on main",
        created_at: "2026-08-25T10:00:00Z",
        claimed_by: "h1",
      },
      isLoading: false,
      isError: false,
    })
    mocks.useTicketWithDetails.mockReturnValue({ data: { sla_id: null, keywords: [], help_categories: [] } })
    mocks.useTicketPaymentStatus.mockReturnValue({
      status: "authorized",
      isReady: true,
      error: null,
      capturedAmountSmallestUnit: null,
      capturedSplits: null,
      failureReason: null,
    })
    mocks.useTicketMessages.mockReturnValue({ data: [], isLoading: false })
    mocks.useTicketParticipants.mockReturnValue({ data: [], isLoading: false })
    mocks.useTimeEntries.mockReturnValue({ data: [] })
    mocks.useCurrentHelper.mockReturnValue({ data: "h1" })
    mocks.useProject.mockReturnValue({ data: { id: "p1", name: "Testhelp" } })
    mocks.useProjectBranding.mockReturnValue({ data: null })
    mocks.useProjectPaymentSettings.mockReturnValue({ data: null })
    mocks.useProjectRole.mockReturnValue({ data: "helper" })
    mocks.useHelperClaimedTicketsSidebar.mockReturnValue({ data: { items: [], activeCount: 0 } })
    mocks.useAdminActiveTicketsSidebar.mockReturnValue({ data: undefined })
    mocks.useTicketAttachmentUpload.mockReturnValue({ uploadFiles: vi.fn(), isUploading: false })
  })

  it("lays the chat column and the right panel out side by side in one row", () => {
    const { container } = render(<TicketDetailPage />)

    const header = screen.getByRole("heading", { name: "Ticket with Testhelp" })
    const panelHeading = screen.getByText(/people in this chat/i)

    // The AppShell content column is a vertical flex column, so the page
    // itself must provide the horizontal row that puts the panel beside the
    // chat; as two loose siblings they stack and the chat collapses to 0px.
    const row = container.firstElementChild as HTMLElement
    expect(row).toContainElement(header)
    expect(row).toContainElement(panelHeading)
    expect(row.className).toMatch(/\bflex\b/)
    expect(row.className).not.toMatch(/flex-col/)
  })

  it("lets the chat column shrink below its content width on narrow screens", () => {
    render(<TicketDetailPage />)
    // <main> is a flex row; without min-w-0 its column keeps its min-content
    // width and runs past the viewport on phones.
    const column = screen.getByRole("main").firstElementChild as HTMLElement
    expect(column.className).toMatch(/min-w-0/)
  })

  it("shows the ticket id as a copyable pill next to the title", () => {
    render(<TicketDetailPage />)
    const header = screen.getByRole("banner")
    expect(within(header).getByText("t1..")).toBeInTheDocument()
    expect(within(header).getByRole("button", { name: "Copy full ticket ID" })).toBeInTheDocument()
    expect(screen.queryByText("ID: t1")).not.toBeInTheDocument()
  })

  it("pads the top of the panel, which has no toggle row of its own", () => {
    render(<TicketDetailPage />)
    const scroller = screen.getByText(/people in this chat/i).closest(".overflow-y-auto") as HTMLElement
    expect(scroller.className).toMatch(/\bpt-4\b/)
  })

  it("puts the right-panel toggle in the header", () => {
    render(<TicketDetailPage />)
    const header = screen.getByRole("banner")
    expect(within(header).getByRole("button", { name: /hide ticket details/i })).toBeInTheDocument()
    expect(within(header).getByRole("button", { name: "Ticket details" })).toBeInTheDocument()
  })

  it("shows End session in the header, not in the composer, for the claimed helper", () => {
    mocks.useTicketParticipants.mockReturnValue({
      data: [{ id: "tp1", participant_id: "u1", claimed: true, created_at: "", user: { id: "u1", name: "Helper", avatar_url: null } }],
      isLoading: false,
    })
    render(<TicketDetailPage />)
    expect(within(screen.getByRole("banner")).getByRole("button", { name: "End session" })).toBeInTheDocument()
    expect(within(screen.getByTestId("composer")).queryByRole("button", { name: "End session" })).not.toBeInTheDocument()
  })

  it("hides End session from a helper who has not claimed the ticket", () => {
    mocks.useTicketParticipants.mockReturnValue({
      data: [{ id: "tp1", participant_id: "h2", claimed: true, created_at: "", user: { id: "h2", name: "Other", avatar_url: null } }],
      isLoading: false,
    })
    render(<TicketDetailPage />)
    expect(screen.queryByRole("button", { name: "End session" })).not.toBeInTheDocument()
  })

  it("keeps Claim ticket in the composer toolbar on an unclaimed ticket", () => {
    mocks.useTicket.mockReturnValue({
      data: { id: "t1", project_id: "p1", status: "available", title: "Build fails", description: "It fails on main", created_at: "2026-08-25T10:00:00Z" },
      isLoading: false,
      isError: false,
    })
    render(<TicketDetailPage />)
    expect(within(screen.getByTestId("composer")).getByRole("button", { name: /claim/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "End session" })).not.toBeInTheDocument()
  })

  it("uses the project's composer placeholder", () => {
    mocks.useProject.mockReturnValue({ data: { id: "p1", name: "Testhelp", slug: "testhelp" } })
    render(<TicketDetailPage />)
    expect(screen.getByLabelText("Message")).toHaveAttribute("placeholder", "Ask #testhelp")
  })

  it("says so when no helper has joined and when there are no other topics", () => {
    render(<TicketDetailPage />)
    expect(screen.getByText("No helper has joined yet.")).toBeInTheDocument()
    expect(screen.getByText("No other topics yet.")).toBeInTheDocument()
    expect(screen.getByText("Active tickets (0)")).toBeInTheDocument()
  })

  it("drops the no-helper line once a helper has claimed the ticket", () => {
    mocks.useTicketParticipants.mockReturnValue({
      data: [{ id: "tp1", participant_id: "u1", claimed: true, created_at: "", user: { id: "u1", name: "Helper", avatar_url: null } }],
      isLoading: false,
    })
    render(<TicketDetailPage />)
    expect(screen.queryByText("No helper has joined yet.")).not.toBeInTheDocument()
  })

  it("renders grey system messages as notes and groups follow-ups under one sender", () => {
    // Two helper messages: the customer's first message would be followed by the auto-reply.
    mocks.useTicketMessages.mockReturnValue({
      data: [
        { id: "m1", sender_type: "helper", sender_id: "h2", content: "First", created_at: "2026-08-25T10:00:00Z", sender: { id: "h2", name: "Ada", avatar_url: null }, metadata: null },
        { id: "m2", sender_type: "helper", sender_id: "h2", content: "Second", created_at: "2026-08-25T10:01:00Z", sender: { id: "h2", name: "Ada", avatar_url: null }, metadata: null },
        { id: "m3", sender_type: "system", sender_id: null, content: "Time was logged", created_at: "2026-08-26T10:02:00Z", sender: null, metadata: { kind: "time_logged" } },
      ],
      isLoading: false,
    })
    const { container } = render(<TicketDetailPage />)
    const rows = container.querySelectorAll('[data-slot="chat-message-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveAttribute("data-group-start")
    expect(rows[1]).not.toHaveAttribute("data-group-start")
    const notes = Array.from(container.querySelectorAll('[data-slot="system-note"]')).map((n) => n.textContent)
    expect(notes).toContain("Note · Time was logged")
    // One divider above the intro, one for the next day.
    expect(screen.getAllByRole("separator")).toHaveLength(2)
  })

  describe("stored welcome, start note and auto-reply", () => {
    const sys = (id: string, kind: string, content: string, created_at: string, metadata: Record<string, unknown> = {}) => ({
      id,
      sender_type: "system",
      sender_id: null,
      content,
      created_at,
      sender: null,
      is_automatic: true,
      metadata: { kind, ...metadata },
    })
    const welcome = sys("w1", "welcome", "Welcome to Acme support!", "2026-08-25T10:00:00Z", {
      project_name: "Acme Inc",
      rates: { ticket_start_price: 500, ticket_price_minute_first_60: 100, ticket_price_minute_after_60: 200, currency: "usd", is_free: false },
    })
    const startNote = sys("n1", "start_note", "A helper will join shortly.", "2026-08-25T10:00:00Z")
    const firstMessage = {
      id: "m1",
      sender_type: "user",
      sender_id: "c1",
      content: "My build is broken",
      created_at: "2026-08-25T10:01:00Z",
      sender: { id: "c1", name: "Ada", avatar_url: null },
      metadata: null,
    }
    const autoReply = sys("a1", "auto_reply", "Thanks, we got your message.", "2026-08-25T10:01:05Z")
    const claimedBy = {
      data: [{ id: "tp1", participant_id: "u1", claimed: true, created_at: "", user: { id: "u1", name: "Helper", avatar_url: null } }],
      isLoading: false,
    }

    /** `a` comes before `b` in the document. */
    const precedes = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

    it("renders the stored welcome with the shared component, from the row's own snapshot", () => {
      // Stored out of order on purpose: the welcome still opens the thread.
      mocks.useTicketMessages.mockReturnValue({ data: [firstMessage, autoReply, welcome, startNote], isLoading: false })
      // Live settings differ from the snapshot; the welcome must not use them.
      mocks.useProjectPaymentSettings.mockReturnValue({
        data: { ticket_start_price: 900, ticket_price_minute_first_60: 900, ticket_price_minute_after_60: 900 },
      })
      const { container } = render(<TicketDetailPage />)

      const blocks = container.querySelectorAll('[data-slot="chat-welcome"]')
      expect(blocks).toHaveLength(1)
      const block = blocks[0] as HTMLElement
      expect(within(block).getByText("Acme Inc Team")).toBeInTheDocument()
      expect(within(block).getByText("Project")).toBeInTheDocument()
      expect(within(block).getByText("Welcome to Acme support!")).toBeInTheDocument()
      expect(within(block).getByText("5.00")).toBeInTheDocument()
      expect(within(block).getByText("1.00")).toBeInTheDocument()
      expect(within(block).getByText("2.00")).toBeInTheDocument()
      // Not also as a system note, and the rates are listed once.
      expect(screen.getAllByText("Welcome to Acme support!")).toHaveLength(1)
      expect(screen.getAllByText("Rates")).toHaveLength(1)
      expect(screen.queryByText("9.00")).not.toBeInTheDocument()
    })

    it("shows the start note and auto-reply as notes with the stored text", () => {
      mocks.useTicketMessages.mockReturnValue({ data: [welcome, startNote, firstMessage, autoReply], isLoading: false })
      const { container } = render(<TicketDetailPage />)
      const notes = Array.from(container.querySelectorAll('[data-slot="system-note"]'))
      expect(notes.map((n) => n.textContent)).toEqual([
        "Note · A helper will join shortly.",
        "Note · Thanks, we got your message.",
      ])
    })

    it("orders the thread like the customer's: divider, welcome, start note, issue, claimed, the rest", () => {
      mocks.useTicketParticipants.mockReturnValue(claimedBy)
      mocks.useTicketMessages.mockReturnValue({ data: [welcome, startNote, firstMessage, autoReply], isLoading: false })
      const { container } = render(<TicketDetailPage />)

      const dividers = screen.getAllByRole("separator")
      // One day, one divider: nothing above the welcome but it.
      expect(dividers).toHaveLength(1)
      const block = container.querySelector('[data-slot="chat-welcome"]') as HTMLElement
      const [note, reply] = Array.from(container.querySelectorAll('[data-slot="system-note"]'))
      const issue = screen.getByText("Info about issue")
      const claimed = screen.getByText("Ticket is claimed")
      const message = container.querySelector('[data-slot="chat-message-row"]') as HTMLElement

      const order = [dividers[0], block, note, issue, claimed, message, reply]
      order.slice(1).forEach((el, i) => expect(precedes(order[i], el)).toBe(true))
      // The first thread element after the divider is the welcome.
      expect(dividers[0].nextElementSibling).toContainElement(block)
    })

    it("keeps the block's own rates when the stored welcome lists none", () => {
      mocks.useTicketMessages.mockReturnValue({
        data: [{ ...welcome, metadata: { kind: "welcome", project_name: null, rates: null } }, firstMessage],
        isLoading: false,
      })
      const { container } = render(<TicketDetailPage />)
      const block = container.querySelector('[data-slot="chat-welcome"]') as HTMLElement
      // Falls back to the project's name; says nothing about rates itself.
      expect(within(block).getByText("Testhelp Team")).toBeInTheDocument()
      expect(within(block).queryByText("Rates")).not.toBeInTheDocument()
      expect(screen.getAllByText("Rates")).toHaveLength(1)
    })

    describe("on a ticket without stored rows (database without the welcome migration)", () => {
      const withSnapshot = (pricing_snapshot: Record<string, number> | null) =>
        mocks.useTicket.mockReturnValue({
          data: {
            id: "t1",
            project_id: "p1",
            status: "claimed",
            title: "Build fails",
            description: "It fails on main",
            created_at: "2026-08-25T10:00:00Z",
            claimed_by: "h1",
            pricing_snapshot,
          },
          isLoading: false,
          isError: false,
        })

      it("still shows the welcome with the ticket's snapshot rates, the start note and the auto-reply, in order", () => {
        withSnapshot({ ticket_start_price: 500, ticket_price_minute_first_60: 100, ticket_price_minute_after_60: 200 })
        // Live settings differ from the snapshot; the welcome must not use them.
        mocks.useProjectPaymentSettings.mockReturnValue({
          data: { ticket_start_price: 900, ticket_price_minute_first_60: 900, ticket_price_minute_after_60: 900 },
        })
        mocks.useTicketParticipants.mockReturnValue(claimedBy)
        mocks.useTicketMessages.mockReturnValue({ data: [firstMessage], isLoading: false })
        const { container } = render(<TicketDetailPage />)

        const blocks = container.querySelectorAll('[data-slot="chat-welcome"]')
        expect(blocks).toHaveLength(1)
        const block = blocks[0] as HTMLElement
        expect(within(block).getByText("Testhelp Team")).toBeInTheDocument()
        expect(within(block).getByText(/Welcome to Testhelp's support chat\./)).toBeInTheDocument()
        expect(within(block).getByText("5.00")).toBeInTheDocument()
        expect(within(block).getByText("1.00")).toBeInTheDocument()
        expect(within(block).getByText("2.00")).toBeInTheDocument()
        expect(screen.queryByText("9.00")).not.toBeInTheDocument()
        // The rates are listed once: in the welcome, not again in "Info about issue".
        expect(screen.getAllByText("Rates")).toHaveLength(1)

        const notes = Array.from(container.querySelectorAll('[data-slot="system-note"]'))
        expect(notes.map((n) => n.textContent)).toEqual([
          "Note · You are not charged anything before both you and the helper have confirmed the ticket. Feel free to chat and clarify details before you confirm.",
          // No response-time sentence without a real value.
          "Note · Thank you for reaching out! A helper will get in touch with you as soon as possible.",
        ])
        const [note, reply] = notes
        const divider = screen.getAllByRole("separator")[0]
        const issue = screen.getByText("Info about issue")
        const claimed = screen.getByText("Ticket is claimed")
        const message = container.querySelector('[data-slot="chat-message-row"]') as HTMLElement
        const order = [divider, block, note, issue, claimed, message, reply]
        order.slice(1).forEach((el, i) => expect(precedes(order[i], el)).toBe(true))
        // Shown like history, never animated in.
        expect(block.closest(".animate-enter")).toBeNull()
        notes.forEach((n) => expect(n.closest(".animate-enter")).toBeNull())
      })

      it("shows the free-support sentence for a ticket opened as free", () => {
        withSnapshot({ ticket_start_price: 0, ticket_price_minute_first_60: 0, ticket_price_minute_after_60: 0 })
        mocks.useTicketMessages.mockReturnValue({ data: [], isLoading: false })
        const { container } = render(<TicketDetailPage />)
        const block = container.querySelector('[data-slot="chat-welcome"]') as HTMLElement
        expect(within(block).getByText("Testhelp offers support for free - no payment method needed.")).toBeInTheDocument()
        expect(container.querySelector('[data-slot="system-note"]')?.textContent).toBe(
          "Note · Feel free to chat and clarify details before you get a response.",
        )
      })

      it("waits for the messages, so a stored welcome is never preceded by its stand-in", () => {
        mocks.useTicketMessages.mockReturnValue({ data: undefined, isLoading: true })
        const { container } = render(<TicketDetailPage />)
        expect(container.querySelector('[data-slot="chat-welcome"]')).not.toBeInTheDocument()
      })

      it("lets a stored row replace its stand-in", () => {
        mocks.useTicketMessages.mockReturnValue({ data: [welcome, firstMessage], isLoading: false })
        const { container } = render(<TicketDetailPage />)
        expect(container.querySelectorAll('[data-slot="chat-welcome"]')).toHaveLength(1)
        expect(screen.getByText("Welcome to Acme support!")).toBeInTheDocument()
        // The start note and the auto-reply have no stored row here: stand-ins.
        expect(container.querySelectorAll('[data-slot="system-note"]')).toHaveLength(2)
      })
    })

    it("shows them immediately, also when they arrive after the thread loaded", () => {
      mocks.useTicketMessages.mockReturnValue({ data: [firstMessage], isLoading: false })
      const { container, rerender } = render(<TicketDetailPage />)
      const reply = { ...firstMessage, id: "m2", sender_type: "helper", sender_id: "u1", content: "On it", created_at: "2026-08-25T10:20:00Z" }
      mocks.useTicketMessages.mockReturnValue({ data: [welcome, startNote, firstMessage, autoReply, reply], isLoading: false })
      rerender(<TicketDetailPage />)

      expect(container.querySelector('[data-slot="chat-welcome"]')?.closest(".animate-enter")).toBeNull()
      const notes = container.querySelectorAll('[data-slot="system-note"]')
      expect(notes).toHaveLength(2)
      notes.forEach((n) => expect(n.closest(".animate-enter")).toBeNull())
      // Ordinary new messages still animate in.
      expect(screen.getByText("On it").closest(".animate-enter")).not.toBeNull()
    })
  })
})
