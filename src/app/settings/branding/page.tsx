"use client"

import { useState } from "react"
import Image from "next/image"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUserProjects, useProjectBranding, useUpdateProjectBranding } from "@/hooks/useProject"
import { ImageUploadModal } from "@/components/modals/image-upload-modal"
import { toast } from "sonner"
import { useProjectSelection } from "@/contexts/project-context"

export default function BrandingSettingsPage() {
  const [editedColor, setEditedColor] = useState<string | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  const { selectedProjectId: projectId } = useProjectSelection()
  const { data: userProjects = [] } = useUserProjects()
  const project = userProjects.find((p) => p.project_id === projectId) || userProjects[0]

  // Fetch branding from database
  const { data: brandingData } = useProjectBranding(projectId || "")
  const updateBranding = useUpdateProjectBranding()

  const primaryColor = editedColor ?? brandingData?.primary_color ?? "#554abf"

  const handleLogoUploadComplete = async (url: string) => {
    if (!projectId) return

    try {
      await updateBranding.mutateAsync({
        projectId,
        updates: {
          logo_url: url,
        },
      })
      toast.success("Logo updated successfully!")
    } catch (error) {
      console.error("Failed to update logo:", error)
      toast.error("Failed to update logo. Please try again.")
    }
  }

  const handleSaveColor = async () => {
    if (!projectId) return

    try {
      await updateBranding.mutateAsync({
        projectId,
        updates: {
          primary_color: primaryColor,
        },
      })
      setEditedColor(null)
      toast.success("Primary color updated successfully!")
    } catch (error) {
      console.error("Failed to update color:", error)
      toast.error("Failed to update color. Please try again.")
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Branding" subtitle="Customize your project logo and primary color" />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl space-y-6">
            {/* Logo Upload Section */}
            <div className="bg-white rounded-lg border border-border p-6">
              <div className="flex items-center justify-between mb-[8px]">
                <h2 className="text-base font-semibold text-foreground">Logo</h2>
              </div>

              <div className="space-y-6">
                <Label className="text-[14px] leading-normal tracking-tight text-text-muted">
                  Project logo
                </Label>
                <div className="flex items-center gap-4">
                  {brandingData?.logo_url ? (
                    <div className="relative w-32 h-32 border-2 border-border rounded-lg overflow-hidden">
                      <Image
                        src={brandingData.logo_url}
                        alt="Logo preview"
                        fill
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50">
                      <span className="text-4xl text-muted-foreground">
                        {project?.name?.[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsUploadModalOpen(true)}
                      className="text-muted-foreground border-border bg-transparent"
                    >
                      {brandingData?.logo_url ? "Change logo" : "Upload logo"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Recommended size: 200x200px. Max file size: 6MB
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Primary Color Section */}
            <div className="bg-white rounded-lg border border-border p-6">
              {/* mb-[4px] (not 8px) so the visual gap to the label below is 8px:
                  the sm Button (h-8) is taller than the h2 and, centered, overhangs ~4px */}
              <div className="flex items-center justify-between mb-[4px]">
                <h2 className="text-base font-semibold text-foreground">Primary color</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveColor}
                  disabled={updateBranding.isPending}
                  className="text-muted-foreground border-border bg-transparent"
                >
                  {updateBranding.isPending ? "Saving..." : "Save"}
                </Button>
              </div>

              <div className="space-y-6">
                <Label htmlFor="primary-color" className="text-[14px] leading-normal tracking-tight text-text-muted">
                  Choose a primary color
                </Label>
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-lg border-2 border-border cursor-pointer"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => document.getElementById("primary-color")?.click()}
                  />
                  <div className="flex-1">
                    <input
                      id="primary-color"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setEditedColor(e.target.value)}
                      className="hidden"
                    />
                    <Input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setEditedColor(e.target.value)}
                      className="max-w-xs border-border"
                      placeholder="#554abf"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      This color will be used for buttons, links, and other primary elements on your landing page
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Image Upload Modal */}
      {projectId && (
        <ImageUploadModal
          open={isUploadModalOpen}
          onOpenChange={setIsUploadModalOpen}
          storagePath={`projects_public/${projectId}/logo`}
          onUploadComplete={handleLogoUploadComplete}
          title={`Upload Logo for ${project?.name || "Project"}`}
          description="Upload a logo image for your project. The image will be stored in your project's public storage."
          maxFileSizeMB={6}
          acceptedFileTypes={["image/*"]}
          currentImageUrl={brandingData?.logo_url || null}
        />
      )}
    </div>
  )
}

