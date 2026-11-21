import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
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
vi.mock("@/components/ticket-chat/chat-input", () => ({ TicketChatInput: () => <textarea aria-label="Message" /> }))
vi.mock("@/components/ticket-chat/attach-image-modal", () => ({ AttachImageModal: () => null }))
vi.mock("@/components/ticket-chat/end-session-request", () => ({ EndSessionRequestedHelperBanner: () => null }))
vi.mock("@/components/drawers/end-ticket-drawer", () => ({
  EndTicketDrawer: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div role="dialog" aria-label="End ticket" /> : null),
}))
vi.mock("@/components/drawers/log-time-drawer", () => ({ LogTimeDrawer: () => null }))

/** An item as the helper/admin sidebar hooks return it, including the fields `ActiveTicketsList` reads. */
const sidebarItem = (overrides: Record<string, unknown> = {}) => ({
  id: "b435097a-1111-2222-3333-444455556666",
  title: "Testhelp - b435097a",
  subtitle: "Build fails on main",
  date: "25.08.2026",
  subject: "Build fails on main",
  projectName: "Testhelp",
  shortId: "b435097a",
  createdAt: "2026-08-25T10:00:00Z",
  avatarUrl: null,
  avatarInitial: "C",
  creatorId: "c1",
  current: false,
  hasNotification: false,
  ...overrides,
})

/** The viewer (u1) is the helper who claimed the ticket. */
const claimedByMe = () =>
  mocks.useTicketParticipants.mockReturnValue({
    data: [
      {
        id: "tp1",
        participant_id: "u1",
        claimed: true,
        created_at: "2026-08-25T10:05:00Z",
        user: { id: "u1", name: "Helper", avatar_url: null },
      },
    ],
    isLoading: false,
  })

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

  it("shows the short ticket id on a pill with a button that copies the full id", () => {
    mocks.useParams.mockReturnValue({ id: "b435097a-1111-2222-3333-444455556666" })
    render(<TicketDetailPage />)
    const pill = screen.getByText("b435097a..").closest('[data-slot="ticket-id-pill"]') as HTMLElement
    expect(pill).toBeInTheDocument()
    expect(pill.className).not.toMatch(/max-xl:hidden/)
    expect(screen.queryByText(/^ID:/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy full ticket ID" })).toBeInTheDocument()
  })

  it("shows End session in the header for the helper who claimed the ticket", () => {
    claimedByMe()
    render(<TicketDetailPage />)
    const button = screen.getByRole("button", { name: "End session" })
    expect(screen.getByRole("banner")).toContainElement(button)
  })

  it("shows End session in the header for an admin", () => {
    mocks.useProjectRole.mockReturnValue({ data: "admin" })
    mocks.useAdminActiveTicketsSidebar.mockReturnValue({ data: { items: [sidebarItem()], activeCount: 1 } })
    mocks.useHelperClaimedTicketsSidebar.mockReturnValue({ data: undefined })
    render(<TicketDetailPage />)
    const button = screen.getByRole("button", { name: "End session" })
    expect(screen.getByRole("banner")).toContainElement(button)
  })

  it("does not show End session to a helper who can only read along", () => {
    // Claimed (ticket status), but not by this helper, and they are not an admin.
    render(<TicketDetailPage />)
    expect(screen.queryByRole("button", { name: "End session" })).not.toBeInTheDocument()
  })

  it("opens the End ticket drawer from End session", () => {
    claimedByMe()
    render(<TicketDetailPage />)
    expect(screen.queryByRole("dialog", { name: "End ticket" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "End session" }))
    expect(screen.getByRole("dialog", { name: "End ticket" })).toBeInTheDocument()
  })

  it("lists active tickets with subject, project and short id, linking to the helper ticket page", () => {
    mocks.useHelperClaimedTicketsSidebar.mockReturnValue({ data: { items: [sidebarItem()], activeCount: 1 } })
    render(<TicketDetailPage />)
    expect(screen.getByText("Active tickets (1)")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: /Build fails on main/ })
    expect(link).toHaveAttribute("href", "/helper/tickets/b435097a-1111-2222-3333-444455556666")
    expect(link).toHaveTextContent("Testhelp · b435097a")
  })

  it("says no helper has joined while only the ticket creator is in the chat", () => {
    render(<TicketDetailPage />)
    expect(screen.getByText("No helper has joined yet.")).toBeInTheDocument()
    expect(screen.getByText("No other topics yet.")).toBeInTheDocument()
  })

  it("pads the top of the panel sheet below lg, where the collapse toggle is hidden", () => {
    render(<TicketDetailPage />)
    const scroller = screen.getByText(/people in this chat/i).closest(".overflow-y-auto") as HTMLElement
    expect(scroller.className).toMatch(/max-lg:pt-4/)
  })
})
