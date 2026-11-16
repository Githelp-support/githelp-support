"use client"

import { useState } from "react"

import { ImageUploadModal } from "@/components/modals/image-upload-modal"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import { useUser } from "@/contexts/user-context"
import { useUpdateUserProfile } from "@/hooks/useHelpers"
import { supabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

/** Public bucket, one object per user at `{userId}/avatar` (backend migration 20261116120000_users_public_avatar_bucket). */
const AVATAR_BUCKET = "users_public"

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

  // Custom uploader: the modal awaits it, so a failed upload or a failed
  // profile update gives one error toast and no success toast. The path has
  // no extension, so a PNG replaced by a JPEG overwrites the same object.
  const uploadAvatar = async (file: File) => {
    const path = `${userId}/avatar`
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" })
    if (error) throw error

    // The public URL never changes: bust the cache or the old image keeps showing.
    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
    const bustedUrl = `${data.publicUrl}?v=${Date.now()}`

    await updateProfile.mutateAsync({ userId, updates: { avatar_url: bustedUrl } })
    return bustedUrl
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
        uploadFile={uploadAvatar}
        onUploadComplete={(url) => setUser({ ...user, avatarUrl: url })}
        title="Upload profile photo"
        description="Upload a photo for your profile. It is shown next to your name across the app."
        maxFileSizeMB={6}
        acceptedFileTypes={["image/png", "image/jpeg", "image/gif", "image/webp"]}
        currentImageUrl={avatarUrl}
      />
    </div>
  )
}
