"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { StaffConsole } from "@/components/staff/staff-console"

export default function StaffPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="GitHelp staff" subtitle="Outreach to maintainers, independent helpers and unclaimed projects" />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl">
            <StaffConsole />
          </div>
        </main>
      </div>
    </div>
  )
}
