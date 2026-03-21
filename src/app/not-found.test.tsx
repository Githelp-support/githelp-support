import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import NotFound from "./not-found"

describe("NotFound", () => {
  it("renders page not found message and link to dashboard", () => {
    render(<NotFound />)
    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toHaveAttribute("href", "/")
  })
})
