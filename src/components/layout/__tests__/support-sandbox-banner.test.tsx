import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const useProjectBySlug = vi.fn()
const useProject = vi.fn()
vi.mock("@/hooks/useProject", () => ({
  useProjectBySlug: (slug: string) => useProjectBySlug(slug),
  useProject: (id: string) => useProject(id),
}))

import { SupportSandboxBanner } from "../support-sandbox-banner"

describe("SupportSandboxBanner", () => {
  it("renders the sandbox warning when the slug-resolved project is sandbox", () => {
    useProjectBySlug.mockReturnValue({ data: { sandbox: true, name: "Acme" } })
    useProject.mockReturnValue({ data: null })
    render(<SupportSandboxBanner slug="acme" projectId={null} />)
    expect(screen.getByText(/sandbox/i)).toBeInTheDocument()
  })

  it("renders nothing when the resolved project is not sandbox", () => {
    useProjectBySlug.mockReturnValue({ data: { sandbox: false, name: "Acme" } })
    useProject.mockReturnValue({ data: null })
    const { container } = render(<SupportSandboxBanner slug="acme" projectId={null} />)
    expect(container.firstChild).toBeNull()
  })

  it("falls back to the project-id lookup when no slug is provided", () => {
    useProjectBySlug.mockReturnValue({ data: null })
    useProject.mockReturnValue({ data: { sandbox: true, name: "Acme" } })
    render(<SupportSandboxBanner slug={null} projectId="proj-1" />)
    expect(screen.getByText(/sandbox/i)).toBeInTheDocument()
  })
})
