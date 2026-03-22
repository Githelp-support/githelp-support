"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { HelpCircle } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useProject, useProjectBySlug } from "@/hooks/useProject"

export default function SLAEntryPage() {
  const [slaId, setSlaId] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()

  const projectIdParam = searchParams.get("project")
  const slugParam = searchParams.get("slug")
  const { data: projectById } = useProject(projectIdParam || "")
  const { data: projectBySlug } = useProjectBySlug(slugParam || "")
  const project = projectIdParam ? projectById : projectBySlug
  const projectName = project?.name || "Support"

  const handleEnterSupportSpace = () => {
    if (slaId.trim()) {
      // Validate SLA ID and redirect to support chat
      router.push(`/support/chat?sla=${slaId}`)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="relative">
          <div className="w-20 h-20 bg-white rounded-lg shadow-sm flex items-center justify-center">
            <div className="text-4xl font-bold">N</div>
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
            href="/support"
            className="pb-3 px-1 text-sm font-medium cursor-pointer transition-colors text-[#554abf] border-b-2 border-[#554abf]"
          >
            Get support
          </Link>
          <Link
            href="/support"
            className="pb-3 px-1 text-sm font-medium cursor-pointer transition-colors text-[#868c98] hover:text-[#444444]"
          >
            Rates and details
          </Link>
          <Link
            href="/support"
            className="pb-3 px-1 text-sm font-medium cursor-pointer transition-colors text-[#868c98] hover:text-[#444444]"
          >
            Resources
          </Link>
          <Link
            href="/support"
            className="pb-3 px-1 text-sm font-medium cursor-pointer transition-colors text-[#868c98] hover:text-[#444444]"
          >
            About support
          </Link>
        </nav>
      </div>

      <div className="max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-normal text-[#444444]">Type in your SLA ID</h2>
          <HelpCircle className="h-4 w-4 text-[#868c98]" />
        </div>

        <p className="text-[#444444] mb-8">
          When typing in your SLA ID, you will enter your organization&apos;s personal support space.
        </p>

        <div className="space-y-6">
          <Input
            type="text"
            placeholder="298HKS674TVW90"
            value={slaId}
            onChange={(e) => setSlaId(e.target.value)}
            className="border-gray-300 text-[#444444] placeholder:text-[#868c98]"
          />

          <Button
            onClick={handleEnterSupportSpace}
            variant="outline"
            className="border-[#554abf] text-[#554abf] hover:bg-[#554abf] hover:text-white cursor-pointer bg-transparent"
            disabled={!slaId.trim()}
          >
            Enter support space
          </Button>

          <Link href="/support" className="flex items-center gap-2 text-[#554abf] hover:underline text-sm">
            I don&apos;t have my SLA ID
          </Link>
        </div>
      </div>
    </div>
  )
}
