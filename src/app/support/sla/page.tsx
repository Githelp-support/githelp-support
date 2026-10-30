"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { HelpCircle } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useProject, useProjectBySlug } from "@/hooks/useProject"

/** SLA ids are `slas.id` UUIDs; accept nothing else before navigating. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  const trimmedSlaId = slaId.trim()
  const slaIdValid = UUID_PATTERN.test(trimmedSlaId)
  const showFormatError = trimmedSlaId.length > 0 && !slaIdValid

  const handleEnterSupportSpace = () => {
    // Only a well-formed SLA id goes into the URL; anything else is rejected
    // here instead of being pushed through as a query string.
    if (!slaIdValid) return
    const params = new URLSearchParams()
    params.set("sla", trimmedSlaId.toLowerCase())
    if (projectIdParam) params.set("project", projectIdParam)
    else if (slugParam) params.set("slug", slugParam)
    router.push(`/support/chat?${params.toString()}`)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="relative">
          <div className="w-20 h-20 bg-card rounded-lg shadow-sm flex items-center justify-center">
            <div className="text-4xl font-bold">N</div>
          </div>
          <div className="absolute -top-2 -left-2 bg-text-tertiary text-white text-xs px-2 py-1 rounded">OS</div>
        </div>
        <div>
          <h1 className="text-3xl font-normal text-text-secondary">
            Welcome to the support page for <span className="font-semibold">{projectName}</span>
          </h1>
        </div>
      </div>

      <div className="border-b border-border-subtle mb-12">
        <nav className="flex gap-8">
          <Link
            href="/support"
            className="pb-3 px-1 text-sm font-medium cursor-pointer transition-colors text-brand-primary border-b-2 border-brand-primary"
          >
            Get support
          </Link>
          <Link
            href="/support"
            className="pb-3 px-1 text-sm font-medium cursor-pointer transition-colors text-text-tertiary hover:text-text-secondary"
          >
            Rates and details
          </Link>
          <Link
            href="/support"
            className="pb-3 px-1 text-sm font-medium cursor-pointer transition-colors text-text-tertiary hover:text-text-secondary"
          >
            Resources
          </Link>
          <Link
            href="/support"
            className="pb-3 px-1 text-sm font-medium cursor-pointer transition-colors text-text-tertiary hover:text-text-secondary"
          >
            About support
          </Link>
        </nav>
      </div>

      <div className="max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-normal text-text-secondary">Type in your SLA ID</h2>
          <HelpCircle className="h-4 w-4 text-text-tertiary" />
        </div>

        <p className="text-text-secondary mb-8">
          When typing in your SLA ID, you will enter your organization&apos;s personal support space.
        </p>

        <div className="space-y-6">
          <div>
            <Input
              type="text"
              placeholder="00000000-0000-0000-0000-000000000000"
              value={slaId}
              onChange={(e) => setSlaId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEnterSupportSpace()
              }}
              aria-invalid={showFormatError}
              aria-describedby={showFormatError ? "sla-id-error" : undefined}
              className="border-border-control text-text-secondary placeholder:text-text-tertiary font-mono"
            />
            {showFormatError && (
              <p id="sla-id-error" role="alert" className="mt-2 text-sm text-destructive">
                That doesn&apos;t look like an SLA ID. It is the identifier from your SLA agreement, in the form
                8-4-4-4-12 hexadecimal characters.
              </p>
            )}
          </div>

          <Button
            onClick={handleEnterSupportSpace}
            variant="outline"
            className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-brand-foreground cursor-pointer bg-transparent"
            disabled={!slaIdValid}
          >
            Enter support space
          </Button>

          <Link href="/support" className="flex items-center gap-2 text-brand-primary hover:underline text-sm">
            I don&apos;t have my SLA ID
          </Link>
        </div>
      </div>
    </div>
  )
}
