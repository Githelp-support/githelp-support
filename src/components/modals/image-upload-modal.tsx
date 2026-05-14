"use client"

import { useState, useRef } from "react"
import { Upload, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"

interface ImageUploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  storagePath: string // e.g., "bucketName/path/to/file" or "ticket-attachments/{projectId}/{ticketId}/{filename}"
  onUploadComplete: (url: string) => void
  title?: string
  description?: string
  maxFileSizeMB?: number
  acceptedFileTypes?: string[]
  currentImageUrl?: string | null
  /** Set to true when the target bucket is private — uses a signed URL instead of a public URL */
  privateBucket?: boolean
}

export function ImageUploadModal({
  open,
  onOpenChange,
  storagePath,
  onUploadComplete,
  title = "Upload Image",
  description = "Select an image file to upload",
  maxFileSizeMB = 6, // Default 6MB based on bucket limit
  acceptedFileTypes = ["image/*"],
  currentImageUrl,
  privateBucket = false,
}: ImageUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const isValidType = acceptedFileTypes.some((type) => {
      if (type.endsWith("/*")) {
        const baseType = type.split("/")[0]
        return file.type.startsWith(baseType + "/")
      }
      return file.type === type
    })

    if (!isValidType) {
      toast.error(`Invalid file type. Accepted types: ${acceptedFileTypes.join(", ")}`)
      return
    }

    // Validate file size
    const maxSizeBytes = maxFileSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      toast.error(`File size must be less than ${maxFileSizeMB}MB`)
      return
    }

    setSelectedFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first")
      return
    }

    setIsUploading(true)

    try {
      // Extract bucket name and file path from storagePath
      // Format: "bucketName/path/to/file" or "bucketName/path/to/file.ext"
      const [bucketName, ...pathParts] = storagePath.split("/")
      let filePath = pathParts.join("/")

      if (!bucketName || !filePath) {
        throw new Error("Invalid storage path format. Expected: 'bucketName/path/to/file'")
      }

      // If storagePath doesn't have an extension, use the file's extension
      if (!filePath.includes(".") || filePath.endsWith(".")) {
        const fileExtension = selectedFile.name.split(".").pop() || "png"
        filePath = `${filePath}.${fileExtension}`
      }

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, selectedFile, {
          upsert: true, // Replace if exists
		  cacheControl: "3600",
        })

      if (uploadError) {
        console.error("Upload error:", uploadError)
        toast.error("Failed to upload image. Please try again.")
        return
      }

      // Get URL — signed for private buckets, public for public buckets
      let fileUrl: string
      if (privateBucket) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(filePath, 60 * 60) // 1 hour
        if (signedError || !signedData?.signedUrl) {
          console.error("Signed URL error:", signedError)
          toast.error("Failed to retrieve upload URL. Please try again.")
          return
        }
        fileUrl = signedData.signedUrl
      } else {
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath)
        fileUrl = urlData.publicUrl
      }

      // Call the completion callback
      onUploadComplete(fileUrl)

      toast.success("Image uploaded successfully!")
      
      // Reset state and close modal
      setSelectedFile(null)
      setPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to upload image:", error)
      toast.error("Failed to upload image. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = () => {
    setSelectedFile(null)
    setPreview(currentImageUrl || null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFile(null)
      setPreview(currentImageUrl || null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="flex items-center justify-center">
            {preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview is blob URL, not static asset */}
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-64 max-w-full rounded-lg border border-border object-contain"
                />
                {selectedFile && (
                  <button
                    onClick={handleRemove}
                    className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No image selected</p>
                </div>
              </div>
            )}
          </div>

          {/* File Input */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedFileTypes.join(",")}
              onChange={handleFileSelect}
              className="hidden"
              id="image-upload-input"
              disabled={isUploading}
            />
            <label htmlFor="image-upload-input">
              <Button
                type="button"
                variant="outline"
                className="w-full cursor-pointer"
                disabled={isUploading}
                asChild
              >
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  {selectedFile ? "Change Image" : "Select Image"}
                </span>
              </Button>
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              Max file size: {maxFileSizeMB}MB. Accepted types: {acceptedFileTypes.join(", ")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
