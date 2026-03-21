"use client"

import type React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/brand/logo"
import { useParams, useSearchParams } from "next/navigation"

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams<{ slug?: string }>()
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get("project")
  const slugParam = params?.slug || searchParams.get("slug")
  const supportQuery = slugParam
    ? `?slug=${encodeURIComponent(slugParam)}`
    : projectIdParam
      ? `?project=${encodeURIComponent(projectIdParam)}`
      : ""

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-support-header text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo variant="dark" href={`/support${supportQuery}`} className="text-support-header" />
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-white hover:bg-white/10 cursor-pointer" asChild>
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button
              variant="outline"
              className="bg-transparent border-white text-white hover:bg-white hover:text-support-header cursor-pointer"
              asChild
            >
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-bg-subtle">{children}</main>
    </div>
  )
}
