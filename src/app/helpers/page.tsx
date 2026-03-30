"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Plus, Search, ChevronDown, ChevronUp, ChevronsUpDown, Copy, X, UserPlus } from "lucide-react"
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
import Link from "next/link"

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.44-.444.963-.608 1.493a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.493.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
)

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

// Helper colors for avatars
const helperColors = ["#f4bccc", "#d0f6bc", "#bcedf6", "#f6e6bc", "#cbbcf6"]

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
    return helpersData.map((helper, index) => ({
      id: helper.helper_id,
      name: helper.user?.name || "Unknown",
      initial: (helper.user?.name || "U")[0].toUpperCase(),
      discordUser: helper.user?.username || "-",
      githubAccount: helper.user?.username || "-",
      category: helper.category || "Community",
      color: helperColors[index % helperColors.length],
      isRegistered: !!helper.user_id,
    }))
  }, [helpersData])

  // Transform pending requests data to match UI format
  const pendingRequests = useMemo(() => {
    if (!pendingRequestsData) return []
    return pendingRequestsData.map((request, index) => ({
      ...request,
      initial: (request.name || "U")[0].toUpperCase(),
      discordUser: request.name || "-",
      githubAccount: request.email || "-",
      color: helperColors[index % helperColors.length],
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
                variant={selectedCategory === "All helpers" ? "lavender" : "ghost"}
                size="sm"
                className={
                  selectedCategory === "All helpers"
                    ? "hover:bg-brand-primary/90 hover:text-white text-brand-primary"
                    : "text-muted-foreground hover:bg-brand-primary hover:text-white"
                }
                onClick={() => setSelectedCategory("All helpers")}
              >
                All helpers
              </Button>
              <Button
                variant={selectedCategory === "core" ? "lavender" : "ghost"}
                size="sm"
                className={
                  selectedCategory === "core"
                    ? "hover:bg-brand-primary/90 hover:text-white text-brand-primary"
                    : "text-muted-foreground hover:bg-brand-primary hover:text-white"
                }
                onClick={() => setSelectedCategory("core")}
              >
                Core team
              </Button>
              <Button
                variant={selectedCategory === "extended" ? "lavender" : "ghost"}
                size="sm"
                className={
                  selectedCategory === "extended"
                    ? "hover:bg-brand-primary/90 hover:text-white text-brand-primary"
                    : "text-muted-foreground hover:bg-brand-primary hover:text-white"
                }
                onClick={() => setSelectedCategory("extended")}
              >
                Extended team
              </Button>
              <Button
                variant={selectedCategory === "community" ? "lavender" : "ghost"}
                size="sm"
                className={
                  selectedCategory === "community"
                    ? "hover:bg-brand-primary/90 hover:text-white text-brand-primary"
                    : "text-muted-foreground hover:bg-brand-primary hover:text-white"
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
                  className="border-brand-primary text-brand-primary hover:bg-brand-primary/10"
                  onClick={handleAddSelfAsHelper}
                  disabled={addSelfAsHelper.isPending}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add myself as helper
                </Button>
              )}
              <Button className="h-10 rounded-xl px-5 text-[14px] font-semibold bg-brand-primary hover:bg-brand-primary/90 text-white shadow-md" onClick={() => setIsDrawerOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add new helper
              </Button>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4 mb-6">
            {/* Added/Requests dropdown and Search input - 50/50 split */}
            <div className="grid grid-cols-2 gap-4">
              <Select value={currentView} onValueChange={(value) => handleViewChange(value as 'added' | 'requests' | 'invited')}>
                <SelectTrigger className="border-input focus-visible:ring-ring w-full h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="added">Added</SelectItem>
                  <SelectItem value="requests">Requests</SelectItem>
                  <SelectItem value="invited">Invites</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, Discord user, or GitHub account"
                  className="pl-10 h-11 border-border focus:border-brand-primary"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Open for new helpers toggle - separate row */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-foreground">Open for new helpers</span>
              <Switch defaultChecked className="data-[state=checked]:bg-[#82c95f]" />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-border overflow-hidden">
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
                  <div className="col-span-2 flex items-center space-x-2">
                    <button type="button"
                      onClick={() => handleSort("name")}
                      className="flex items-center space-x-2 cursor-pointer hover:text-brand-primary transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground">Helper</span>
                      <HelpersSortIcon field="name" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </div>
                  <div className="col-span-1"></div>
                  <div className="col-span-2 flex items-center space-x-2">
                    <button type="button"
                      onClick={() => handleSort("githubAccount")}
                      className="flex items-center space-x-2 cursor-pointer hover:text-brand-primary transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground">Github user</span>
                      <HelpersSortIcon field="githubAccount" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </div>
                  <div className="col-span-2 flex items-center space-x-2">
                    <button type="button"
                      onClick={() => handleSort("discordUser")}
                      className="flex items-center space-x-2 cursor-pointer hover:text-brand-primary transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground">Discord user</span>
                      <HelpersSortIcon field="discordUser" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </div>
                  <div className="col-span-1"></div>
                  <div className="col-span-1">
                    <button type="button"
                      onClick={() => handleSort("category")}
                      className="flex items-center space-x-2 cursor-pointer hover:text-brand-primary transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground">Category</span>
                      <HelpersSortIcon field="category" sortField={sortField} sortDirection={sortDirection} />
                    </button>
                  </div>
                  <div className="col-span-2"></div>
                </div>
              )}
            </div>

            {/* Table Body */}
            <div className="divide-y divide-border">
              {(() => {
                if (!projectId) {
                  return (
                    <div className="px-6 py-12 text-center">
                      <p className="text-muted-foreground mb-2">Select a project from the sidebar to view helpers.</p>
                      <p className="text-sm text-muted-foreground">If you don&apos;t see any projects, you may need to create one or be invited to a project first.</p>
                    </div>
                  )
                }
                if (helpersLoading || requestsLoading || invitesLoading) {
                  return <div className="px-6 py-8 text-center text-muted-foreground">Loading...</div>
                }
                if (currentView === "invited") {
                  return helperInvitesData && helperInvitesData.length > 0 ? (
                  helperInvitesData
                    .filter((invite) => invite.is_active)
                    .map((invite) => (
                      <div key={invite.id} className="px-6 py-4 hover:bg-[#f7f9ff]">
                        <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
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
                            <span className="text-sm text-muted-foreground">
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
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="px-6 py-8 text-center text-muted-foreground">No pending invites</div>
                )
                }
                if (currentView === "added") {
                  return filteredHelpers.length > 0 ? (
                    filteredHelpers.map((helper, index) => (
                    <div key={index} className="px-6 py-4 hover:bg-[#f7f9ff]">
                      <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                        <div>
                          <input type="checkbox" className="rounded border-border" />
                        </div>
                        <div className="col-span-2 flex items-center space-x-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-foreground"
                            style={{ backgroundColor: helper.color }}
                          >
                            {helper.initial}
                          </div>
                          <span className="text-sm font-medium text-foreground">{helper.name}</span>
                        </div>
                        <div className="col-span-1"></div>
                        <div className="col-span-2 flex items-center space-x-2">
                          <GithubIcon className="w-4 h-4 text-foreground" />
                          <span className="text-sm text-brand-primary">{helper.githubAccount || "-"}</span>
                        </div>
                        <div className="col-span-2 flex items-center space-x-2">
                          <DiscordIcon className="w-4 h-4 text-[#5865f2]" />
                          <span className="text-sm text-muted-foreground">{helper.discordUser}</span>
                        </div>
                        <div className="col-span-1"></div>
                        <div className="col-span-1">
                          <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted">
                            {helper.category
                              ? mapCategoryToLabel[helper.category as keyof typeof mapCategoryToLabel]
                              : ""}
                          </Badge>
                        </div>
                        <div className="col-span-2 flex items-center justify-end space-x-2">
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
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-12 text-center">
                    <p className="text-muted-foreground mb-2">No helpers yet.</p>
                    <p className="text-sm text-muted-foreground mb-4">Add helpers by inviting them via email or sharing an invite link.</p>
                    <Button className="h-10 rounded-xl px-5 text-[14px] font-semibold bg-brand-primary hover:bg-brand-primary/90 text-white shadow-md" onClick={() => setIsDrawerOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add new helper
                    </Button>
                  </div>
                )
                }
                return filteredRequests.length > 0 ? (
                  filteredRequests.map((request, index) => (
                    <div key={request.user_id || index} className="px-6 py-4 hover:bg-[#f7f9ff]">
                      <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '2rem repeat(11, 1fr)' }}>
                        <div>
                          <input type="checkbox" className="rounded border-border" />
                        </div>
                        <div className="col-span-2 flex items-center space-x-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-foreground"
                            style={{ backgroundColor: request.color }}
                          >
                            {request.initial}
                          </div>
                          <span className="text-sm font-medium text-foreground">{request.name}</span>
                        </div>
                        <div className="col-span-1"></div>
                        <div className="col-span-2 flex items-center space-x-2">
                          <GithubIcon className="w-4 h-4 text-foreground" />
                          <span className="text-sm text-brand-primary">{request.githubAccount}</span>
                        </div>
                        <div className="col-span-2 flex items-center space-x-2">
                          <DiscordIcon className="w-4 h-4 text-[#5865f2]" />
                          <span className="text-sm text-muted-foreground">{request.discordUser}</span>
                        </div>
                        <div className="col-span-1"></div>
                        <div className="col-span-3 flex items-center justify-end space-x-2">
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
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-8 text-center text-muted-foreground">No pending requests</div>
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

