import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))

const toastError = vi.fn()
const toastSuccess = vi.fn()
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}))

type ModalProps = {
  open: boolean
  storagePath?: string
  title?: string
  maxFileSizeMB?: number
  acceptedFileTypes?: string[]
  currentImageUrl?: string | null
  onUploadComplete: (url: string) => void
}
const modalProps = vi.fn()
vi.mock("@/components/modals/image-upload-modal", () => ({
  ImageUploadModal: (props: ModalProps) => {
    modalProps(props)
    return props.open ? (
      <button type="button" onClick={() => props.onUploadComplete("https://cdn.test/avatar.png")}>
        Finish upload
      </button>
    ) : null
  },
}))

const setUser = vi.fn()
const contextUser = {
  id: "user-1",
  name: "Ada Lovelace",
  role: "helper" as const,
  avatar: "A",
  avatarUrl: null as string | null,
}
vi.mock("@/contexts/user-context", () => ({
  useUser: () => ({ user: contextUser, setUser }),
}))

const mutateAsync = vi.fn()
vi.mock("@/hooks/useHelpers", () => ({
  useUpdateUserProfile: () => ({ mutateAsync }),
}))

import { ProfileAvatarEditor } from "./profile-avatar-editor"

const NOW = 1_700_000_000_000
const BUSTED_URL = `https://cdn.test/avatar.png?v=${NOW}`

describe("ProfileAvatarEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutateAsync.mockResolvedValue({})
    vi.spyOn(Date, "now").mockReturnValue(NOW)
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("labels the button 'Upload photo' when there is no avatar", () => {
    render(<ProfileAvatarEditor userId="user-1" name="Ada Lovelace" avatarUrl={null} />)

    expect(screen.getByRole("button", { name: "Upload photo" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Change photo" })).not.toBeInTheDocument()
    // Fallback initial from ProfileAvatar.
    expect(screen.getByText("A")).toBeInTheDocument()
  })

  it("labels the button 'Change photo' when an avatar exists", () => {
    render(
      <ProfileAvatarEditor userId="user-1" name="Ada Lovelace" avatarUrl="https://cdn.test/old.png" />
    )

    expect(screen.getByRole("button", { name: "Change photo" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Upload photo" })).not.toBeInTheDocument()
  })

  it("configures the upload modal for the user's avatar path", () => {
    render(
      <ProfileAvatarEditor userId="user-1" name="Ada Lovelace" avatarUrl="https://cdn.test/old.png" />
    )

    expect(modalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: false,
        storagePath: "users_public/user-1/avatar",
        title: "Upload profile photo",
        maxFileSizeMB: 6,
        acceptedFileTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
        currentImageUrl: "https://cdn.test/old.png",
      })
    )
  })

  it("saves the cache-busted URL and updates the user context after an upload", async () => {
    render(<ProfileAvatarEditor userId="user-1" name="Ada Lovelace" avatarUrl={null} />)

    fireEvent.click(screen.getByRole("button", { name: "Upload photo" }))
    fireEvent.click(screen.getByRole("button", { name: "Finish upload" }))

    await waitFor(() => {
      expect(setUser).toHaveBeenCalledWith({ ...contextUser, avatarUrl: BUSTED_URL })
    })
    expect(mutateAsync).toHaveBeenCalledWith({
      userId: "user-1",
      updates: { avatar_url: BUSTED_URL },
    })
    // The modal shows the success toast; the editor adds none of its own.
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("shows an error toast and leaves the user context alone when the update fails", async () => {
    mutateAsync.mockRejectedValue(new Error("nope"))
    render(<ProfileAvatarEditor userId="user-1" name="Ada Lovelace" avatarUrl={null} />)

    fireEvent.click(screen.getByRole("button", { name: "Upload photo" }))
    fireEvent.click(screen.getByRole("button", { name: "Finish upload" }))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Failed to update profile photo. Please try again.")
    })
    expect(setUser).not.toHaveBeenCalled()
  })
})
