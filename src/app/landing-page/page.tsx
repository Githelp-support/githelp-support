"use client"

import type React from "react"

import { useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/ui/form-field"
import { Plus, Trash2, ExternalLink, Copy, Check } from "lucide-react"
import Link from "next/link"
import { useUserProjects, useProjectResources, useCreateProjectResource, useDeleteProjectResource } from "@/hooks/useProject"
import { useProjectSelection } from "@/contexts/project-context"

interface Resource {
  id: number
  name: string
  url: string
}

export default function LandingPageSettings() {
  const [newResourceName, setNewResourceName] = useState("")
  const [newResourceUrl, setNewResourceUrl] = useState("")
  const [copied, setCopied] = useState(false)

  const { selectedProjectId: projectId } = useProjectSelection()
  const { data: userProjects = [] } = useUserProjects()
  const project = userProjects.find((p) => p.project_id === projectId) || userProjects[0]

  // Fetch resources from database
  const { data: resourcesData, isLoading: resourcesLoading } = useProjectResources(projectId || "")
  const createResource = useCreateProjectResource()
  const deleteResource = useDeleteProjectResource()

  // Transform resources data to match UI format
  const resources: Resource[] = resourcesData || []

  const handleAddResource = async () => {
    if (newResourceName && newResourceUrl && projectId) {
      try {
        await createResource.mutateAsync({
          projectId,
          resource: {
            name: newResourceName,
            url: newResourceUrl,
          },
        })
        setNewResourceName("")
        setNewResourceUrl("")
      } catch (error) {
        console.error("Failed to add resource:", error)
        // You might want to show a toast notification here
      }
    }
  }

  const handleDeleteResource = async (id: number) => {
    if (projectId) {
      try {
        await deleteResource.mutateAsync({
          projectId,
          resourceId: id,
        })
      } catch (error) {
        console.error("Failed to delete resource:", error)
        // You might want to show a toast notification here
      }
    }
  }

  const handleCopyLink = () => {
    const slug = project?.slug
    const supportLink = slug
      ? `${window.location.origin}/support/${encodeURIComponent(slug)}`
      : projectId
        ? `${window.location.origin}/support?project=${encodeURIComponent(projectId)}`
        : `${window.location.origin}/support`
    navigator.clipboard.writeText(supportLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Landing page" subtitle="Customize your landing page branding and resources" />
        <main className="flex-1 px-[34px] py-6 overflow-auto">
          <div className="max-w-4xl">

            <div className="bg-white rounded-lg border border-border p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm mb-2" style={{ color: '#0A0A0A', fontWeight: 550 }}>Your support page</h3>
                  <p className="text-sm leading-normal tracking-tight text-text-muted">Share this link with your users to access support</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={
                      project?.slug
                        ? `/support/${encodeURIComponent(project.slug)}`
                        : projectId
                          ? `/support?project=${encodeURIComponent(projectId)}`
                          : "/support"
                    }
                    target="_blank"
                  >
                    <Button variant="outline" size="sm" className="text-[#55555d] border-border bg-transparent cursor-pointer">
                      <ExternalLink className="w-4 h-4" />
                      Open
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="text-[#55555d] border-border bg-transparent cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy link
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Resources Section */}
            <div className="space-y-6">
              {/* Add Resource Section */}
                <div className="bg-white rounded-lg border border-border p-6">
                  <h2 className="text-base font-semibold text-foreground mb-6">Add resource</h2>

                  <div className="space-y-4">
                    <FormField label="Name" id="resource-name">
                      <Input
                        id="resource-name"
                        type="text"
                        value={newResourceName}
                        onChange={(e) => setNewResourceName(e.target.value)}
                        className="bg-background border-border"
                        placeholder="e.g., Documentation"
                      />
                    </FormField>

                    <FormField label="URL" id="resource-url">
                      <Input
                        id="resource-url"
                        type="url"
                        value={newResourceUrl}
                        onChange={(e) => setNewResourceUrl(e.target.value)}
                        className="bg-background border-border"
                        placeholder="https://example.com"
                      />
                    </FormField>

                    <Button
                      onClick={handleAddResource}
                      disabled={!newResourceName || !newResourceUrl || createResource.isPending}
                      variant="lavender"
                    >
                      <Plus className="w-4 h-4" />
                      {createResource.isPending ? "Adding..." : "Add resource"}
                    </Button>
                  </div>
                </div>

                {/* Resources List Section */}
                <div className="bg-white rounded-lg border border-border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-base font-semibold text-foreground">Resources</h2>
                    <Button variant="outline" size="sm" className="text-[#55555d] border-border bg-transparent">
                      Save
                    </Button>
                  </div>

                  {resourcesLoading ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-[#818185]">Loading resources...</p>
                    </div>
                  ) : resources.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-[#818185]">No resources added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {resources.map((resource) => (
                        <div
                          key={resource.id}
                          className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-[#f7f9ff] transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-medium text-foreground">{resource.name}</h3>
                              <ExternalLink className="w-3 h-3 text-[#818185]" />
                            </div>
                            <p className="text-xs text-[#818185] mt-1">{resource.url}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteResource(resource.id)}
                            disabled={deleteResource.isPending}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
