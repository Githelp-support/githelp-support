import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import type { RepoContributor } from "@/hooks/useProject"

const mocks = vi.hoisted(() => ({
  createInvite: vi.fn(),
  addSelf: vi.fn(),
  useUser: vi.fn(),
  useCurrentHelper: vi.fn(),
  useListRepoContributors: vi.fn(),
}))

// The page switches steps through the `step` search param, so the navigation
// mock is a tiny store: `router.push` writes the query and `useSearchParams`
// re-renders with it, like the real router does.
const nav = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const store = {
    query: "",
    pathname: "/projects/proj-1/invite-contributors",
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    push: vi.fn((url: string) => {
      const index = url.indexOf("?")
      store.query = index === -1 ? "" : url.slice(index + 1)
      listeners.forEach((listener) => listener())
    }),
    reset() {
      store.query = ""
    },
  }
  return store
})

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react")
  return {
    useParams: () => ({ id: "proj-1" }),
    usePathname: () => nav.pathname,
    useRouter: () => ({ push: nav.push, replace: vi.fn() }),
    useSearchParams: () => {
      const query = useSyncExternalStore(nav.subscribe, () => nav.query, () => nav.query)
      return new URLSearchParams(query)
    },
  }
})

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: Omit<ComponentProps<"a">, "href"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// next/image refuses hosts missing from next.config in jsdom.
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const SESSION = {
  provider_token: "gh-token",
  user: {
    id: "user-1",
    app_metadata: { providers: ["github"] },
    user_metadata: {},
    identities: [{ provider: "github", identity_data: { user_name: "octocat" } }],
  },
}
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: SESSION } })) },
  },
}))

vi.mock("@/hooks/useProject", () => ({
  useProject: () => ({ data: { id: "proj-1", name: "Project" }, isLoading: false }),
  useGetProjectRepo: () => ({ data: "org/repo" }),
  useListRepoContributors: (...args: unknown[]) => mocks.useListRepoContributors(...args),
  useCreateProjectInvite: () => ({ mutateAsync: mocks.createInvite, isPending: false }),
}))
vi.mock("@/hooks/useProjectRole", () => ({
  useProjectRole: () => ({ data: "admin", isLoading: false }),
}))
vi.mock("@/hooks/useHelpers", () => ({
  useAddSelfAsHelper: () => ({ mutateAsync: mocks.addSelf, isPending: false }),
}))
vi.mock("@/hooks/useCurrentHelper", () => ({
  useCurrentHelper: (projectId?: string) => mocks.useCurrentHelper(projectId),
}))
vi.mock("@/contexts/user-context", () => ({ useUser: mocks.useUser }))

import InviteContributorsPage from "./page"

const contributor = (login: string, contributions: number): RepoContributor => ({
  login,
  id: contributions,
  avatar_url: `https://avatars.githubusercontent.com/u/${contributions}`,
  contributions,
  html_url: `https://github.com/${login}`,
})

const CONTRIBUTORS = [
  contributor("alice", 42),
  contributor("bob", 17),
  contributor("octocat", 5),
]

const searchBox = () => screen.findByLabelText("Search contributors")
const rowButton = (login: string) =>
  screen.getByRole("button", { name: new RegExp(`^${login} ${login}`) })
const selectedCount = () => screen.getByText(/\d+ selected$/).textContent

async function renderPage() {
  render(<InviteContributorsPage />)
  // Contributors only render once the GitHub session has been read.
  await searchBox()
}

async function inviteAlice() {
  await renderPage()
  fireEvent.click(rowButton("alice"))
  fireEvent.click(screen.getByRole("button", { name: "Invite 1 as helpers" }))
  await screen.findByText("Invite links")
}

describe("InviteContributorsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nav.reset()
    mocks.useUser.mockReturnValue({
      user: { id: "user-1", name: "Octo Cat", role: "admin", avatar: "O", avatarUrl: null },
    })
    mocks.useCurrentHelper.mockReturnValue({ data: null })
    mocks.useListRepoContributors.mockReturnValue({ data: CONTRIBUTORS, isLoading: false })
    mocks.createInvite.mockImplementation(async ({ github_username }: { github_username: string }) => ({
      token: `tok-${github_username}`,
      invite_url: `https://app.test/invite/tok-${github_username}`,
    }))
    mocks.addSelf.mockResolvedValue({ helper_id: "helper-1" })
  })

  it("tells admins they can also invite from the Helpers page", async () => {
    await renderPage()
    expect(
      screen.getByText("From the Helpers page you can also invite helpers using email or invite link.")
    ).toBeInTheDocument()
    // Plain text only: no link that would navigate away from the onboarding flow.
    expect(screen.queryByRole("link", { name: "Helpers page" })).not.toBeInTheDocument()
    // The original description is untouched.
    expect(
      screen.getByText(/Select top contributors from org\/repo to invite as helpers/)
    ).toBeInTheDocument()
  })

  it("filters rows by search and 'Select all' only selects the visible ones", async () => {
    await renderPage()
    expect(screen.getByText("alice")).toBeInTheDocument()
    expect(screen.getByText("bob")).toBeInTheDocument()

    fireEvent.change(await searchBox(), { target: { value: "ali" } })
    expect(screen.getByText("alice")).toBeInTheDocument()
    expect(screen.queryByText("bob")).not.toBeInTheDocument()
    expect(screen.queryByText("octocat")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Select all" }))
    expect(selectedCount()).toBe("1 selected")
    expect(screen.getByRole("button", { name: "Deselect all" })).toBeInTheDocument()

    // Clearing the search reveals the hidden rows, still unselected.
    fireEvent.change(await searchBox(), { target: { value: "" } })
    expect(selectedCount()).toBe("1 selected")
    expect(screen.getByRole("button", { name: "Invite 1 as helpers" })).toBeInTheDocument()
    // With bob and octocat visible and unselected, the toggle offers to select them.
    expect(screen.getByRole("button", { name: "Select all" })).toBeInTheDocument()

    fireEvent.change(await searchBox(), { target: { value: "nobody" } })
    expect(screen.getByText(/No contributors match/)).toHaveTextContent("nobody")
    expect(screen.getByRole("button", { name: "Select all" })).toBeDisabled()
  })

  it("adds the signed-in user as a helper directly instead of creating an invite", async () => {
    await renderPage()
    const selfRow = rowButton("octocat")
    expect(within(selfRow).getByText("You")).toBeInTheDocument()
    fireEvent.click(selfRow)

    fireEvent.click(screen.getByRole("button", { name: "Add myself as helper" }))

    await waitFor(() =>
      expect(mocks.addSelf).toHaveBeenCalledWith({
        project_id: "proj-1",
        user_id: "user-1",
        category: "core",
      })
    )
    expect(mocks.createInvite).not.toHaveBeenCalled()
    // No invite link was produced, so the page stays on the contributors step.
    expect(nav.push).not.toHaveBeenCalled()
    expect(screen.getByText("Invite contributors as helpers")).toBeInTheDocument()
    // The row is done: disabled like an invited one and no longer selected.
    expect(rowButton("octocat")).toBeDisabled()
    expect(selectedCount()).toBe("0 selected")
  })

  it("shows the links step after inviting and keeps the links when moving between steps", async () => {
    await inviteAlice()
    expect(mocks.createInvite).toHaveBeenCalledWith({
      project_id: "proj-1",
      invite_type: "helper",
      category: "core",
      github_username: "alice",
    })
    expect(nav.push).toHaveBeenCalledWith("/projects/proj-1/invite-contributors?step=links", {
      scroll: false,
    })
    expect(screen.getByText("https://app.test/invite/tok-alice")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Back to contributors" }))
    expect(nav.push).toHaveBeenLastCalledWith("/projects/proj-1/invite-contributors", { scroll: false })
    expect(screen.getByText("Invite contributors as helpers")).toBeInTheDocument()
    expect(screen.queryByText("https://app.test/invite/tok-alice")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "View invite links (1)" }))
    expect(screen.getByText("Invite links")).toBeInTheDocument()
    expect(screen.getByText("alice")).toBeInTheDocument()
    expect(screen.getByText("https://app.test/invite/tok-alice")).toBeInTheDocument()
  })

  it("offers the project dashboard, not the Helpers page, once someone was invited", async () => {
    await renderPage()
    expect(screen.getByRole("link", { name: "Add helpers later" })).toHaveAttribute("href", "/")
    expect(screen.queryByRole("link", { name: "Go to Helpers" })).not.toBeInTheDocument()

    fireEvent.click(rowButton("alice"))
    fireEvent.click(screen.getByRole("button", { name: "Invite 1 as helpers" }))
    await screen.findByText("Invite links")

    expect(screen.queryByRole("link", { name: "Go to Helpers" })).not.toBeInTheDocument()
    expect(screen.queryByText("Go to Helpers")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go to project dashboard" })).toHaveAttribute("href", "/")
  })
})
