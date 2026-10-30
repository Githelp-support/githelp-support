import { describe, it, expect } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { GuestAdoptionConfirmDialog } from "./guest-adoption-confirm-dialog"
import { requestGuestAdoptionConfirm } from "@/lib/guest-adoption-confirm"
import type { GuestAdoptionChoice } from "@/lib/guest-adoption"

const tickets = [{ id: "t1", title: "Build fails", project_name: "Acme", status: "available", created_at: "" }]

function open(): Promise<GuestAdoptionChoice> {
  let pending!: Promise<GuestAdoptionChoice>
  act(() => {
    pending = requestGuestAdoptionConfirm(tickets, "ada@example.com")
  })
  return pending
}

describe("GuestAdoptionConfirmDialog", () => {
  it("lists the conversations, names the target account, and links on confirm", async () => {
    render(<GuestAdoptionConfirmDialog />)
    const pending = open()
    expect(screen.getByText("Link your guest conversation to this account?")).toBeInTheDocument()
    expect(screen.getByText("Build fails — Acme")).toBeInTheDocument()
    expect(screen.getByText("ada@example.com")).toBeInTheDocument()
    expect(screen.getByText(/Linking to:/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Link to my account" }))
    await expect(pending).resolves.toBe("link")
    expect(screen.queryByText("Link your guest conversation to this account?")).not.toBeInTheDocument()
  })

  it("discards only via 'Not mine — discard'", async () => {
    render(<GuestAdoptionConfirmDialog />)
    const pending = open()
    fireEvent.click(screen.getByRole("button", { name: "Not mine — discard" }))
    await expect(pending).resolves.toBe("discard")
  })

  it("Escape is 'ask me later', not a discard", async () => {
    render(<GuestAdoptionConfirmDialog />)
    const pending = open()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    await expect(pending).resolves.toBe("later")
  })
})
