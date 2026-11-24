import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const usePathname = vi.fn()
const useSearchParams = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useSearchParams: () => useSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}))

const useUser = vi.fn()
vi.mock("@/contexts/user-context", () => ({
  useUser: () => useUser(),
}))

// SignInLink has its own redirect logic (covered in sign-in-link.test.tsx);
// here we only assert where the sidebar renders it.
vi.mock("@/components/auth/sign-in-link", () => ({
  SignInLink: ({
    redirectTo,
    children,
    ...props
  }: React.PropsWithChildren<{ redirectTo: string } & Record<string, unknown>>) => (
    <a data-testid="sign-in-link" href={`/auth/signin?redirect=${redirectTo}`} {...props}>
      {children}
    </a>
  ),
}))

import { PublicSupportSidebar } from "../public-support-sidebar"

const signedInUser = {
  id: "user-1",
  name: "Test User",
  role: "user",
  avatar: "T",
  avatarUrl: null,
}

const anonymousUser = {
  id: undefined,
  name: "Incognito",
  role: "user",
  avatar: "I",
  avatarUrl: null,
}

const renderSidebar = () =>
  render(<PublicSupportSidebar activeTab="Get support" onTabChange={() => {}} />)

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  usePathname.mockReturnValue("/support/acme")
  useSearchParams.mockReturnValue(new URLSearchParams())
})

describe("PublicSupportSidebar — signed out", () => {
  beforeEach(() => {
    useUser.mockReturnValue({ user: anonymousUser })
  })

  it("renders the logo, the guest avatar and 'Incognito'", () => {
    const { container } = renderSidebar()

    expect(container.querySelector("[data-slot='sidebar-logo'] svg")).not.toBeNull()
    expect(container.querySelector("[data-slot='guest-avatar']")).not.toBeNull()
    expect(screen.getByText("Incognito")).toBeInTheDocument()
  })

  it("places the Sign in link after the nav and before the profile block", () => {
    const { container } = renderSidebar()

    const nav = container.querySelector("nav")!
    const signIn = screen.getByRole("link", { name: "Sign in" })
    const profile = screen.getByText("Incognito")

    expect(nav.contains(signIn)).toBe(false)
    expect(nav.compareDocumentPosition(signIn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(signIn.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe("PublicSupportSidebar — signed in", () => {
  beforeEach(() => {
    useUser.mockReturnValue({ user: signedInUser })
  })

  it("renders the logo, the avatar and the user name, without a role or Sign in", () => {
    const { container } = renderSidebar()

    expect(container.querySelector("[data-slot='sidebar-logo'] svg")).not.toBeNull()
    expect(container.querySelector("[data-slot='avatar']")).not.toBeNull()
    expect(container.querySelector("[data-slot='guest-avatar']")).toBeNull()
    expect(screen.getByText("Test User")).toBeInTheDocument()

    expect(screen.queryByText(/Role:/)).not.toBeInTheDocument()
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument()
    expect(screen.queryByTestId("sign-in-link")).not.toBeInTheDocument()
  })
})
