import type React from "react"
import type { Metadata } from "next"
import { Open_Sans } from "next/font/google"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { UserProvider } from "@/contexts/user-context"
import { ProjectProvider } from "@/contexts/project-context"
import { ReactQueryProvider } from "@/lib/react-query/provider"
import { ProtectedLayout } from "@/components/layout/protected-layout"
import { LoadingFallback } from "@/components/ui/loading-fallback"
import { Suspense } from "react"

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-open-sans",
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
      <body className={`font-sans ${openSans.variable} ${GeistMono.variable} h-full`}>
        <Suspense fallback={<LoadingFallback />}>
          <ReactQueryProvider>
            <UserProvider>
              <ProjectProvider>
                <ProtectedLayout>{children}</ProtectedLayout>
              </ProjectProvider>
            </UserProvider>
          </ReactQueryProvider>
        </Suspense>
      </body>
    </html>
  )
}
