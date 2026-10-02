"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MyApplications } from "@/components/unlisted/my-applications"

export default function UserApplicationsPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Independent helper applications" subtitle="Projects you offered to help on before their maintainers joined GitHelp" />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
            <MyApplications />
          </div>
        </main>
      </div>
    </div>
  )
}
