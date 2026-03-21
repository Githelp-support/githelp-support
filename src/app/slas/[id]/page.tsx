"use client"

import { useState, use } from "react"
import Link from "next/link"
import { ArrowLeft, Info, Copy, Edit, ExternalLink, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

// Mock data for SLA details
const slaDetails = {
  "elastic-software": {
    id: "elastic-software",
    name: "Elastic Software",
    avatar: "E",
    avatarColor: "#cbbcf6",
    spaceId: "287LCK684TWV10",
    agreementDetails: {
      ratesBeyond: {
        ticketStartPrice: 10.0,
        pricePerMinuteFirst60: 1.5,
        pricePerMinuteAfter60: 1.0,
      },
      includedSupport: {
        totalTimePerMonth: "5 hours",
        rolloverTime: "Yes",
        rolloverTimeFromLastMonth: "0 hours",
      },
      responseTimes: {
        maximumResponseTime: "1.5 hour",
        maximumDownTime: "6 hours",
      },
    },
    stats: {
      ticketsSolved: 4,
      totalTimeSpent: "49min",
      supportTimeRemaining: "4h 11min",
      percentageSolved: 100,
    },
    helpers: [
      { name: "Evan Sanders", avatar: "E", avatarColor: "#bcedf6", tickets: 3, totalTime: "40m" },
      { name: "Arman Lato", avatar: "A", avatarColor: "#f6e6bc", tickets: 1, totalTime: "9m" },
    ],
    issueTypes: [
      { name: "Dependency", tickets: 2, totalTime: "26m" },
      { name: "Best practice", tickets: 2, totalTime: "23m" },
    ],
    tickets: [
      {
        id: "2734587",
        date: "19/04/2025",
        helper: "Arman L.",
        helperAvatar: "A",
        amount: "USD 0.00",
        status: "Completed",
      },
      {
        id: "2734352",
        date: "16/04/2025",
        helper: "Evan S.",
        helperAvatar: "E",
        amount: "USD 0.00",
        status: "Completed",
      },
      {
        id: "2733636",
        date: "08/04/2025",
        helper: "Evan S.",
        helperAvatar: "E",
        amount: "USD 0.00",
        status: "Completed",
      },
      {
        id: "2732897",
        date: "09/04/2025",
        helper: "Arman L.",
        helperAvatar: "A",
        amount: "USD 0.00",
        status: "Completed",
      },
    ],
  },
}

export default function SLADetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const [timePeriod, setTimePeriod] = useState("current-month")
  const [helpersView, setHelpersView] = useState("view-all")
  const { id } = use(params)
  const sla = slaDetails[id as keyof typeof slaDetails]

  if (!sla) {
    return <div>SLA not found</div>
  }

  const copySpaceId = () => {
    navigator.clipboard.writeText(sla.spaceId)
  }

  return (
    <div className="flex h-screen bg-muted">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="SLA Details" subtitle="View and manage SLA configuration" />

        <main className="flex-1 overflow-auto p-6">
          {/* Back navigation */}
          <div className="mb-6">
            <Link
              href="/slas"
              className="inline-flex items-center text-brand-primary hover:text-brand-primary/80 text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to list of SLAs
            </Link>
          </div>

          {/* SLA header */}
          <div className="flex items-center gap-4 mb-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-semibold"
              style={{ backgroundColor: sla.avatarColor }}
            >
              {sla.avatar}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">{sla.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Space ID:</span>
                <span className="font-mono">{sla.spaceId}</span>
                <Button variant="ghost" size="sm" onClick={copySpaceId} className="h-auto p-1 hover:bg-brand-primary/10">
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Agreement details */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Agreement details</h2>
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>
              <Button variant="outline" className="border-border text-muted-foreground hover:bg-muted bg-transparent">
                <Edit className="w-4 h-4 mr-2" />
                Edit agreement
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Rates beyond support included */}
              <Card className="border-border py-0">
                <CardContent className="p-0">
                  <h3 className="font-medium text-foreground mb-4">Rates beyond support included</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Ticket start price</span>
                      <span className="text-sm font-medium">
                        ${sla.agreementDetails.ratesBeyond.ticketStartPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Price/minute - first 60 minutes</span>
                      <span className="text-sm font-medium">
                        ${sla.agreementDetails.ratesBeyond.pricePerMinuteFirst60.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Price/minute - after 60 minutes</span>
                      <span className="text-sm font-medium">
                        ${sla.agreementDetails.ratesBeyond.pricePerMinuteAfter60.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Included support */}
              <Card className="border-border py-0">
                <CardContent className="p-0">
                  <h3 className="font-medium text-foreground mb-4">Included support</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total time in SLA/month</span>
                      <span className="text-sm font-medium">
                        {sla.agreementDetails.includedSupport.totalTimePerMonth}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Rollover time</span>
                      <span className="text-sm font-medium">{sla.agreementDetails.includedSupport.rolloverTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Rollover time from last month</span>
                      <span className="text-sm font-medium">
                        {sla.agreementDetails.includedSupport.rolloverTimeFromLastMonth}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Response times */}
              <Card className="border-border py-0">
                <CardContent className="p-0">
                  <h3 className="font-medium text-foreground mb-4">Response times</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Maximum response time</span>
                      <span className="text-sm font-medium">
                        {sla.agreementDetails.responseTimes.maximumResponseTime}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Maximum down time</span>
                      <span className="text-sm font-medium">{sla.agreementDetails.responseTimes.maximumDownTime}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Time period filters */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={timePeriod === "current-month" ? "default" : "outline"}
              onClick={() => setTimePeriod("current-month")}
              className={
                timePeriod === "current-month"
                  ? "bg-brand-primary hover:bg-brand-primary/90"
                  : "border-border text-muted-foreground hover:bg-muted"
              }
            >
              Current month
            </Button>
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-[140px] border-border">
                <SelectValue placeholder="Choose month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="april-2025">April 2025</SelectItem>
                <SelectItem value="march-2025">March 2025</SelectItem>
                <SelectItem value="february-2025">February 2025</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={timePeriod === "all-time" ? "default" : "outline"}
              onClick={() => setTimePeriod("all-time")}
              className={
                timePeriod === "all-time"
                  ? "bg-brand-primary hover:bg-brand-primary/90"
                  : "border-border text-muted-foreground hover:bg-muted"
              }
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Number of tickets solved</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{sla.stats.ticketsSolved}</div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Total time spent</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{sla.stats.totalTimeSpent}</div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Support time remaining</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{sla.stats.supportTimeRemaining}</div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">Percentage solved</span>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold text-foreground">{sla.stats.percentageSolved}%</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Helpers and Issue types */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Helpers */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Helpers ({sla.helpers.length})</h2>
              </div>

              {/* Helper filter tabs */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={helpersView === "view-all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHelpersView("view-all")}
                  className={
                    helpersView === "view-all"
                      ? "bg-brand-primary hover:bg-brand-primary/90 text-white"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }
                >
                  View all
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                >
                  Core team
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                >
                  Extended team
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                >
                  Community
                </Button>
              </div>

              <Card className="border-border py-0">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-brand-primary/10">
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">No of tickets</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Total time</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sla.helpers.map((helper, index) => (
                          <tr key={index} className="border-b border-border hover:bg-muted">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                                  style={{ backgroundColor: helper.avatarColor }}
                                >
                                  {helper.avatar}
                                </div>
                                <span className="text-foreground font-medium">{helper.name}</span>
                              </div>
                            </td>
                            <td className="p-4 text-muted-foreground">{helper.tickets}</td>
                            <td className="p-4 text-muted-foreground">{helper.totalTime}</td>
                            <td className="p-4">
                              <Button variant="ghost" size="sm" className="text-brand-primary hover:bg-brand-primary/10">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Issue types */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Issue types ({sla.issueTypes.length})</h2>
              <Card className="border-border py-0">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-brand-primary/10">
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">No of tickets</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Total time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sla.issueTypes.map((issueType, index) => (
                          <tr key={index} className="border-b border-border hover:bg-muted">
                            <td className="p-4 text-foreground font-medium">{issueType.name}</td>
                            <td className="p-4 text-muted-foreground">{issueType.tickets}</td>
                            <td className="p-4 text-muted-foreground">{issueType.totalTime}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* All tickets */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">All tickets ({sla.tickets.length})</h2>
            <Card className="border-border py-0">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-brand-primary/10">
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                          <input type="checkbox" className="mr-3" />
                          Ticket ID
                        </th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Helper</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Amount</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sla.tickets.map((ticket) => (
                        <tr key={ticket.id} className="border-b border-border hover:bg-muted">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <input type="checkbox" />
                              <span className="text-foreground font-medium">{ticket.id}</span>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">{ticket.date}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#bcedf6] flex items-center justify-center text-xs font-semibold">
                                {ticket.helperAvatar}
                              </div>
                              <span className="text-muted-foreground">{ticket.helper}</span>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">{ticket.amount}</td>
                          <td className="p-4">
                            <Badge variant="secondary" className="bg-status-success-bg text-status-success-text border-0">
                              ✓ {ticket.status}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                              >
                                Open
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Download PDF
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
