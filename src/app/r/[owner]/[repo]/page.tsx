import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { RepoDemand } from "@/components/unlisted/repo-demand"

type Params = Promise<{ owner: string; repo: string }>

/** GitHub owner/repo characters only; malformed escapes become "". */
function clean(value: string): string {
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return ""
  }
  const cleaned = decoded.replace(/[^A-Za-z0-9_.-]/g, "")
  return /^\.+$/.test(cleaned) ? "" : cleaned
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { owner, repo } = await params
  const fullName = `${clean(owner)}/${clean(repo)}`
  return {
    title: `Get help with ${fullName} — GitHelp`,
    description: `Paid, on-demand support for ${fullName}: get help now from vetted experts, or invite the maintainers to GitHelp.`,
  }
}

export default async function RepoDemandPage({ params }: { params: Params }) {
  const { owner, repo } = await params
  const o = clean(owner)
  const r = clean(repo)
  if (!o || !r) notFound()
  return (
    <Suspense>
      <RepoDemand owner={o} repo={r} />
    </Suspense>
  )
}
