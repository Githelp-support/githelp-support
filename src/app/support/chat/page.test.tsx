import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

/**
 * Retry-flow coverage for the support chat page.
 *
 * Two failure modes are exercised:
 * 1. Ticket creation itself fails → error banner + input preserved; Retry
 *    re-attempts creation.
 * 2. Ticket creation succeeds but persisting the participant/first message
 *    fails → Retry must reuse the already-created ticket (no duplicate
 *    createTicket call) and only re-run the failed steps.
 */

const h = vi.hoisted(() => ({
  createTicketMutateAsync: vi.fn(),
  sendMessageMutateAsync: vi.fn(),
  ensureParticipantMutateAsync: vi.fn(),
  requestEndSessionMutateAsync: vi.fn(),
  createCheckoutMutateAsync: vi.fn(),
  functionsInvoke: vi.fn(() => Promise.resolve({ data: null, error: null })),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

// --- Navigation: open the chat for a project, no existing ticket ---
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("project=proj-1"),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

vi.mock("sonner", () => ({
  toast: { error: h.toastError, success: h.toastSuccess },
}))

// --- Supabase + auth helpers ---
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: null }, error: null }),
      ),
    },
    functions: { invoke: h.functionsInvoke },
  },
}))
vi.mock("@/lib/supabase/auth", () => ({ loginUserGoogle: vi.fn() }))
vi.mock("@/lib/organizations", () => ({ ensureUserOrganization: vi.fn() }))

// --- Signed-in user (required so the first message is persisted) ---
vi.mock("@/contexts/user-context", () => ({
  useUser: () => ({
    user: { id: "user-1", name: "Test User", avatar: "T" },
    setProjectRole: vi.fn(),
  }),
}))

// --- Project data ---
vi.mock("@/hooks/useProject", () => ({
  useProject: () => ({
    data: { project_id: "proj-1", name: "Acme", slug: "acme", sandbox: false },
  }),
  useProjectBySlug: () => ({ data: undefined }),
  useProjectPaymentSettings: () => ({ data: undefined }),
  useProjectBranding: () => ({ data: undefined }),
  useProjects: () => ({ data: [], isLoading: false }),
}))
vi.mock("@/hooks/useProjectRole", () => ({
  useProjectRole: () => ({ data: null }),
}))

// --- Mutation hooks under test ---
vi.mock("@/hooks/useTickets", () => ({
  useCreateTicket: () => ({
    mutateAsync: h.createTicketMutateAsync,
    isPending: false,
  }),
  useRequestEndSession: () => ({
    mutateAsync: h.requestEndSessionMutateAsync,
    isPending: false,
  }),
}))
vi.mock("@/hooks/useTicketMessages", () => ({
  useTicketMessages: () => ({ data: [] }),
  useSendMessage: () => ({
    mutateAsync: h.sendMessageMutateAsync,
    isPending: false,
  }),
}))
vi.mock("@/hooks/useTicketParticipants", () => ({
  useTicketParticipants: () => ({ data: [], isLoading: false }),
  useEnsureParticipant: () => ({
    mutateAsync: h.ensureParticipantMutateAsync,
    isPending: false,
  }),
}))
vi.mock("@/hooks/useCreateCheckoutForTicket", () => ({
  useCreateCheckoutForTicket: () => ({
    mutateAsync: h.createCheckoutMutateAsync,
    isPending: false,
  }),
}))

// --- Remaining data hooks (inert for these tests) ---
vi.mock("@/hooks/useRealtimeMessages", () => ({ useRealtimeMessages: vi.fn() }))
vi.mock("@/hooks/useRealtimeTicket", () => ({ useRealtimeTicket: vi.fn() }))
vi.mock("@/hooks/useTicketsWithDetails", () => ({
  useTicketWithDetails: () => ({ data: undefined, isLoading: false }),
  useUserActiveTicketsSidebar: () => ({
    data: { items: [], activeCount: 0 },
  }),
  useLatestUserActiveTicket: () => ({ data: undefined, isLoading: false }),
}))
vi.mock("@/hooks/useTimeEntries", () => ({
  useTimeEntries: () => ({ data: [] }),
  timeMillisecondsToHoursMinutes: (ms: number) => ({
    hours: Math.floor(ms / 3600000),
    minutes: Math.floor(ms / 60000) % 60,
  }),
}))
vi.mock("@/hooks/useTicketPaymentStatus", () => ({
  useTicketPaymentStatus: () => ({
    status: "pending",
    capturedAmountSmallestUnit: null,
    isReady: false,
  }),
}))

// --- Heavy UI collaborators ---
vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => null }))
vi.mock("@/components/payment/ConfirmPaymentModal", () => ({
  ConfirmPaymentModal: () => null,
}))
// Syntax-highlighter language modules are ESM-only; stub them out.
vi.mock("react-syntax-highlighter/dist/esm/languages/prism/csharp", () => ({ default: {} }))
vi.mock("react-syntax-highlighter/dist/esm/languages/prism/javascript", () => ({ default: {} }))
vi.mock("react-syntax-highlighter/dist/esm/languages/prism/typescript", () => ({ default: {} }))
vi.mock("react-syntax-highlighter/dist/esm/languages/prism/python", () => ({ default: {} }))

// Lightweight TicketChat stub: exposes exactly the composer surface the page
// wires up (controlled input, send button, error banner slot).
vi.mock("@/components/ticket-chat/ticket-chat", () => ({
  TicketChat: (props: {
    message: string
    onMessageChange: (value: string) => void
    onSend: () => void
    sendDisabled?: boolean
    errorBanner?: React.ReactNode
  }) => (
    <div>
      <input
        aria-label="Message"
        value={props.message}
        onChange={(e) => props.onMessageChange(e.target.value)}
      />
      <button onClick={() => props.onSend()} disabled={props.sendDisabled}>
        Send
      </button>
      {props.errorBanner}
    </div>
  ),
}))

import UserSupportChatPage from "./page"

const TICKET = {
  id: "ticket-1",
  title: "Help me please",
  description: "Help me please",
}

function typeAndSend(text: string) {
  fireEvent.change(screen.getByLabelText("Message"), {
    target: { value: text },
  })
  fireEvent.click(screen.getByRole("button", { name: "Send" }))
}

describe("UserSupportChatPage retry flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.functionsInvoke.mockResolvedValue({ data: null, error: null })
    h.ensureParticipantMutateAsync.mockResolvedValue({})
    h.sendMessageMutateAsync.mockResolvedValue({})
  })

  it("shows the error state and preserves the input when ticket creation fails", async () => {
    h.createTicketMutateAsync.mockRejectedValueOnce(new Error("network down"))

    render(<UserSupportChatPage />)
    typeAndSend("Help me please")

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      "Your message wasn't sent — we couldn't create your ticket.",
    )
    // The typed message stays in the composer so the user can simply retry.
    expect(screen.getByLabelText("Message")).toHaveValue("Help me please")
    expect(h.createTicketMutateAsync).toHaveBeenCalledTimes(1)
    expect(h.createTicketMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "proj-1",
        description: "Help me please",
        created_by: "user-1",
      }),
    )
    // Nothing downstream ran.
    expect(h.ensureParticipantMutateAsync).not.toHaveBeenCalled()
    expect(h.sendMessageMutateAsync).not.toHaveBeenCalled()
  })

  it("re-attempts ticket creation on Retry and clears the error on success", async () => {
    h.createTicketMutateAsync
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(TICKET)

    render(<UserSupportChatPage />)
    typeAndSend("Help me please")
    await screen.findByRole("alert")

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() =>
      expect(h.createTicketMutateAsync).toHaveBeenCalledTimes(2),
    )
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    )
    // The first message was persisted against the newly created ticket.
    expect(h.ensureParticipantMutateAsync).toHaveBeenCalledWith({
      ticketId: "ticket-1",
      participantId: "user-1",
      claimed: false,
    })
    expect(h.sendMessageMutateAsync).toHaveBeenCalledWith({
      ticket_id: "ticket-1",
      sender_id: "user-1",
      sender_type: "user",
      content: "Help me please",
    })
    expect(screen.getByLabelText("Message")).toHaveValue("")
  })

  it("does not create a duplicate ticket on Retry when the ticket was already created", async () => {
    h.createTicketMutateAsync.mockResolvedValueOnce(TICKET)
    // The ticket is created, but persisting the first message fails once.
    h.sendMessageMutateAsync
      .mockRejectedValueOnce(new Error("insert failed"))
      .mockResolvedValueOnce({})

    render(<UserSupportChatPage />)
    typeAndSend("Help me please")

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      "Your ticket was created, but your message couldn't be sent.",
    )
    // The message is put back in the composer for the retry.
    expect(screen.getByLabelText("Message")).toHaveValue("Help me please")
    expect(h.createTicketMutateAsync).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() =>
      expect(h.sendMessageMutateAsync).toHaveBeenCalledTimes(2),
    )
    // Retry reused the stored ticket id — no second createTicket call.
    expect(h.createTicketMutateAsync).toHaveBeenCalledTimes(1)
    expect(h.sendMessageMutateAsync).toHaveBeenLastCalledWith({
      ticket_id: "ticket-1",
      sender_id: "user-1",
      sender_type: "user",
      content: "Help me please",
    })
    // ensureParticipant is idempotent and re-ran as part of the retry.
    expect(h.ensureParticipantMutateAsync).toHaveBeenLastCalledWith({
      ticketId: "ticket-1",
      participantId: "user-1",
      claimed: false,
    })
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText("Message")).toHaveValue("")
  })
})
