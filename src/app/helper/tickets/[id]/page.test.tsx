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
  useProjectPaymentSettings: mocks.useProjectPaymentSettings,
}))
vi.mock("@/hooks/useProjectRole", () => ({ useProjectRole: mocks.useProjectRole }))
vi.mock("@/hooks/useHelpers", () => ({ useAddSelfAsHelper: mutation }))
vi.mock("@/hooks/useHelperTickets", () => ({
  useHelperClaimedTicketsSidebar: mocks.useHelperClaimedTicketsSidebar,
  useAdminActiveTicketsSidebar: mocks.useAdminActiveTicketsSidebar,
}))
vi.mock("@/hooks/useTicketAttachments", () => ({ useTicketAttachmentUpload: mocks.useTicketAttachmentUpload }))
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
    mocks.useTicketMessages.mockReturnValue({
      data: [
        { id: "m1", sender_type: "user", sender_id: "c1", content: "First", created_at: "2026-08-25T10:00:00Z", sender: { id: "c1", name: "Ada", avatar_url: null }, metadata: null },
        { id: "m2", sender_type: "user", sender_id: "c1", content: "Second", created_at: "2026-08-25T10:01:00Z", sender: { id: "c1", name: "Ada", avatar_url: null }, metadata: null },
        { id: "m3", sender_type: "system", sender_id: null, content: "Time was logged", created_at: "2026-08-26T10:02:00Z", sender: null, metadata: { kind: "time_logged" } },
      ],
      isLoading: false,
    })
    const { container } = render(<TicketDetailPage />)
    const rows = container.querySelectorAll('[data-slot="chat-message-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveAttribute("data-group-start")
    expect(rows[1]).not.toHaveAttribute("data-group-start")
    const note = container.querySelector('[data-slot="system-note"]') as HTMLElement
    expect(note).toHaveTextContent("Note · Time was logged")
    // One divider above the intro, one for the next day.
    expect(screen.getAllByRole("separator")).toHaveLength(2)
  })
})
