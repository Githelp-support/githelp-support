"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { HelpCircle, ChevronLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSearchParams } from "next/navigation"
import { useProject, useProjectBySlug, useProjectBranding } from "@/hooks/useProject"
import { useUser } from "@/contexts/user-context"
import { useProjectRole } from "@/hooks/useProjectRole"

export default function GetSupportPage() {
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get("project")
  const slugParam = searchParams.get("slug")
  const { setProjectRole } = useUser()

  const { data: projectById } = useProject(projectIdParam || "")
  const { data: projectBySlug } = useProjectBySlug(slugParam || "")
  const project = projectIdParam ? projectById : projectBySlug
  const projectId = project?.project_id

  const supportQuery = slugParam
    ? `?slug=${encodeURIComponent(slugParam)}`
    : projectIdParam
      ? `?project=${encodeURIComponent(projectIdParam)}`
      : ""

  // Get user's role in this project
  const { data: projectRole } = useProjectRole(projectId || undefined)
  
  // Update user context with project role
  useEffect(() => {
    if (projectId && projectRole) {
      setProjectRole(projectRole)
    } else if (!projectId) {
      setProjectRole(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectRole])

  // Fetch branding for logo
  const { data: brandingData } = useProjectBranding(projectId || "")
  const projectLogo = brandingData?.logo_url || null
  const projectName = project?.name || "Algorax"

  if (!projectIdParam && !slugParam) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h1 className="text-2xl font-semibold text-[#444444] mb-2">Missing project identifier</h1>
          <p className="text-[#868c98]">
            Please open this page using a link that includes either <span className="font-semibold">?slug=</span> or{" "}
            <span className="font-semibold">?project=</span>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="relative">
          <div className="w-20 h-20 bg-white rounded-lg shadow-sm flex items-center justify-center overflow-hidden">
            <Avatar className="w-20 h-20">
              <AvatarImage src={projectLogo} alt={projectName} />
              <AvatarFallback className="bg-brand-primary text-white text-xs">
                {projectName?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            
          </div>
          <div className="absolute -top-2 -left-2 bg-[#868c98] text-white text-xs px-2 py-1 rounded">OS</div>
        </div>
        <div>
          <h1 className="text-3xl font-normal text-[#444444]">
            Welcome to the support page for <span className="font-semibold">{projectName}</span>
          </h1>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-12">
        <nav className="flex gap-8">
          <Link
            href={`/support${supportQuery}`}
            className="pb-3 px-1 text-sm font-medium cursor-pointer transition-colors text-[#554abf] border-b-2 border-[#554abf]"
          >
            Get support
          </Link>
          <Link
            href={`/support${supportQuery}`}
            className="pb-3 px-1 text-sm font-medium cursor-pointer transition-colors text-[#868c98] hover:text-[#444444]"
          >
            Rates and details
          </Link>
          <Link
            href={`/support${supportQuery}`}
            className="pb-3 px-1 text-sm font-medium cursor-pointer transition-colors text-[#868c98] hover:text-[#444444]"
          >
            Resources
          </Link>
          <Link
            href={`/support${supportQuery}`}
            className="pb-3 px-1 text-sm font-medium cursor-pointer transition-colors text-[#868c98] hover:text-[#444444]"
          >
            About support
          </Link>
        </nav>
      </div>

      <div className="space-y-8">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-normal text-[#444444]">The {projectName} support space</h2>
          <HelpCircle className="h-4 w-4 text-[#868c98]" />
        </div>

        <p className="text-[#444444]">
          It is free to enter the support space. You are only charged upon asking a question and starting a ticket.
        </p>

        <div className="space-y-4">
          <Link href={`/support/chat${supportQuery}`}>
            <Button
              variant="outline"
              className="border-[#554abf] text-[#554abf] hover:bg-[#554abf] hover:text-white cursor-pointer bg-transparent"
            >
              Enter support space
            </Button>
          </Link>

          <div className="mt-6">
            <Link
              href={`/support${supportQuery}`}
              className="inline-flex items-center gap-2 text-[#554abf] hover:text-[#4a3fb0] transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Go back</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
