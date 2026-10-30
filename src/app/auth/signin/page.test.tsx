import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

let search = new URLSearchParams()
// Stable like the real hooks (the page's effect depends on them).
const router = { push: vi.fn() }
const queryClient = { invalidateQueries: vi.fn() }
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => search,
}))
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => queryClient }))
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: "g1", is_anonymous: true } } } }),
    },
  },
}))
const prepareGuestAdoption = vi.fn(async () => true)
vi.mock("@/lib/guest-adoption", () => ({
  prepareGuestAdoption: () => prepareGuestAdoption(),
  runGuestAdoptionFlow: vi.fn(),
  adoptionLandingForRedirect: () => null,
}))
vi.mock("@/hooks/useGuestPresence", () => ({ useGuestSignInPresence: vi.fn() }))
vi.mock("@/components/auth/sign-in-options", () => ({ SignInOptions: () => <div>options</div> }))
vi.mock("@/components/brand/logo", () => ({ Logo: () => null }))

import SignInPage from "./page"
import { OWN_GUEST_ID_KEY } from "@/lib/guest-adoption-storage"

describe("/auth/signin — saving the guest key on open", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.localStorage.setItem(OWN_GUEST_ID_KEY, "g1")
  })

  it("saves our own guest's key when continuing a support conversation", async () => {
    search = new URLSearchParams("redirect=%2Fsupport%2Fchat%3Fticket%3Dt1&skipOnboarding=true")
    render(<SignInPage />)
    await screen.findByText("options")
    expect(prepareGuestAdoption).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Sign in to get help and follow your support conversations.")).toBeInTheDocument()
  })

  it("does not save it for other redirects (AuthGuard bounce on a shared computer)", async () => {
    search = new URLSearchParams("redirect=%2Ftickets")
    render(<SignInPage />)
    await screen.findByText("options")
    await waitFor(() => expect(prepareGuestAdoption).not.toHaveBeenCalled())
    expect(screen.getByText("Sign in to access your admin and helper dashboard")).toBeInTheDocument()
  })
})
