"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { MoreVertical, Plus, Search, ChevronDown, ChevronUp, ChevronsUpDown, Copy, X, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { AddHelperDrawer } from "@/components/drawers/add-helper-drawer"
import { AcceptRequestDrawer } from "@/components/drawers/accept-request-drawer"
import { useHelpers, useCreateHelper, useAddSelfAsHelper } from "@/hooks/useHelpers"
import { usePendingRequests, useUpdatePendingRequest } from "@/hooks/usePendingRequests"
import { useCreateProjectInvite, useListProjectInvites, useRevokeProjectInvite } from "@/hooks/useProject"
import { useProjectSelection } from "@/contexts/project-context"
import { useUser } from "@/contexts/user-context"
import { getAvatarColorHexForId } from "@/lib/constants"
import Link from "next/link"

function isPendingInvite(invite: {
  is_active: boolean
  uses_count: number
  max_uses: number | null
  github_username: string | null
  email: string | null
  invite_type: string
}) {
  if (!invite.is_active) return false

  const isMultiUseLink =
    !invite.github_username &&
    !invite.email &&
    invite.invite_type !== "admin" &&
    (invite.max_uses === null || invite.uses_count < invite.max_uses)

  return isMultiUseLink || invite.uses_count === 0
}

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

type SortField = "name" | "discordUser" | "category" | "githubAccount"
type SortDirection = "asc" | "desc" | null

function HelpersSortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField | null; sortDirection: SortDirection }) {
  if (sortField !== field || sortDirection === null) {
    return <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
  }
  return sortDirection === "desc" ? (
    <ChevronDown className="w-4 h-4 text-brand-primary" />
  ) : (
    <ChevronUp className="w-4 h-4 text-brand-primary" />
  )
}

const mapCategoryToLabel = {
  core: "Core team",
  extended: "Extended team",
  community: "Community"
}

export default function HelpersPage() {
  const searchParams = useSearchParams()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isAcceptDrawerOpen, setIsAcceptDrawerOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)

  const [selectedCategory, setSelectedCategory] = useState<string>("All helpers")
  const [searchQuery, setSearchQuery] = useState<string>("")

  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // Derive view from URL so we don't need setState in effect
  const currentView = (searchParams.get("view") === "requests" ? "requests" : searchParams.get("view") === "invited" ? "invited" : "added") as "added" | "requests" | "invited"

  const { selectedProjectId } = useProjectSelection()
  const projectId = selectedProjectId ?? undefined
  const { user } = useUser()

  // Fetch helpers and pending requests
  const { data: helpersData, isLoading: helpersLoading } = useHelpers(projectId)
  const { data: pendingRequestsData, isLoading: requestsLoading } = usePendingRequests(projectId)
  const { data: helperInvitesData, isLoading: invitesLoading } = useListProjectInvites(projectId, "helper")
  const createHelper = useCreateHelper()
  const addSelfAsHelper = useAddSelfAsHelper()
  const updatePendingRequest = useUpdatePendingRequest()
  const createInvite = useCreateProjectInvite()
  const revokeInvite = useRevokeProjectInvite()

  // Admin is a helper if their user_id appears in the project's helpers list
  const isCurrentUserHelper = !!(
    user?.id &&
    helpersData?.some((h) => h.user_id === user.id)
  )
  const isAdmin = user.role === "admin"
  const showAddSelfAsHelper = isAdmin && !isCurrentUserHelper && !!user?.id && !!projectId

  // Transform helpers data to match UI format
  const helpers = useMemo(() => {
    if (!helpersData) return []
    return helpersData.map((helper) => ({
      id: helper.helper_id,
      name: helper.user?.name || "Unknown",
      initial: (helper.user?.name || "U")[0].toUpperCase(),
      discordUser: helper.user?.username || "-",
      githubAccount: helper.user?.username || "-",
      category: helper.category || "Community",
      color: getAvatarColorHexForId(helper.user_id ?? helper.helper_id),
      isRegistered: !!helper.user_id,
    }))
  }, [helpersData])

  // Transform pending requests data to match UI format
  const pendingRequests = useMemo(() => {
    if (!pendingRequestsData) return []
    return pendingRequestsData.map((request) => ({
      ...request,
      initial: (request.name || "U")[0].toUpperCase(),
      discordUser: request.name || "-",
      githubAccount: request.email || "-",
      color: getAvatarColorHexForId(request.user_id ?? request.email ?? request.name),
    }))
  }, [pendingRequestsData])

  const handleAddHelper = async (newHelper: {
    category: string
    email?: string
    inviteMethod: "email" | "link" | "contributors" | "github_username"
    invitee_identifier?: string
    github_username?: string
    github_usernames?: string[]
  }) => {
    if (!projectId) {
      throw new Error("Project ID is required")
    }

    if (newHelper.inviteMethod === "contributors" && newHelper.github_usernames?.length) {
      const inviteUrls: Record<string, string> = {}
      for (const login of newHelper.github_usernames) {
        const result = await createInvite.mutateAsync({
          project_id: projectId,
          invite_type: "helper",
          category: newHelper.category as "core" | "extended" | "community",
          github_username: login,
          invitee_identifier: login,
        })
        inviteUrls[login] = result.invite_url
      }
      return { invite_urls: inviteUrls }
    }

    // Create helper invite using the new invite system
    const result = await createInvite.mutateAsync({
      project_id: projectId,
      invite_type: "helper",
      category: newHelper.category as "core" | "extended" | "community",
      email: newHelper.email,
      invitee_identifier: newHelper.invitee_identifier,
      github_username: newHelper.github_username,
    })

    return { invite_url: result.invite_url }
  }

  const handleAcceptRequest = (index: number) => {
    if (pendingRequests[index]) {
      setSelectedRequest(pendingRequests[index])
      setIsAcceptDrawerOpen(true)
    }
  }

  const handleAddSelfAsHelper = async () => {
    if (!projectId || !user?.id) return
    try {
      await addSelfAsHelper.mutateAsync({
        project_id: projectId,
        user_id: user.id,
        category: "core",
      })
      toast.success("You have been added as a helper.")
    } catch (error) {
      console.error("Failed to add yourself as helper:", error)
      toast.error("Failed to add yourself as helper. Please try again.")
    }
  }

  const handleRejectRequest = async (index: number) => {
    const request = pendingRequests[index]
    if (!request || !projectId) return

    await updatePendingRequest.mutateAsync({
      userId: request.user_id,
      projectId: projectId,
      status: "rejected",
    })
  }

  const handleConfirmAcceptRequest = async (requestData: { category: string }) => {
    if (!selectedRequest || !projectId) return

    // Update the pending request status
    await updatePendingRequest.mutateAsync({
      userId: selectedRequest.user_id,
      projectId: projectId,
      status: "accepted",
    })

    // Use createHelper.mutateAsync which will invoke the invite-user edge function
    // Note: For pending requests, we may not have discord_username or github_username
    // The edge function will handle existing users (user_exists will be true)
    await createHelper.mutateAsync({
      discord_username: selectedRequest.name || "", // Fallback to name if discord username not available
      github_username: selectedRequest.email?.split("@")[0] || "", // Fallback to email prefix if github username not available
      name: selectedRequest.name,
      email: selectedRequest.email,
      category: requestData.category, // Using enum values: core, extended, or community
      project_id: projectId,
    })

    setSelectedRequest(null)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortField(null)
        setSortDirection(null)
      } else {
        setSortDirection("asc")
      }
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const filteredHelpers = helpers
    .filter((helper) => {
      const matchesCategory = selectedCategory === "All helpers" || helper.category === selectedCategory
      const matchesSearch =
        searchQuery === "" ||
        helper.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        helper.discordUser.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (helper.githubAccount && helper.githubAccount.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchesCategory && matchesSearch
    })
    .sort((a, b) => {
      if (!sortField || !sortDirection) return 0

      let aValue = ""
      let bValue = ""

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case "discordUser":
          aValue = a.discordUser.toLowerCase()
          bValue = b.discordUser.toLowerCase()
          break
        case "githubAccount":
          aValue = (a.githubAccount || "").toLowerCase()
          bValue = (b.githubAccount || "").toLowerCase()
          break
        case "category":
          aValue = a.category.toLowerCase()
          bValue = b.category.toLowerCase()
          break
        default:
          return 0
      }

      if (sortDirection === "asc") {
        return aValue.localeCompare(bValue)
      } else {
        return bValue.localeCompare(aValue)
      }
    })

  const filteredInvites = useMemo(() => {
    if (!helperInvitesData) return []
    return helperInvitesData.filter((invite) => {
      if (!isPendingInvite(invite)) return false
      const matchesCategory =
        selectedCategory === "All helpers" || invite.category === selectedCategory
      const identifier =
        invite.invitee_identifier || invite.email || invite.github_username || ""
      const matchesSearch =
        searchQuery === "" ||
        identifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (invite.github_username?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      return matchesCategory && matchesSearch
    })
  }, [helperInvitesData, selectedCategory, searchQuery])

  const filteredRequests = pendingRequests
    .filter((request) => {
      const matchesSearch =
        searchQuery === "" ||
        request.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.discordUser.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch
    })
    .sort((a, b) => {
      if (!sortField || !sortDirection) return 0

      let aValue = ""
      let bValue = ""

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case "discordUser":
          aValue = a.discordUser.toLowerCase()
          bValue = b.discordUser.toLowerCase()
          break
        case "githubAccount":
          aValue = a.githubAccount.toLowerCase()
          bValue = b.githubAccount.toLowerCase()
          break
        default:
          return 0
      }

      if (sortDirection === "asc") {
        return aValue.localeCompare(bValue)
      } else {
        return bValue.localeCompare(aValue)
      }
    })

  const handleViewChange = (newView: "added" | "requests" | "invited") => {
    const url = new URL(window.location.href)
    if (newView === "requests") {
      url.searchParams.set("view", "requests")
    } else if (newView === "invited") {
      url.searchParams.set("view", "invited")
    } else {
      url.searchParams.delete("view")
    }
    window.history.pushState({}, "", url.toString())

    // Reset sorting when switching views
    setSortField(null)
    setSortDirection(null)
    // Reset search when switching views
    setSearchQuery("")
  }

  const handleCopyInviteLink = async (inviteUrl: string) => {
    await navigator.clipboard.writeText(inviteUrl)
    toast.success("Invite link copied to clipboard!")
  }

  const handleRevokeInvite = async (inviteId: string) => {
    if (!projectId) return
    try {
      await revokeInvite.mutateAsync({
        invite_id: inviteId,
        project_id: projectId,
      })
      toast.success("Invite revoked successfully")
    } catch (error) {
      toast.error("Failed to revoke invite")
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="List of helpers" subtitle="Manage your support team" />

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Filter tabs and Add button */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex space-x-1">
              <Button
                variant={selectedCategory === "All helpers" ? "neutral" : "ghost"}
                size="sm"
                className={
                  selectedCategory === "All helpers"
                    ? ""
                    : "text-muted-foreground"
                }
                onClick={() => setSelectedCategory("All helpers")}
              >
                All helpers
              </Button>
              <Button
                variant={selectedCategory === "core" ? "neutral" : "ghost"}
                size="sm"
                className={
                  selectedCategory === "core"
                    ? ""
                    : "text-muted-foreground"
                }
                onClick={() => setSelectedCategory("core")}
              >
                Core team
              </Button>
              <Button
                variant={selectedCategory === "extended" ? "neutral" : "ghost"}
                size="sm"
                className={
                  selectedCategory === "extended"
                    ? ""
                    : "text-muted-foreground"
                }
                onClick={() => setSelectedCategory("extended")}
              >
                Extended team
              </Button>
              <Button
                variant={selectedCategory === "community" ? "neutral" : "ghost"}
                size="sm"
                className={
                  selectedCategory === "community"
                    ? ""
                    : "text-muted-foreground"
                }
                onClick={() => setSelectedCategory("community")}
              >
                Community
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {showAddSelfAsHelper && (
                <Button
                  variant="outline"
                  className="border-brand-primary text-brand-primary hover:bg-brand-primary/10 rounded-xl text-[13px] font-medium"
                  onClick={handleAddSelfAsHelper}
                  disabled={addSelfAsHelper.isPending}
                >
                  <UserPlus className="w-4 h-4" />
                  Add myself as helper
                </Button>
              )}
              <Button className="bg-brand-primary hover:bg-brand-primary/90 text-white rounded-md px-5 py-2.5 text-[13px] font-medium shadow-sm" onClick={() => setIsDrawerOpen(true)}>
                <Plus className="w-4 h-4" />
                Add new helper
              </Button>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4 mb-6">
            {/* Added/Requests dropdown and Search input - 50/50 split */}
            <div className="grid grid-cols-2 gap-4">
              <Select value={currentView} onValueChange={(value) => handleViewChange(value as "added" | "requests" | "invited")}>
                <SelectTrigger className="w-full h-[46px] data-[size=default]:h-[46px] border-[#E1E1E1] shadow-none rounded-lg text-[14px] font-normal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="added" className="text-[14px] font-normal">Added</SelectItem>
                  <SelectItem value="requests" className="text-[14px] font-normal">Requests</SelectItem>
                  <SelectItem value="invited" className="text-[14px] font-normal">Invites</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="w-[18px] h-[18px] absolute left-3.5 top-1/2 transform -translate-y-1/2 text-[#94a3b8]" />
                <Input
                  placeholder="Search name or GitHub account"
                  className="pl-10 h-[46px] border-[#E1E1E1] shadow-none rounded-lg text-[13px] placeholder:text-[#94a3b8] focus:border-brand-primary transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Open for new helpers toggle - separate row */}
            <div className="flex items-center space-x-3">
              <span className="text-[13px] font-medium text-foreground">Open for new helpers</span>
              <Switch defaultChecked className="h-[22px] w-[38px] p-[3px] border-0 data-[state=checked]:bg-[#4AA19E]" />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-[#E1E1E1] shadow-none overflow-hidden">
            {/* Table Header */}
            <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
              {currentView === "invited" ? (
                <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                  <div>
                    <input type="checkbox" className="rounded border-border" />
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-medium text-foreground">Helper</span>
                  </div>
                  <div className="col-span-1"></div>
                  <div className="col-span-2">
                    <span className="text-sm font-medium text-foreground">Category</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-medium text-foreground">Created</span>
                  </div>
                  <div className="col-span-1"></div>
                  <div className="col-span-1">
                    <span className="text-sm font-medium text-foreground">Status</span>
                  </div>
                  <div className="col-span-2"></div>
                </div>
              ) : (
                <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                  <div>
                    <input type="checkbox" className="rounded border-border" />
                  </div>
                  <div className="col-span-3 flex items-center space-x-2">
                    <button type="button"
                      onClick={() => handleSort("name")}
                      className="flex items-center space-x-2 cursor-pointer hover:text-brand-primary transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground">Helper</span>
                      <HelpersSortIcon field="name" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </div>
                  <div className="col-span-3 flex items-center space-x-2">
                    <button type="button"
                      onClick={() => handleSort("githubAccount")}
                      className="flex items-center space-x-2 cursor-pointer hover:text-brand-primary transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground">Github user</span>
                      <HelpersSortIcon field="githubAccount" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </div>
                  <div className="col-span-2">
                    <button type="button"
                      onClick={() => handleSort("category")}
                      className="flex items-center space-x-2 cursor-pointer hover:text-brand-primary transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground">Category</span>
                      <HelpersSortIcon field="category" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </div>
                  <div className="col-span-3"></div>
                </div>
              )}
            </div>

            {/* Table Body */}
            <div className="divide-y divide-border">
              {(() => {
                if (!projectId) {
                  return (
                    <div className="px-6 py-12 text-center">
                      <p className="text-[13px] text-muted-foreground mb-2">Select a project from the sidebar to view helpers.</p>
                      <p className="text-[13px] text-muted-foreground">If you don&apos;t see any projects, you may need to create one or be invited to a project first.</p>
                    </div>
                  )
                }
                if (helpersLoading || requestsLoading || invitesLoading) {
                  return <div className="px-6 py-8 text-center text-[13px] text-muted-foreground">Loading...</div>
                }
                if (currentView === "invited") {
                  if (filteredInvites.length > 0) {
                  return filteredInvites.map((invite) => (
                      <div key={invite.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                        <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                          <div>
                            <input type="checkbox" className="rounded border-border" />
                          </div>
                          <div className="col-span-2 flex items-center space-x-2">
                            <span className="text-sm font-medium text-foreground">
                              {invite.invitee_identifier || invite.email || invite.github_username || "No identifier"}
                            </span>
                          </div>
                          <div className="col-span-1"></div>
                          <div className="col-span-2 flex items-center space-x-2">
                            <span className="text-sm text-muted-foreground">
                              {invite.category
                                ? mapCategoryToLabel[invite.category as keyof typeof mapCategoryToLabel]
                                : "-"}
                            </span>
                          </div>
                          <div className="col-span-2 flex items-center space-x-2">
                            <span className="text-sm text-muted-foreground tabular-nums">
                              {new Date(invite.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="col-span-1"></div>
                          <div className="col-span-1">
                            <Badge 
                              variant="secondary" 
                              className={invite.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}
                            >
                              {invite.is_active ? "Active" : "Revoked"}
                            </Badge>
                          </div>
                          <div className="col-span-2 flex items-center justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-muted-foreground border-border hover:bg-muted bg-transparent"
                              onClick={() => handleCopyInviteLink(invite.invite_url)}
                            >
                              <Copy className="w-4 h-4 mr-1" />
                              Copy link
                            </Button>
                            {invite.is_active && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-red-200 hover:bg-red-50 bg-transparent"
                                onClick={() => handleRevokeInvite(invite.id)}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Revoke
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:bg-muted">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                  const hasActiveInvites = helperInvitesData?.some((invite) => isPendingInvite(invite))
                  if (!hasActiveInvites) {
                    return (
                      <div className="px-6 py-8 text-center text-[13px] text-muted-foreground">No pending invites</div>
                    )
                  }
                  return (
                    <div className="px-6 py-12 text-center text-muted-foreground">
                      <p className="text-[13px] mb-2">No invites match your filters.</p>
                      <p className="text-[13px]">Try clearing search or switching category to see invites.</p>
                    </div>
                  )
                }
                if (currentView === "added") {
                  if (filteredHelpers.length > 0) {
                    return filteredHelpers.map((helper, index) => (
                    <div key={index} className="px-6 py-4 hover:bg-[#f7f9ff]">
                      <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                        <div>
                          <input type="checkbox" className="rounded border-border" />
                        </div>
                        <div className="col-span-3 flex items-center gap-[18px]">
                          <div
                            className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                            style={{ backgroundColor: helper.color }}
                          >
                            {helper.initial}
                          </div>
                          <span className="text-sm font-medium text-foreground">{helper.name}</span>
                        </div>
                        <div className="col-span-3 flex items-center space-x-2">
                          <GithubIcon className="w-4 h-4 text-foreground" />
                          <span className="text-sm text-[#0F0F11]">{helper.githubAccount || "-"}</span>
                        </div>
                        <div className="col-span-2">
                          <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted text-[13px] px-3 py-1">
                            {helper.category
                              ? mapCategoryToLabel[helper.category as keyof typeof mapCategoryToLabel]
                              : ""}
                          </Badge>
                        </div>
                        <div className="col-span-3 flex items-center justify-end space-x-2">
                          {helper.isRegistered ? (
                            <Link href={`/helpers/${helper.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-muted-foreground border-border hover:bg-muted bg-transparent"
                              >
                                See profile
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground px-3 py-1">Not registered</span>
                          )}
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:bg-muted">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                  }
                  const noRealHelpers = (helpersData?.length ?? 0) === 0
                  if (noRealHelpers && projectId) {
                    return (
                      <div className="px-6 py-12 text-center">
                        <p className="text-[13px] text-muted-foreground mb-2">No helpers yet.</p>
                        <p className="text-[13px] text-muted-foreground mb-4">Add helpers by inviting them via email or sharing an invite link.</p>
                        <Button className="rounded-md px-5 text-[14px] font-semibold bg-brand-primary hover:bg-brand-primary/90 text-white shadow-md" onClick={() => setIsDrawerOpen(true)}>
                          <Plus className="w-4 h-4" />
                          Add new helper
                        </Button>
                      </div>
                    )
                  }
                  return (
                    <div className="px-6 py-12 text-center text-muted-foreground">
                      <p className="text-[13px] mb-2">No helpers match your filters.</p>
                      <p className="text-[13px]">Try clearing search or switching category to see your team.</p>
                    </div>
                  )
                }
                return filteredRequests.length > 0 ? (
                  filteredRequests.map((request, index) => (
                    <div key={request.user_id || index} className="px-6 py-4 hover:bg-[#f7f9ff]">
                      <div className="grid gap-4 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                        <div>
                          <input type="checkbox" className="rounded border-border" />
                        </div>
                        <div className="col-span-3 flex items-center gap-[18px]">
                          <div
                            className="w-8 h-8 rounded-[11px] flex items-center justify-center text-sm font-medium text-foreground shrink-0"
                            style={{ backgroundColor: request.color }}
                          >
                            {request.initial}
                          </div>
                          <span className="text-sm font-medium text-foreground">{request.name}</span>
                        </div>
                        <div className="col-span-3 flex items-center space-x-2">
                          <GithubIcon className="w-4 h-4 text-foreground" />
                          <span className="text-sm text-[#0F0F11]">{request.githubAccount}</span>
                        </div>
                        <div className="col-span-5 flex items-center justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-muted-foreground border-border hover:bg-muted bg-transparent"
                            onClick={() => handleRejectRequest(index)}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="bg-brand-primary hover:bg-brand-primary/90 text-white"
                            onClick={() => handleAcceptRequest(index)}
                          >
                            Accept
                          </Button>
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:bg-muted">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-8 text-center text-[13px] text-muted-foreground">No pending requests</div>
                )
              })()}
            </div>
          </div>
        </main>
      </div>

      <AddHelperDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        projectId={projectId}
        onSubmit={handleAddHelper}
      />
      <AcceptRequestDrawer
        isOpen={isAcceptDrawerOpen}
        onClose={() => {
          setIsAcceptDrawerOpen(false)
          setSelectedRequest(null)
        }}
        onSubmit={handleConfirmAcceptRequest}
        requestData={selectedRequest}
      />
    </div>
  )
}

