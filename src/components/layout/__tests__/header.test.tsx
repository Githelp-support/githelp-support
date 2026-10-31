import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  usePathname: () => "/helpers",
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))
vi.mock("@/contexts/user-context", () => ({ useUser: () => ({ setProjectRole: vi.fn() }) }))
vi.mock("@/contexts/project-context", () => ({ useProjectSelection: () => ({ selectedProjectId: null }) }))
vi.mock("@/hooks/useProjectRole", () => ({ useProjectRole: () => ({ data: undefined }) }))
vi.mock("@/contexts/unsaved-changes-context", () => ({
  useUnsavedChanges: () => ({ confirmNavigation: (fn: () => void) => fn() }),
}))

import { Header } from "../header"

describe("Header", () => {
  it("renders the title and subtitle with the page-title type", () => {
    render(<Header title="Helpers" subtitle="Manage your support team" />)
    const title = screen.getByRole("heading", { level: 1, name: "Helpers" })
    expect(title.className).toMatch(/text-title/)
    expect(screen.getByText("Manage your support team").className).toMatch(/text-ui/)
  })

  it("renders page actions right-aligned in the header", () => {
    render(<Header title="Helpers" actions={<button type="button">Add helper</button>} />)
    const action = screen.getByRole("button", { name: "Add helper" })
    expect(screen.getByRole("banner")).toContainElement(action)
  })

  it("separates the header from the content with a hairline", () => {
    render(<Header title="Helpers" />)
    expect(screen.getByRole("banner").className).toMatch(/border-b/)
  })
})
