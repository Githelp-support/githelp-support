"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { FormField } from "@/components/ui/form-field"
import { DrawerPanel } from "@/components/ui/drawer-panel"
import { Copy, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"
import { supabase } from "@/lib/supabase/client"
import {
  useListRepoContributors,
  useGetProjectRepo,
  type RepoContributor,
} from "@/hooks/useProject"

interface AddHelperDrawerProps {
  isOpen: boolean
  onClose: () => void
  projectId?: string
  onSubmit: (helper: {
    category: string
    email?: string
    inviteMethod: "email" | "link" | "contributors" | "github_username"
    invitee_identifier?: string
    github_username?: string
    github_usernames?: string[]
  }) => Promise<{ invite_url?: string; invite_urls?: Record<string, string> }>
}

export function AddHelperDrawer({ isOpen, onClose, projectId, onSubmit }: AddHelperDrawerProps) {
  const [formData, setFormData] = useState({
    category: "",
    email: "",
    inviteeIdentifier: "",
    githubUsername: "",
    inviteMethod: "link" as "email" | "link" | "contributors" | "github_username",
  })
  const [selectedContributors, setSelectedContributors] = useState<Set<string>>(new Set())
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [githubToken, setGithubToken] = useState<string | null>(null)
  const { data: repoFullName } = useGetProjectRepo(projectId ?? null)
  const { data: contributors = [], isLoading: contributorsLoading } = useListRepoContributors(
    githubToken,
    repoFullName ?? null
  )

  useEffect(() => {
    const checkGithubSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const providers = session?.user?.app_metadata?.providers as string[] | undefined
      const hasGithub = providers?.includes("github")
      const token = hasGithub && session?.provider_token ? session.provider_token : null
      setGithubToken(token)
    }
    checkGithubSession()
  }, [])

  const toggleContributor = (login: string) => {
    setSelectedContributors((prev) => {
      const next = new Set(prev)
      if (next.has(login)) next.delete(login)
      else next.add(login)
      return next
    })
  }

  const selectAllContributors = () => {
    if (selectedContributors.size === contributors.length) {
      setSelectedContributors(new Set())
    } else {
      setSelectedContributors(new Set(contributors.map((c) => c.login)))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setInviteUrl(null)
    setInviteLinks({})

    try {
      if (formData.inviteMethod === "contributors") {
        if (selectedContributors.size === 0) {
          setError("Select at least one contributor")
          return
        }
        const result = await onSubmit({
          category: formData.category,
          inviteMethod: "contributors",
          github_usernames: Array.from(selectedContributors),
        })
        if (result.invite_urls && Object.keys(result.invite_urls).length > 0) {
          setInviteLinks(result.invite_urls)
          toast.success(`Invited ${Object.keys(result.invite_urls).length} contributor(s) as helpers!`)
        }
      } else if (formData.inviteMethod === "github_username") {
        const username = formData.githubUsername.trim()
        if (!username) {
          setError("Enter a GitHub username")
          return
        }
        const result = await onSubmit({
          category: formData.category,
          inviteMethod: "github_username",
          github_username: username,
          invitee_identifier: formData.inviteeIdentifier.trim() || username,
        })
        if (result.invite_url) {
          setInviteUrl(result.invite_url)
          await navigator.clipboard.writeText(result.invite_url)
          setCopied(true)
          toast.success("Invite link copied to clipboard!")
          setTimeout(() => setCopied(false), 2000)
        }
      } else {
        const result = await onSubmit({
          category: formData.category,
          email: formData.inviteMethod === "email" ? formData.email : undefined,
          inviteMethod: formData.inviteMethod,
          invitee_identifier: formData.inviteeIdentifier.trim() || undefined,
        })

        if (result.invite_url) {
          setInviteUrl(result.invite_url)
          if (formData.inviteMethod === "link") {
            await navigator.clipboard.writeText(result.invite_url)
            setCopied(true)
            toast.success("Invite link copied to clipboard!")
            setTimeout(() => setCopied(false), 2000)
          } else {
            toast.success("Invite email sent!")
          }
        }

        if (formData.inviteMethod === "email") {
          setFormData({
            category: "",
            email: "",
            inviteeIdentifier: "",
            githubUsername: "",
            inviteMethod: "link",
          })
          setTimeout(() => {
            onClose()
            setInviteUrl(null)
          }, 2000)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleCopyLink = async () => {
    if (inviteUrl) {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success("Link copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    setFormData({
      category: "",
      email: "",
      inviteeIdentifier: "",
      githubUsername: "",
      inviteMethod: "link",
    })
    setSelectedContributors(new Set())
    setInviteLinks({})
    setInviteUrl(null)
    setError(null)
    onClose()
  }

  const baseUrl =
    (typeof window !== "undefined" && window.location?.origin) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://githelp.app"

  const canSubmit =
    formData.category &&
    (formData.inviteMethod === "link" ||
      (formData.inviteMethod === "email" && formData.email) ||
      (formData.inviteMethod === "contributors" && selectedContributors.size > 0) ||
      (formData.inviteMethod === "github_username" && formData.githubUsername.trim()))

  const hasSuccessResult = !!inviteUrl || Object.keys(inviteLinks).length > 0

  return (
    <DrawerPanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add new helper"
      width="w-[440px]"
      className="shadow-2xl"
      footer={
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 h-11 rounded-xl text-[14px] font-semibold shadow-sm"
          >
            {hasSuccessResult ? "Close" : "Cancel"}
          </Button>
          {!hasSuccessResult && (
            <Button
              type="submit"
              form="add-helper-form"
              disabled={isSubmitting || !canSubmit}
              variant="default"
              className="flex-1 h-11 rounded-xl text-[14px] font-semibold bg-brand-primary hover:bg-brand-primary/90 text-white shadow-md"
            >
              {isSubmitting ? "Creating..." : "Create invite"}
            </Button>
          )}
        </div>
      }
    >
      <form id="add-helper-form" onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 px-6 py-5 space-y-6 overflow-auto">
            {(formData.inviteMethod === "link" ||
              formData.inviteMethod === "email" ||
              formData.inviteMethod === "github_username") && (
              <FormField
                label="Who is it?"
                hint="This is just a temporary identifier until the user has registered which can be a name or username."
              >
                <Input
                  value={formData.inviteeIdentifier}
                  onChange={(e) => handleInputChange("inviteeIdentifier", e.target.value)}
                  className="h-10 rounded-lg border-border"
                  placeholder={
                    formData.inviteMethod === "github_username"
                      ? "Defaults to GitHub username"
                      : "e.g. John, @johndoe"
                  }
                />
              </FormField>
            )}

            <FormField label="Category">
              <Select
                value={formData.category}
                onValueChange={(value) => handleInputChange("category", value)}
                required
              >
                <SelectTrigger className="w-full h-10 rounded-lg border-border focus-visible:ring-ring">
                  <SelectValue placeholder="Pick helper category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="core">Core team</SelectItem>
                  <SelectItem value="extended">Extended team</SelectItem>
                  <SelectItem value="community">Community</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <div className="space-y-3">
              <Label className="text-[13px] font-semibold text-foreground">Invite method</Label>
              <RadioGroup
                value={formData.inviteMethod}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, inviteMethod: value as "email" | "link" | "contributors" | "github_username" }))}
                className="grid gap-2.5"
              >
                <div className="flex items-center space-x-2.5">
                  <RadioGroupItem value="link" id="link" className="size-[18px] border-muted-foreground/40 data-[state=checked]:border-primary" />
                  <Label htmlFor="link" className="cursor-pointer text-sm text-foreground/80">Generate shareable link</Label>
                </div>
                <div className="flex items-center space-x-2.5">
                  <RadioGroupItem value="email" id="email" className="size-[18px] border-muted-foreground/40 data-[state=checked]:border-primary" />
                  <Label htmlFor="email" className="cursor-pointer text-sm text-foreground/80">Send via email</Label>
                </div>
                {projectId && (
                  <>
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem value="contributors" id="contributors" className="size-[18px] border-muted-foreground/40 data-[state=checked]:border-primary" />
                      <Label htmlFor="contributors" className="cursor-pointer text-sm text-foreground/80">From contributors</Label>
                    </div>
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem value="github_username" id="github_username" className="size-[18px] border-muted-foreground/40 data-[state=checked]:border-primary" />
                      <Label htmlFor="github_username" className="cursor-pointer text-sm text-foreground/80">GitHub username</Label>
                    </div>
                  </>
                )}
              </RadioGroup>
            </div>

            {formData.inviteMethod === "contributors" && projectId && (
              <FormField
                label="Select contributors"
                hint={
                  !githubToken
                    ? "Connect with GitHub to see contributors."
                    : !repoFullName
                      ? "This project is not linked to a GitHub repository."
                      : undefined
                }
              >
                {!githubToken ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Connect with GitHub to see contributors from your repository.
                  </p>
                ) : !repoFullName ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Contributors can only be invited from projects linked to a GitHub repository.
                  </p>
                ) : contributorsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : contributors.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No contributors found for this repository.</p>
                ) : (
                  <div className="space-y-2.5 max-h-48 overflow-y-auto border border-border/60 rounded-xl bg-muted/30 p-3">
                    <Button type="button" variant="outline" size="sm" onClick={selectAllContributors}>
                      {selectedContributors.size === contributors.length ? "Deselect all" : "Select all"}
                    </Button>
                    <div className="space-y-1.5">
                      {contributors.map((c: RepoContributor) => (
                        <div
                          key={c.login}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            selectedContributors.has(c.login)
                              ? "bg-brand-primary/10 border border-brand-primary/60"
                              : "border border-transparent hover:bg-muted/60"
                          }`}
                          onClick={() => toggleContributor(c.login)}
                        >
                          <Image
                            src={c.avatar_url}
                            alt={c.login}
                            width={28}
                            height={28}
                            className="rounded-full"
                          />
                          <span className="font-medium text-sm">{c.login}</span>
                          <span className="text-xs text-muted-foreground">({c.contributions} contributions)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </FormField>
            )}

            {formData.inviteMethod === "github_username" && (
              <FormField
                label="GitHub username"
                hint="Enter a GitHub username to invite. They will be matched when they sign in with GitHub."
              >
                <Input
                  value={formData.githubUsername}
                  onChange={(e) => handleInputChange("githubUsername", e.target.value)}
                  className="h-10 rounded-lg border-border"
                  placeholder="e.g. octocat"
                />
              </FormField>
            )}

            {formData.inviteMethod === "email" && (
              <FormField label="Email address">
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="h-10 rounded-lg border-border"
                  placeholder="user@example.com"
                  required={formData.inviteMethod === "email"}
                />
              </FormField>
            )}

            {inviteUrl && (formData.inviteMethod === "link" || formData.inviteMethod === "github_username") && (
              <FormField
                label="Invite link"
                hint="Link copied to clipboard. Share this with the helper."
              >
                <div className="flex gap-2">
                  <Input
                    value={inviteUrl}
                    readOnly
                    className="h-10 rounded-xl border-border/60 bg-muted/40"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    className="rounded-xl border-border/60 hover:bg-muted/60"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </FormField>
            )}

            {Object.keys(inviteLinks).length > 0 && formData.inviteMethod === "contributors" && (
              <FormField
                label="Invite links"
                hint="Share each link with the corresponding contributor."
              >
                <div className="space-y-2 max-h-40 overflow-y-auto border border-border/60 rounded-xl bg-muted/30 p-3">
                  {Object.entries(inviteLinks).map(([login, url]) => (
                    <div
                      key={login}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background/60 text-sm"
                    >
                      <span className="font-medium w-24 truncate">{login}</span>
                      <span className="flex-1 truncate text-muted-foreground">{url}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-lg hover:bg-muted/60"
                        onClick={async () => {
                          await navigator.clipboard.writeText(url)
                          setCopied(true)
                          toast.success("Link copied!")
                          setTimeout(() => setCopied(false), 2000)
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </FormField>
            )}

            {/* Error message */}
            {error && (
              <div className="px-3.5 py-3 bg-red-50/80 border border-red-200/60 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
        </div>
      </form>
    </DrawerPanel>
  )
}
