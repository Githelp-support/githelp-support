"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MyRequests } from "@/components/unlisted/my-requests"

export default function UserRequestsPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Support requests" subtitle="Projects you asked for support that aren't run by their maintainers on GitHelp yet" />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
            <MyRequests />
          </div>
        </main>
      </div>
    </div>
  )
}
