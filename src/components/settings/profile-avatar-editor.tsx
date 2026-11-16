"use client"

import { useState } from "react"
import { toast } from "sonner"

import { ImageUploadModal } from "@/components/modals/image-upload-modal"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import { useUser } from "@/contexts/user-context"
import { useUpdateUserProfile } from "@/hooks/useHelpers"
import { cn } from "@/lib/utils"

export interface ProfileAvatarEditorProps {
  userId: string
  name: string | null
  avatarUrl: string | null
  className?: string
}

/**
 * Profile photo with an upload control. The upload saves immediately (like
 * the project logo), so it never takes part in a page's unsaved-changes state.
 */
export function ProfileAvatarEditor({ userId, name, avatarUrl, className }: ProfileAvatarEditorProps) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const { user, setUser } = useUser()
  const updateProfile = useUpdateUserProfile()

  const hasAvatar = typeof avatarUrl === "string" && avatarUrl.length > 0

  const handleUploadComplete = async (url: string) => {
    // The upload upserts to the same path, so the public URL is unchanged:
    // bust the cache or the old image keeps showing.
    const bustedUrl = `${url}?v=${Date.now()}`

    try {
      await updateProfile.mutateAsync({ userId, updates: { avatar_url: bustedUrl } })
      setUser({ ...user, avatarUrl: bustedUrl })
    } catch (error) {
      console.error("Failed to update profile photo:", error)
      toast.error("Failed to update profile photo. Please try again.")
    }
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <ProfileAvatar id={userId} name={name} avatarUrl={avatarUrl} size="lg" />
      <Button type="button" variant="outline" size="sm" onClick={() => setIsUploadModalOpen(true)}>
        <Icon name="fi-rr-edit" />
        {hasAvatar ? "Change photo" : "Upload photo"}
      </Button>

      <ImageUploadModal
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        storagePath={`users_public/${userId}/avatar`}
        onUploadComplete={handleUploadComplete}
        title="Upload profile photo"
        description="Upload a photo for your profile. It is shown next to your name across the app."
        maxFileSizeMB={6}
        acceptedFileTypes={["image/png", "image/jpeg", "image/gif", "image/webp"]}
        currentImageUrl={avatarUrl}
      />
    </div>
  )
}
