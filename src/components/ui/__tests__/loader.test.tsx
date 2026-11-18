import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Loader } from "../loader"

describe("Loader", () => {
  it("is an image named 'Loading' at 32px by default", () => {
    render(<Loader />)
    const svg = screen.getByRole("img", { name: "Loading" })
    expect(svg).toHaveAttribute("width", "32")
    expect(svg).toHaveAttribute("height", "32")
    expect(svg).toHaveAttribute("data-slot", "loader")
  })

  it("takes a size, a label and extra classes", () => {
    render(<Loader size={24} label="Loading projects" className="text-brand-primary" />)
    const svg = screen.getByRole("img", { name: "Loading projects" })
    expect(svg).toHaveAttribute("width", "24")
    expect(svg).toHaveAttribute("height", "24")
    expect(svg.getAttribute("class")).toMatch(/githelp-loader/)
    expect(svg.getAttribute("class")).toMatch(/text-brand-primary/)
  })

  it("gives each instance its own mask id and points the disc at it", () => {
    const { container } = render(
      <>
        <Loader />
        <Loader />
      </>
    )
    const masks = Array.from(container.querySelectorAll("mask"))
    expect(masks).toHaveLength(2)
    expect(masks[0].id).not.toBe(masks[1].id)
    masks.forEach((mask) => {
      const disc = mask.parentElement?.querySelector(":scope > circle")
      expect(disc).toHaveAttribute("mask", `url(#${mask.id})`)
    })
  })

  it("delays its appearance and stops orbiting under reduced motion", () => {
    const { container } = render(<Loader />)
    const css = container.querySelector("style")?.textContent ?? ""
    expect(css).toMatch(/githelp-loader-in 150ms ease-out 180ms both/)
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.githelp-loader-dots \{ animation: none; \} \}/)
  })
})
