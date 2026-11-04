import type React from "react"
import type { Metadata } from "next"
import { Inter, Outfit } from "next/font/google"
import localFont from "next/font/local"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { UserProvider } from "@/contexts/user-context"
import { ProjectProvider } from "@/contexts/project-context"
import { UnsavedChangesProvider } from "@/contexts/unsaved-changes-context"
import { ReactQueryProvider } from "@/lib/react-query/provider"
import { ProtectedLayout } from "@/components/layout/protected-layout"
import { TopBar } from "@/components/layout/top-bar"
import { AppShell } from "@/components/layout/app-shell"
import { MobileNavProvider } from "@/components/layout/mobile-nav"
import { LoadingFallback } from "@/components/ui/loading-fallback"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { GuestAdoptionConfirmDialog } from "@/components/auth/guest-adoption-confirm-dialog"
import { Suspense } from "react"

// Two body faces, picked by size (see the "Font by size" rules in globals.css):
// Inter for text at 15px and below, Nudica for 16px and above.

// Inter is variable: every weight the app uses (400/450/500/600) renders from one file.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

// Nudica is a static family (files in src/fonts/nudica, license alongside).
// It ships Regular, Medium and Bold only, so the weight ranges below map the
// app's 450 to Regular, 550 (font-subtitle) to Medium and 600 to Bold.
const nudica = localFont({
  src: [
    { path: "../fonts/nudica/nudica-regular-webfont.woff2", weight: "400 450", style: "normal" },
    { path: "../fonts/nudica/nudica-regularitalic-webfont.woff2", weight: "400 450", style: "italic" },
    { path: "../fonts/nudica/nudica-medium-webfont.woff2", weight: "500 599", style: "normal" },
    { path: "../fonts/nudica/nudica-mediumitalic-webfont.woff2", weight: "500 599", style: "italic" },
    { path: "../fonts/nudica/nudica-bold-webfont.woff2", weight: "600 700", style: "normal" },
    { path: "../fonts/nudica/nudica-bolditalic-webfont.woff2", weight: "600 700", style: "italic" },
  ],
  variable: "--font-nudica",
  display: "swap",
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
      <body className={`font-display ${inter.variable} ${nudica.variable} ${GeistMono.variable} ${outfit.variable} h-full`}>
        <TooltipProvider delayDuration={300}>
        <Suspense fallback={<LoadingFallback />}>
          <ReactQueryProvider>
            <UserProvider>
              <ProjectProvider>
                <ProtectedLayout>
                  <UnsavedChangesProvider>
                    <MobileNavProvider>
                      {/* h-dvh (not h-screen) so the chat composer stays above the on-screen keyboard. */}
                      <div className="flex flex-col h-dvh">
                        <TopBar />
                        {/* Sidebar + page frame, rendered once; pages only render Header + content. */}
                        <AppShell>{children}</AppShell>
                      </div>
                    </MobileNavProvider>
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
