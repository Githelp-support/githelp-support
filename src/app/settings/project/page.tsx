"use client"

import { useMemo, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Loader2, Copy, Check } from "lucide-react"
import { useProjectSelection } from "@/contexts/project-context"
import {
  useProjectKeywords,
  useProjectHelpCategories,
  useCreateProjectKeyword,
  useDeleteProjectKeyword,
  useCreateProjectHelpCategory,
  useDeleteProjectHelpCategory,
} from "@/hooks/useHelperKeywords"
import { useHelpers } from "@/hooks/useHelpers"
import { useCreateProjectInvite } from "@/hooks/useProject"
import { useProjectAdmins, usePromoteToAdmin } from "@/hooks/useProjectAdmins"
import { getAvatarColorHexForId } from "@/lib/constants"
import { toast } from "sonner"

export default function ProjectSettingsPage() {
  const [newKeyword, setNewKeyword] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [promoteHelperId, setPromoteHelperId] = useState<string>("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [latestInviteLink, setLatestInviteLink] = useState<string | null>(null)
  const [copiedInvite, setCopiedInvite] = useState(false)

  const { selectedProjectId: projectId } = useProjectSelection()

  const { data: keywords = [], isLoading: keywordsLoading } = useProjectKeywords(projectId ?? undefined)
  const { data: helpCategories = [], isLoading: categoriesLoading } = useProjectHelpCategories(projectId ?? undefined)
  const { data: admins = [], isLoading: adminsLoading } = useProjectAdmins(projectId ?? undefined)
  const { data: helpers = [], isLoading: helpersLoading } = useHelpers(projectId ?? undefined)

  const createKeyword = useCreateProjectKeyword(projectId ?? undefined)
  const deleteKeyword = useDeleteProjectKeyword(projectId ?? undefined)
  const createCategory = useCreateProjectHelpCategory(projectId ?? undefined)
  const deleteCategory = useDeleteProjectHelpCategory(projectId ?? undefined)
  const promoteToAdmin = usePromoteToAdmin()
  const createInvite = useCreateProjectInvite()

  const adminUserIds = useMemo(() => new Set(admins.map((a) => a.user_id)), [admins])
  const promotableHelpers = useMemo(
    () =>
      helpers.filter(
        (h) => h.user_id && !adminUserIds.has(h.user_id),
      ),
    [helpers, adminUserIds],
  )

  const handleAddKeyword = async () => {
    const value = newKeyword.trim()
    if (!value || !projectId) return

    try {
      await createKeyword.mutateAsync(value)
      setNewKeyword("")
      toast.success("Keyword added")
    } catch (error) {
      console.error("Failed to add keyword:", error)
      toast.error("Failed to add keyword. Please try again.")
    }
  }

  const handleDeleteKeyword = async (id: number) => {
    try {
      await deleteKeyword.mutateAsync(id)
      toast.success("Keyword removed")
    } catch (error) {
      console.error("Failed to delete keyword:", error)
      toast.error("Failed to remove keyword. Please try again.")
    }
  }

  const handleAddCategory = async () => {
    const value = newCategory.trim()
    if (!value || !projectId) return

    try {
      await createCategory.mutateAsync({ value })
      setNewCategory("")
      toast.success("Help category added")
    } catch (error) {
      console.error("Failed to add category:", error)
      toast.error("Failed to add category. Please try again.")
    }
  }

  const handleDeleteCategory = async (id: number) => {
    try {
      await deleteCategory.mutateAsync(id)
      toast.success("Help category removed")
    } catch (error) {
      console.error("Failed to delete category:", error)
      toast.error("Failed to remove category. Please try again.")
    }
  }

  const handlePromoteHelper = async () => {
    if (!promoteHelperId || !projectId) return
    try {
      await promoteToAdmin.mutateAsync({ projectId, userId: promoteHelperId })
      setPromoteHelperId("")
      toast.success("Helper promoted to admin")
    } catch (error) {
      console.error("Failed to promote helper:", error)
      const message =
        error instanceof Error ? error.message : "Failed to promote helper. Please try again."
      toast.error(message)
    }
  }

  const handleInviteAdmin = async () => {
    if (!projectId) return
    const email = inviteEmail.trim()
    try {
      const invite = await createInvite.mutateAsync({
        project_id: projectId,
        invite_type: "admin",
        ...(email ? { email } : {}),
      })
      setInviteEmail("")
      setLatestInviteLink(invite.invite_url)
      setCopiedInvite(false)
      toast.success(email ? `Admin invite sent to ${email}` : "Admin invite link created")
    } catch (error) {
      console.error("Failed to create admin invite:", error)
      toast.error("Failed to create admin invite. Please try again.")
    }
  }

  const handleCopyInvite = async () => {
    if (!latestInviteLink) return
    try {
      await navigator.clipboard.writeText(latestInviteLink)
      setCopiedInvite(true)
      setTimeout(() => setCopiedInvite(false), 2000)
    } catch {
      toast.error("Could not copy link")
    }
  }

  const getInitials = (name: string | null, email: string | null) => {
    return (name || email || "?").trim().charAt(0).toUpperCase() || "?"
  }

  if (!projectId) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Project Settings" subtitle="Manage keywords and help categories" />
          <main className="flex-1 py-6 px-8 overflow-y-auto">
            <p className="text-muted-foreground">Select a project to manage its keywords and help categories.</p>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Project Settings" subtitle="Manage keywords and help categories for your project" />
        <main className="flex-1 py-6 px-8 overflow-y-auto">
          <div className="max-w-4xl space-y-8">
            {/* Admins */}
            <Card className="border-0 shadow-none rounded-lg py-0">
              <CardContent className="py-6 px-0">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-base font-semibold text-foreground">Admins</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Admins can manage helpers, settings, payouts, and invite other admins.
                </p>

                {adminsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading admins...
                  </div>
                ) : admins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No admins yet.</p>
                ) : (
                  <div className="divide-y divide-border rounded-md border border-border overflow-hidden mb-9">
                    {admins.map((admin) => (
                      <div key={admin.user_id} className="flex items-center gap-3 px-4 py-3 bg-card">
                        <div
                          className="w-9 h-9 rounded-[12px] flex items-center justify-center text-sm font-medium text-foreground"
                          style={{ backgroundColor: getAvatarColorHexForId(admin.user_id) }}
                        >
                          {getInitials(admin.name, admin.email)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {admin.name || admin.email || "Unknown"}
                          </p>
                          {admin.email && (
                            <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <p className="text-[13px] font-semibold text-foreground mb-2">Promote an existing helper</p>
                    <div className="flex gap-2">
                      <Select
                        value={promoteHelperId}
                        onValueChange={setPromoteHelperId}
                        disabled={helpersLoading || promotableHelpers.length === 0}
                      >
                        <SelectTrigger className="max-w-xs">
                          <SelectValue
                            placeholder={
                              helpersLoading
                                ? "Loading helpers..."
                                : promotableHelpers.length === 0
                                ? "No helpers available"
                                : "Choose helper"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {promotableHelpers.map((h) => (
                            <SelectItem key={h.helper_id} value={h.user_id ?? h.helper_id}>
                              {h.user?.name || h.user?.email || h.user_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-auto gap-[10px] px-5 py-2 has-[>svg]:px-5 text-[13px] font-medium"
                        onClick={handlePromoteHelper}
                        disabled={!promoteHelperId || promoteToAdmin.isPending}
                      >
                        {promoteToAdmin.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                        Promote
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-[13px] font-semibold text-foreground mb-2">Invite a new admin</p>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="email@example.com (optional)"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleInviteAdmin()}
                        className="max-w-xs"
                      />
                      <Button
                        size="sm"
                        className="h-auto gap-[10px] px-5 py-2 has-[>svg]:px-5 text-[13px] font-medium"
                        onClick={handleInviteAdmin}
                        disabled={createInvite.isPending}
                      >
                        {createInvite.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                        Create invite
                      </Button>
                    </div>
                    {latestInviteLink && (
                      <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                        <code className="flex-1 truncate text-muted-foreground">{latestInviteLink}</code>
                        <button
                          type="button"
                          onClick={handleCopyInvite}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Copy invite link"
                        >
                          {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Keywords / Topics */}
            <Card className="border-0 shadow-none rounded-lg py-0">
              <CardContent className="py-6 px-0">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-base font-semibold text-foreground">Keywords & topics</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Keywords help categorize tickets and let helpers indicate which topics they can help with.
                </p>

                <div className="flex gap-2 mb-9">
                  <Input
                    placeholder="Add a keyword (e.g. Events, Kafka, React)"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                    className="max-w-xs"
                  />
                  <Button
                    size="sm"
                    className="h-auto gap-[10px] px-5 py-2 has-[>svg]:px-5 text-[13px] font-medium"
                    onClick={handleAddKeyword}
                    disabled={!newKeyword.trim() || createKeyword.isPending}
                  >
                    {createKeyword.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Add
                  </Button>
                </div>

                {keywordsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading keywords...
                  </div>
                ) : keywords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No keywords yet. Add one above.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((kw) => (
                      <div
                        key={kw.id}
                        className="flex items-center gap-[10px] rounded-md border border-[rgba(0,0,0,0.06)] px-5 py-2 bg-muted/50"
                      >
                        <span className="text-[13px] font-medium">{kw.value}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteKeyword(kw.id)}
                          disabled={deleteKeyword.isPending}
                          className="text-muted-foreground hover:text-destructive p-0.5"
                          aria-label={`Remove ${kw.value}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Help categories */}
            <Card className="border-0 shadow-none rounded-lg py-0">
              <CardContent className="py-6 px-0">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-base font-semibold text-foreground">Help categories</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Help categories classify ticket types (e.g. Bug, Best practice, Documentation).
                </p>

                <div className="flex gap-2 mb-9">
                  <Input
                    placeholder="Add a category (e.g. Bug, Documentation)"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                    className="max-w-xs"
                  />
                  <Button
                    size="sm"
                    className="h-auto gap-[10px] px-5 py-2 has-[>svg]:px-5 text-[13px] font-medium"
                    onClick={handleAddCategory}
                    disabled={!newCategory.trim() || createCategory.isPending}
                  >
                    {createCategory.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Add
                  </Button>
                </div>

                {categoriesLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading categories...
                  </div>
                ) : helpCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No help categories yet. Add one above.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {helpCategories.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center gap-[10px] rounded-md border border-[rgba(0,0,0,0.06)] px-5 py-2 bg-muted/50"
                      >
                        <span className="text-[13px] font-medium">{cat.value}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          disabled={deleteCategory.isPending}
                          className="text-muted-foreground hover:text-destructive p-0.5"
                          aria-label={`Remove ${cat.value}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
