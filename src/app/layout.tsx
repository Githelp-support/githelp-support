import type React from "react"
import type { Metadata } from "next"
import { Inter, Outfit } from "next/font/google"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { UserProvider } from "@/contexts/user-context"
import { ProjectProvider } from "@/contexts/project-context"
import { UnsavedChangesProvider } from "@/contexts/unsaved-changes-context"
import { ReactQueryProvider } from "@/lib/react-query/provider"
import { ProtectedLayout } from "@/components/layout/protected-layout"
import { TopBar } from "@/components/layout/top-bar"
import { AppShell } from "@/components/layout/app-shell"
import { LoadingFallback } from "@/components/ui/loading-fallback"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { GuestAdoptionConfirmDialog } from "@/components/auth/guest-adoption-confirm-dialog"
import { Suspense } from "react"

// Variable font: every weight the app uses (400/500/600) renders from one file.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-outfit",
})

export const metadata: Metadata = {
  title: "Githelp",
  description: "Support set in system for open source projects",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`font-sans ${inter.variable} ${GeistMono.variable} ${outfit.variable} h-full`}>
        <TooltipProvider delayDuration={300}>
        <Suspense fallback={<LoadingFallback />}>
          <ReactQueryProvider>
            <UserProvider>
              <ProjectProvider>
                <ProtectedLayout>
                  <UnsavedChangesProvider>
                    <div className="flex flex-col h-screen">
                      <TopBar />
                      {/* Sidebar + page frame, rendered once; pages only render Header + content. */}
                      <AppShell>{children}</AppShell>
                    </div>
                  </UnsavedChangesProvider>
                </ProtectedLayout>
              </ProjectProvider>
            </UserProvider>
          </ReactQueryProvider>
        </Suspense>
        </TooltipProvider>
        {/* Single global Toaster: sonner renders every toast in each mounted
            Toaster without an id, so a second one shows everything twice.
            Mounted at body level so public routes (invite, onboarding) and
            protected pages alike get their toasts. */}
        <Toaster position="top-right" richColors closeButton />
        {/* "Link your guest conversation?" after sign-in (lib/guest-adoption). */}
        <GuestAdoptionConfirmDialog />
      </body>
    </html>
  )
}
