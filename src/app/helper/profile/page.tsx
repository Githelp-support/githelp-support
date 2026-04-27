"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { ChevronsUpDown, Github, Info, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { useHelper, useUpdateHelper, useUpdateUserProfile } from "@/hooks/useHelpers"
import { supabase } from "@/lib/supabase/client"
import {
  useProjectKeywords,
  useHelperKeywords,
  useSetHelperKeywords,
} from "@/hooks/useHelperKeywords"
import { useTimeEntries, formatTime, calculateTotalTime } from "@/hooks/useTimeEntries"
import { usePaymentTransfers, formatAmount } from "@/hooks/usePayments"
import { useHelperTickets } from "@/hooks/useHelperTickets"
import { useProjectSelection } from "@/contexts/project-context"
import { useCurrentHelper } from "@/hooks/useCurrentHelper"
import { useUser } from "@/contexts/user-context"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/ui/form-field"
import { Checkbox } from "@/components/ui/checkbox"
import { linkGitHubIdentity } from "@/lib/supabase/auth"

export default function HelperProfilePage() {
  const [timeFilter, setTimeFilter] = useState<"current" | "choose" | "all">("current")
  const [selectedMonth, setSelectedMonth] = useState<string>("")
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
  const { data: helperTicketsData } = useHelperTickets(helperId ?? "", projectId)
  const { data: timeEntriesData } = useTimeEntries({
    helperId: helperId ?? "",
    projectId,
  })
  const { data: transfersData } = usePaymentTransfers({
    helperId: helperId ?? "",
    projectId,
  })

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

  const generateMonthOptions = () => {
    const months = []
    const now = new Date()
    for (let i = 1; i <= 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = date.toLocaleDateString("en-US", { month: "long" })
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      months.push({ value, label: `${monthName} ${date.getFullYear()}`, monthYear: `${monthName} ${date.getFullYear()}` })
    }
    return months
  }

  const monthOptions = generateMonthOptions()

  const stats = useMemo(() => {
    if (!timeEntriesData) return { ticketsSolved: 0, totalTime: "0min", percentageSolved: 0 }
    const completedTickets = new Set(timeEntriesData.map((entry) => entry.ticket_id))
    const totalTime = calculateTotalTime(timeEntriesData)
    return {
      ticketsSolved: completedTickets.size,
      totalTime: formatTime(totalTime),
      percentageSolved: 85,
    }
  }, [timeEntriesData])

  const tickets = useMemo(() => {
    if (!helperTicketsData || helperTicketsData.length === 0) {
      if (!transfersData) return []
      return transfersData.map((transfer) => ({
        id: transfer.ticket_id?.slice(0, 5) || "-",
        fullId: transfer.ticket_id ?? "",
        date: transfer.completed_at ? new Date(transfer.completed_at).toLocaleDateString("en-GB") : "-",
        type: "Bug",
        amount: formatAmount(transfer.amount_smallest_unit, transfer.currency),
        status: transfer.status === "completed" ? "Completed" : "In progress",
      }))
    }
    const transfersMap = new Map((transfersData || []).map((t) => [t.ticket_id, t]))
    return helperTicketsData.map((ticket) => {
      const transfer = transfersMap.get(ticket.id)
      return {
        id: ticket.id.slice(0, 5),
        fullId: ticket.id,
        date: ticket.completed_at
          ? new Date(ticket.completed_at).toLocaleDateString("en-GB")
          : ticket.created_at
            ? new Date(ticket.created_at).toLocaleDateString("en-GB")
            : "-",
        type: "Bug",
        amount: transfer ? formatAmount(transfer.amount_smallest_unit, transfer.currency) : "-",
        status:
          ticket.status === "completed"
            ? "Completed"
            : ticket.status === "in-progress"
              ? "In progress"
              : ticket.status === "available"
                ? "Available"
                : "Unknown",
      }
    })
  }, [helperTicketsData, transfersData])

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

  const helperColors = ["#f4bccc", "#d1f7ea", "#bcedf6", "#f6e6bc", "#cbbcf6"]
  const isLoading = currentHelperLoading || (!!projectId && !!helperId && helperLoading)

  if (!projectId) {
    return (
      <div className="flex h-screen">
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
      <div className="flex h-screen">
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
      <div className="flex h-screen">
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
    <div className="flex h-screen">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="My profile" subtitle="View and edit your helper details" />

        <main className="flex-1 overflow-auto p-6">
          {/* Profile header */}
          <div className="flex items-center gap-4 mb-8">
            <div
              className="w-12 h-12 rounded-[25px] flex items-center justify-center text-foreground text-[21px] font-[family-name:var(--font-outfit)] font-normal"
              style={{ backgroundColor: helperColors[0] }}
            >
              {displayAvatar}
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold text-foreground">{displayName}</h1>
              <Badge variant="secondary" className="bg-brand-primary/10 text-muted-foreground border-0">
                {category}
              </Badge>
            </div>
          </div>

          {/* Editable contact information */}
          <section
            className="mb-[34px]"
            style={{ padding: '40px 38px', borderRadius: '10px', border: '1px solid #E1E1E1' }}
          >
            <h2 className="text-lg font-semibold text-foreground mb-4">Contact information</h2>
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
                    <Github className="w-5 h-5 text-muted-foreground shrink-0" />
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
                        <Github className="w-4 h-4 mr-2" />
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
          <section
            className="mb-[34px]"
            style={{ padding: '40px 38px', borderRadius: '10px', border: '1px solid #E1E1E1' }}
          >
            <h2 className="text-lg font-semibold text-foreground mb-4">Helper category</h2>
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
          <section
            className="mb-[34px]"
            style={{ padding: '40px 38px', borderRadius: '10px', border: '1px solid #E1E1E1' }}
          >
            <h2 className="text-lg font-semibold text-foreground mb-4">Topics & keywords</h2>
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
                    className="flex items-center gap-2 cursor-pointer rounded-md border border-border px-3 py-2 hover:bg-muted/50 has-[:checked]:border-brand-primary has-[:checked]:bg-brand-primary/10"
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

          {/* Time period filters */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={timeFilter === "current" ? "default" : "outline"}
              size="sm"
              className={
                timeFilter === "current"
                  ? "bg-brand-primary hover:bg-brand-primary/90 text-white"
                  : "border-border text-muted-foreground bg-transparent hover:bg-gray-50"
              }
              onClick={() => {
                setTimeFilter("current")
                setSelectedMonth("")
              }}
            >
              Current month
            </Button>
            <Select
              value={selectedMonth}
              onValueChange={(value) => {
                setSelectedMonth(value)
                setTimeFilter("choose")
              }}
            >
              <SelectTrigger
                className={`w-[180px] h-9 text-sm ${
                  timeFilter === "choose"
                    ? "bg-brand-primary text-white border-brand-primary hover:bg-brand-primary/90"
                    : "border-border text-muted-foreground bg-transparent hover:bg-gray-50"
                }`}
              >
                <SelectValue placeholder="Choose month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={timeFilter === "all" ? "default" : "outline"}
              size="sm"
              className={
                timeFilter === "all"
                  ? "bg-brand-primary hover:bg-brand-primary/90 text-white"
                  : "border-border text-muted-foreground bg-transparent hover:bg-gray-50"
              }
              onClick={() => {
                setTimeFilter("all")
                setSelectedMonth("")
              }}
            >
              All time
            </Button>
          </div>

          {/* Key stats */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-foreground">Key stats</h2>
              <Info className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Number of tickets solved</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{stats.ticketsSolved}</div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Total time spent</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{stats.totalTime}</div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Percentage solved</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{stats.percentageSolved}%</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* All tickets */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">All tickets</h2>
            <div className="bg-white rounded-lg border border-border overflow-hidden">
              <div className="bg-brand-primary/10 px-6 py-3 border-b border-border">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-foreground">
                  <div className="col-span-2 flex items-center space-x-2">
                    <span className="text-sm font-medium text-foreground">Ticket ID</span>
                    <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="col-span-2 flex items-center space-x-2">
                    <span className="text-sm font-medium text-foreground">Date</span>
                    <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="col-span-2 flex items-center space-x-2">
                    <span className="text-sm font-medium text-foreground">Ticket type</span>
                    <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="col-span-2 flex items-center space-x-2">
                    <span className="text-sm font-medium text-foreground">Amount</span>
                    <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="col-span-2 flex items-center space-x-2">
                    <span className="text-sm font-medium text-foreground">Status</span>
                    <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="col-span-2"></div>
                </div>
              </div>
              {tickets.map((ticket) => (
                <div
                  key={ticket.fullId || ticket.id}
                  className="px-6 py-4 border-b border-border last:border-b-0 hover:bg-[#f9f9f9]"
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-2">
                      <span className="text-foreground font-medium">{ticket.id}</span>
                    </div>
                    <div className="col-span-2 text-muted-foreground">{ticket.date}</div>
                    <div className="col-span-2 text-muted-foreground">{ticket.type}</div>
                    <div className="col-span-2 text-muted-foreground">{ticket.amount}</div>
                    <div className="col-span-2">
                      <Badge
                        variant="secondary"
                        className={
                          ticket.status === "Completed"
                            ? "bg-status-success-bg text-status-success-text border-0"
                            : "bg-status-warning-bg text-status-warning-text border-0"
                        }
                      >
                        {ticket.status === "Completed" && "✓ "}
                        {ticket.status}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      {ticket.fullId ? (
                        <Link href={`/helper/tickets/${ticket.fullId}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                          >
                            Open
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                          disabled
                        >
                          Open
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
