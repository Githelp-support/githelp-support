import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { RepoSupportOverview } from "@/hooks/useUnlisted"

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
vi.mock("@/lib/supabase/auth", () => ({ signInWithGitHub: vi.fn() }))

const { replace, push, userState, overview, mutation } = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  userState: { user: { role: "user" } as { id?: string; role: string } },
  overview: { state: { isLoading: true, error: null } as { data?: unknown; isLoading: boolean; error: unknown } },
  mutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

vi.mock("@/contexts/user-context", () => ({ useUser: () => userState }))
vi.mock("@/components/brand/logo", () => ({ Logo: () => null }))
vi.mock("@/components/modals/sign-in-modal", () => ({
  SignInModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>sign-in-modal-open</div> : null),
}))
vi.mock("@/hooks/useEnterProject", () => ({ useEnterProject: () => vi.fn() }))
vi.mock("@/components/unlisted/github-verification", () => ({
  currentGithubToken: vi.fn(async () => null),
  startGithubVerification: vi.fn(async () => {}),
}))

vi.mock("@/hooks/useUnlisted", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useUnlisted")>()
  return {
    ...actual,
    useRepoOverview: () => overview.state,
    useRequestSupport: mutation,
    useApplyAsHelper: mutation,
    useClaimRepo: mutation,
  }
})

// Radix Switch measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

import { RepoDemand, describePricing } from "./repo-demand"

const base: RepoSupportOverview = {
  repo: "acme/widgets",
  status: "unclaimed",
  project: { project_id: "p1", slug: "widgets", name: "widgets" },
  requests: 3,
  pledged_smallest_unit: 15000,
  open_tickets: 1,
  independent_helpers: 2,
  pricing: { start_price: 1000, per_minute_first_60: 150, per_minute_after_60: 100 },
  outreach: { status: "posted", posted_url: "https://github.com/acme/widgets/discussions/1" },
}

describe("RepoDemand", () => {
  beforeEach(() => {
    replace.mockReset()
    userState.user = { role: "user" }
  })

  it("redirects a listed project to its support page", () => {
    overview.state = { data: { ...base, status: "listed" }, isLoading: false, error: null }
    render(<RepoDemand owner="acme" repo="widgets" />)
    expect(replace).toHaveBeenCalledWith("/support?slug=widgets")
  })

  it("shows demand, pledges, helpers and the posted invitation for an unclaimed project", () => {
    overview.state = { data: base, isLoading: false, error: null }
    render(<RepoDemand owner="acme" repo="widgets" />)
    expect(screen.getByTestId("demand-summary").textContent).toContain("3 developers want support for this project — $150.00 pledged")
    expect(screen.getByText(/2 independent experts vetted by GitHelp can help you now/)).toBeTruthy()
    expect(screen.getByText("see the invitation").getAttribute("href")).toBe(base.outreach?.posted_url)
  })

  it("invites the first request for an unknown repository", () => {
    overview.state = {
      data: { ...base, status: "unknown", project: null, requests: 0, pledged_smallest_unit: 0, independent_helpers: 0, outreach: { status: "none", posted_url: null } },
      isLoading: false,
      error: null,
    }
    render(<RepoDemand owner="acme" repo="widgets" />)
    expect(screen.getByTestId("demand-summary").textContent).toContain("Be the first to ask for support")
    expect(screen.queryByTestId("outreach-status")).toBeNull()
  })

  it("asks anonymous visitors to sign in before acting", () => {
    overview.state = { data: base, isLoading: false, error: null }
    render(<RepoDemand owner="acme" repo="widgets" />)
    fireEvent.click(screen.getByText("Get help now"))
    expect(screen.getByText("sign-in-modal-open")).toBeTruthy()
  })

  it("shows the help form to signed-in users", () => {
    userState.user = { id: "u1", role: "user" }
    overview.state = { data: base, isLoading: false, error: null }
    render(<RepoDemand owner="acme" repo="widgets" />)
    fireEvent.click(screen.getByText("Get help now"))
    expect(screen.getByRole("form", { name: "Get help" })).toBeTruthy()
  })

  it("describes default pricing", () => {
    expect(describePricing(base.pricing)).toContain("$10.00 to start, then $1.50/min")
    expect(describePricing({ start_price: 0, per_minute_first_60: 0, per_minute_after_60: 0 })).toBe("Free")
    expect(describePricing(null)).toBeNull()
  })
})
