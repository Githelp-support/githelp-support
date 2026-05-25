"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { useHelper, useUpdateHelper, useUpdateUserProfile } from "@/hooks/useHelpers"
import { getAvatarColorHexForId } from "@/lib/constants"
import { supabase } from "@/lib/supabase/client"
import {
  useProjectKeywords,
  useHelperKeywords,
  useSetHelperKeywords,
} from "@/hooks/useHelperKeywords"
import { useProjectSelection } from "@/contexts/project-context"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useUser } from "@/contexts/user-context"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/ui/form-field"
import { Checkbox } from "@/components/ui/checkbox"
import { linkGitHubIdentity } from "@/lib/supabase/auth"

const GithubIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
)

export default function HelperProfilePage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [category, setCategory] = useState<"core" | "extended" | "community">("community")
  const [gitHubConnected, setGitHubConnected] = useState(false)
  const [gitHubUsername, setGitHubUsername] = useState<string | null>(null)

  const { user } = useUser()
  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined

  const { data: helperId, isLoading: currentHelperLoading } = useCurrentHelper(projectId)
  const { data: helperData, isLoading: helperLoading } = useHelper(helperId ?? "")

  const { data: projectKeywords = [] } = useProjectKeywords(projectId)
  const { data: selectedKeywordIds } = useHelperKeywords(helperId ?? undefined, projectId)
  const setHelperKeywords = useSetHelperKeywords(helperId ?? undefined, user?.id ?? undefined)

  const [selectedKeywords, setSelectedKeywords] = useState<number[]>([])

  const updateHelper = useUpdateHelper()
  const updateUserProfile = useUpdateUserProfile()

  // Sync local form state when helper data loads
  useEffect(() => {
    if (helperData) {
      setName(helperData.user?.name ?? "")
      setEmail(helperData.user?.email ?? "")
      setCategory((helperData.category as "core" | "extended" | "community") ?? "community")
    }
  }, [helperData])

  // GitHub connection status, display username, and auto-sync to users_public when empty
  useEffect(() => {
    const checkGitHub = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setGitHubConnected(false)
        setGitHubUsername(null)
        return
      }

      const providers: string[] = session.user.app_metadata?.providers ?? []
      const isConnected = providers.includes("github")
      setGitHubConnected(isConnected)

      if (!isConnected) {
        setGitHubUsername(null)
        return
      }

      const githubIdentity = session.user.identities?.find(
        (identity) => identity.provider === "github"
      )
      const idData = githubIdentity?.identity_data as
        | Record<string, unknown>
        | undefined
      const fromIdentity =
        (typeof idData?.user_name === "string" ? idData.user_name : undefined) ??
        (typeof idData?.preferred_username === "string"
          ? idData.preferred_username
          : undefined)
      const ghUsername =
        fromIdentity ??
        (session.user.user_metadata?.user_name as string | undefined) ??
        null

      setGitHubUsername(ghUsername)

      if (ghUsername && user?.id && !helperData?.user?.username) {
        updateUserProfile.mutate({
          userId: user.id,
          updates: { username: ghUsername },
        })
      }
    }
    void checkGitHub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, helperData?.user?.username])

  // Sync selected keywords when data loads (only when defined to avoid infinite loop from [] default)
  useEffect(() => {
    if (selectedKeywordIds !== undefined) {
      setSelectedKeywords(selectedKeywordIds)
    }
  }, [selectedKeywordIds])

  const handleSaveProfile = async () => {
    if (!user?.id) return
    await updateUserProfile.mutateAsync({
      userId: user.id,
      updates: { name: name || undefined, email: email || undefined },
    })
  }

  const handleSaveCategory = async () => {
    if (!helperId) return
    await updateHelper.mutateAsync({
      helperId,
      updates: { category },
    })
  }

  const handleKeywordToggle = (keywordId: number) => {
    setSelectedKeywords((prev) =>
      prev.includes(keywordId) ? prev.filter((id) => id !== keywordId) : [...prev, keywordId]
    )
  }

  const handleSaveKeywords = async () => {
    if (!helperId || !projectId || !user?.id) return
    await setHelperKeywords.mutateAsync({
      keywordIds: selectedKeywords,
      projectId,
    })
  }

  const isLoading = currentHelperLoading || (!!projectId && !!helperId && helperLoading)

  if (!projectId) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="My profile" subtitle="Helper profile for the selected project" />
          <main className="flex-1 overflow-auto p-6">
            <p className="text-muted-foreground">Select a project to view and edit your helper profile.</p>
          </main>
        </div>
      </div>
    )
  }

  if (!currentHelperLoading && projectId && helperId === null) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="My profile" subtitle="Helper profile for the selected project" />
          <main className="flex-1 overflow-auto p-6">
            <p className="text-muted-foreground">You are not registered as a helper in this project.</p>
          </main>
        </div>
      </div>
    )
  }

  if (isLoading || !helperData) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="My profile" subtitle="Helper profile" />
          <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </main>
        </div>
      </div>
    )
  }

  const displayName = helperData.user?.name || "Unknown"
  const displayAvatar = (displayName || "U")[0].toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="My profile" subtitle="View and edit your helper details" />

        <main className="flex-1 overflow-auto p-6">
          {/* Profile header */}
          <div className="flex items-center gap-4 mb-8">
            <div
              className="w-12 h-12 rounded-[16.5px] flex items-center justify-center text-[21px] font-medium text-foreground shrink-0"
              style={{ backgroundColor: getAvatarColorHexForId(helperData.user_id ?? helperData.helper_id) }}
            >
              {displayAvatar}
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-base font-semibold text-foreground">{displayName}</h1>
              <Badge variant="secondary" className="bg-brand-primary/10 text-brand-primary border-0 text-xs font-medium">
                {category.toLowerCase() === "core" ? "Core team" : category}
              </Badge>
            </div>
          </div>

          {/* Editable contact information */}
          <section className="mb-[34px] rounded-[10px] p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Contact information</h2>
            <div className="space-y-4">
              <div className="flex gap-5">
                <FormField label="Display name" className="flex-1 max-w-md">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="bg-background"
                  />
                </FormField>
                <FormField label="GitHub username" className="flex-1 max-w-md pl-5">
                  <div className="flex items-center gap-2">
                    <GithubIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                    {gitHubConnected ? (
                      <span className="text-sm text-foreground font-medium">
                        {gitHubUsername ?? "Connected"}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => linkGitHubIdentity()}
                        className="text-white hover:opacity-90"
                        style={{ backgroundColor: "#24292e" }}
                      >
                        <GithubIcon className="w-4 h-4" />
                        Connect with GitHub
                      </Button>
                    )}
                  </div>
                </FormField>
              </div>
              <FormField label="Email" className="max-w-md">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="bg-background"
                />
              </FormField>
              <Button
                onClick={handleSaveProfile}
                disabled={updateUserProfile.isPending}
                variant="outline"
                className="border-border"
                style={{ marginTop: "22px" }}
              >
                {updateUserProfile.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Save contact details"
                )}
              </Button>
            </div>
          </section>

          {/* Editable category */}
          <section className="mb-[34px] rounded-[10px] p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Helper category</h2>
            <div className="flex items-center gap-4 flex-wrap">
              <Select value={category} onValueChange={(v) => setCategory(v as "core" | "extended" | "community")}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="core">Core team</SelectItem>
                  <SelectItem value="extended">Extended team</SelectItem>
                  <SelectItem value="community">Community</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleSaveCategory}
                disabled={updateHelper.isPending}
                variant="outline"
                className="border-border"
              >
                {updateHelper.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save category"}
              </Button>
            </div>
          </section>

          {/* Project keywords / topics */}
          <section className="mb-[34px] rounded-[10px] p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Topics & keywords</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select the project topics you can help with. This helps route relevant tickets to you.
            </p>
            {projectKeywords.length === 0 ? (
              <p className="text-sm text-muted-foreground">No keywords defined for this project yet.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {projectKeywords.map((kw) => (
                  <label
                    key={kw.id}
                    className="flex items-center gap-2 cursor-pointer rounded-md border border-[rgba(0,0,0,0.1)] px-3 py-2 hover:bg-muted/50 has-[:checked]:border-brand-primary has-[:checked]:bg-brand-primary/10"
                  >
                    <Checkbox
                      checked={selectedKeywords.includes(kw.id)}
                      onCheckedChange={() => handleKeywordToggle(kw.id)}
                    />
                    <span className="text-sm font-medium">{kw.value}</span>
                  </label>
                ))}
              </div>
            )}
            <Button
              onClick={handleSaveKeywords}
              disabled={setHelperKeywords.isPending || projectKeywords.length === 0}
              variant="outline"
              className="border-border mt-[22px]"
            >
              {setHelperKeywords.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save topics"
              )}
            </Button>
          </section>
        </main>
      </div>
    </div>
  )
}
