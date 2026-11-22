import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const upload = vi.fn()
const getPublicUrl = vi.fn()
const from = vi.fn((_bucket: string) => ({ upload, getPublicUrl }))
vi.mock("@/lib/supabase/client", () => ({
  supabase: { storage: { from: (bucket: string) => from(bucket) } },
}))

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
  uploadFile?: (file: File) => Promise<string>
}
const FILE = new File(["x"], "me.jpg", { type: "image/jpeg" })
const modalProps = vi.fn()
const modalError = vi.fn()
vi.mock("@/components/modals/image-upload-modal", () => ({
  ImageUploadModal: (props: ModalProps) => {
    modalProps(props)
    return props.open ? (
      <button
        type="button"
        onClick={async () => {
          // Like the real modal: await the uploader, complete only on success.
          try {
            props.onUploadComplete(await props.uploadFile!(FILE))
          } catch (error) {
            modalError(error)
          }
        }}
      >
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
const BUSTED_URL = `https://cdn.test/avatar?v=${NOW}`

describe("ProfileAvatarEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutateAsync.mockResolvedValue({})
    upload.mockResolvedValue({ error: null })
    getPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn.test/avatar" } })
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

  it("configures the upload modal with a custom uploader", () => {
    render(
      <ProfileAvatarEditor userId="user-1" name="Ada Lovelace" avatarUrl="https://cdn.test/old.png" />
    )

    expect(modalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: false,
        uploadFile: expect.any(Function),
        title: "Upload profile photo",
        maxFileSizeMB: 6,
        acceptedFileTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
        currentImageUrl: "https://cdn.test/old.png",
      })
    )
  })

  it("uploads to the user's avatar path, saves the cache-busted URL and updates the user context", async () => {
    render(<ProfileAvatarEditor userId="user-1" name="Ada Lovelace" avatarUrl={null} />)

    fireEvent.click(screen.getByRole("button", { name: "Upload photo" }))
    fireEvent.click(screen.getByRole("button", { name: "Finish upload" }))

    await waitFor(() => {
      expect(setUser).toHaveBeenCalledWith({ ...contextUser, avatarUrl: BUSTED_URL })
    })
    expect(from).toHaveBeenCalledWith("users_public")
    // No extension in the path: a new file type overwrites the same object.
    expect(upload).toHaveBeenCalledWith("user-1/avatar", FILE, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "3600",
    })
    expect(mutateAsync).toHaveBeenCalledWith({
      userId: "user-1",
      updates: { avatar_url: BUSTED_URL },
    })
    // The modal owns the toasts; the editor adds none of its own.
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("rejects the upload without touching the profile when storage fails", async () => {
    const storageError = new Error("Bucket not found")
    upload.mockResolvedValue({ error: storageError })
    render(<ProfileAvatarEditor userId="user-1" name="Ada Lovelace" avatarUrl={null} />)

    fireEvent.click(screen.getByRole("button", { name: "Upload photo" }))
    fireEvent.click(screen.getByRole("button", { name: "Finish upload" }))

    await waitFor(() => expect(modalError).toHaveBeenCalledWith(storageError))
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(setUser).not.toHaveBeenCalled()
  })

  it("rejects the upload and leaves the user context alone when the profile update fails", async () => {
    const updateError = new Error("nope")
    mutateAsync.mockRejectedValue(updateError)
    render(<ProfileAvatarEditor userId="user-1" name="Ada Lovelace" avatarUrl={null} />)

    fireEvent.click(screen.getByRole("button", { name: "Upload photo" }))
    fireEvent.click(screen.getByRole("button", { name: "Finish upload" }))

    // The modal turns the rejection into its single error toast (no success toast).
    await waitFor(() => expect(modalError).toHaveBeenCalledWith(updateError))
    expect(setUser).not.toHaveBeenCalled()
  })
})
