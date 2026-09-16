"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { useUser } from "@/contexts/user-context"
import { useProject, useProjectBySlug, useProjectBranding } from "@/hooks/useProject"
import { useJoinSla } from "@/hooks/useSLAs"
import { normalizeSlaAccessCode } from "@/lib/sla"
import { getAvatarColorHexForId } from "@/lib/constants"

/** "abcd1234ef" → "ABCD-1234-EF" while typing; never longer than 14 chars. */
function formatCodeInput(raw: string): string {
  const compact = raw.replace(/[^0-9a-z]/gi, "").toUpperCase().slice(0, 12)
  return compact.replace(/(.{4})(?=.)/g, "$1-")
}

export default function SLAEntryPage() {
  const [code, setCode] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: userLoading } = useUser()
  const isAuthenticated = !!user?.id
  const joinSla = useJoinSla()

  const projectIdParam = searchParams.get("project")
  const slugParam = searchParams.get("slug")
  const { data: projectById } = useProject(projectIdParam || "")
  const { data: projectBySlug } = useProjectBySlug(slugParam || "")
  const project = projectIdParam ? projectById : projectBySlug
  const projectId = project?.project_id
  const { data: branding } = useProjectBranding(projectId || "")
  const projectLogo = branding?.logo_url || null
  const projectName = project?.name || "Support"

  const supportHref = project?.slug
    ? `/support/${encodeURIComponent(project.slug)}`
    : projectId
      ? `/support?project=${encodeURIComponent(projectId)}`
      : "/support"

  const currentPath = `/support/sla${projectIdParam ? `?project=${encodeURIComponent(projectIdParam)}` : slugParam ? `?slug=${encodeURIComponent(slugParam)}` : ""}`
  const signInHref = `/auth/signin?redirect=${encodeURIComponent(currentPath)}`

  const normalized = normalizeSlaAccessCode(code)

  const handleJoin = async () => {
    if (!normalized) {
      toast.error("The SLA code has 12 characters, like ABCD-1234-EFGH.")
      return
    }
    try {
      const result = await joinSla.mutateAsync({ accessCode: normalized })
      if (projectId && result.projectId !== projectId) {
        toast.info(`This SLA belongs to ${result.projectName ?? "another project"}. Taking you there.`)
      } else {
        toast.success(`You're linked to ${result.name ?? "the SLA"}.`)
      }
      router.push(`/support/chat?project=${encodeURIComponent(result.projectId)}&sla=${encodeURIComponent(result.slaId)}`)
    } catch (error) {
      console.error("Failed to join SLA:", error)
      toast.error(error instanceof Error ? error.message : "Could not link that SLA code. Please try again.")
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center gap-4 mb-8">
        <Avatar className="w-20 h-20 rounded-[12px] border border-border">
          {projectLogo ? <AvatarImage src={projectLogo} alt={projectName} /> : null}
          <AvatarFallback
            className="rounded-[12px] text-2xl font-medium text-foreground"
            style={{ backgroundColor: getAvatarColorHexForId(projectId ?? projectName) }}
          >
            {projectName[0]?.toUpperCase() || "S"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-normal text-foreground">
            Welcome to the support page for <span className="font-semibold">{projectName}</span>
          </h1>
        </div>
      </div>

      <div className="border-b border-border mb-12">
        <nav className="flex gap-8">
          <Link
            href={supportHref}
            className="pb-3 px-1 text-sm font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground"
          >
            Get support
          </Link>
          <span className="pb-3 px-1 text-sm font-medium text-brand-primary border-b-2 border-brand-primary">
            SLA access
          </span>
        </nav>
      </div>

      <div className="max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-normal text-foreground">Type in your SLA code</h2>
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </div>

        <p className="text-foreground mb-8">
          The {projectName} team shares a 12-character code with every service-level agreement. Entering it links
          your organization to the agreement, so your tickets use its included support time instead of per-ticket
          payment.
        </p>

        {!isAuthenticated && !userLoading ? (
          <Card className="border-border">
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                Sign in first. The agreement is linked to your organization, so we need to know who you are.
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-4 border-brand-primary text-brand-primary hover:bg-brand-primary/10"
              >
                <Link href={signInHref}>Sign in</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault()
              void handleJoin()
            }}
          >
            <Input
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="ABCD-1234-EFGH"
              value={code}
              onChange={(e) => setCode(formatCodeInput(e.target.value))}
              className="font-mono tracking-widest uppercase"
              aria-label="SLA code"
            />

            <Button
              type="submit"
              variant="outline"
              className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white cursor-pointer bg-transparent"
              disabled={!normalized || joinSla.isPending || userLoading}
            >
              {joinSla.isPending ? "Linking…" : "Enter support space"}
            </Button>

            <Link href={supportHref} className="flex items-center gap-2 text-brand-primary hover:underline text-sm">
              I don&apos;t have an SLA code
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
