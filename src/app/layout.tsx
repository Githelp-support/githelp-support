import type React from "react"
import type { Metadata } from "next"
import { Open_Sans, Outfit } from "next/font/google"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { UserProvider } from "@/contexts/user-context"
import { ProjectProvider } from "@/contexts/project-context"
import { ReactQueryProvider } from "@/lib/react-query/provider"
import { ProtectedLayout } from "@/components/layout/protected-layout"
import { TopBar } from "@/components/layout/top-bar"
import { LoadingFallback } from "@/components/ui/loading-fallback"
import { Suspense } from "react"

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-open-sans",
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
      <body className={`font-sans ${openSans.variable} ${GeistMono.variable} ${outfit.variable} h-full`}>
        <Suspense fallback={<LoadingFallback />}>
          <ReactQueryProvider>
            <UserProvider>
              <ProjectProvider>
                <ProtectedLayout>
                  <div className="flex flex-col min-h-full">
                    <TopBar />
                    {children}
                  </div>
                </ProtectedLayout>
              </ProjectProvider>
            </UserProvider>
          </ReactQueryProvider>
        </Suspense>
      </body>
    </html>
  )
}
