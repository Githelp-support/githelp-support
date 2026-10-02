"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { SignInModal } from "@/components/modals/sign-in-modal"
import { useUser } from "@/contexts/user-context"
import {
  GithelpFunctionError,
  type RepoSupportOverview,
  useApplyAsHelper,
  useClaimRepo,
  useRepoOverview,
  useRequestSupport,
} from "@/hooks/useUnlisted"
import { demandPagePath, dollarsToCents, formatUsd } from "@/components/unlisted/repo"
import {
  clearGithubVerification,
  currentGithubToken,
  justVerifiedWithGithub,
  startGithubVerification,
} from "@/components/unlisted/github-verification"
import { useEnterProject } from "@/hooks/useEnterProject"

type Panel = "help" | "claim" | "helper" | null

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-lg p-6 mb-6 ${className}`}>{children}</div>
}

/** "$10 to start, then $1.50/min (first hour) and $1.00/min after" from the unclaimed-project defaults. */
export function describePricing(pricing: RepoSupportOverview["pricing"]): string | null {
  if (!pricing) return null
  const { start_price, per_minute_first_60, per_minute_after_60 } = pricing
  if (start_price <= 0 && per_minute_first_60 <= 0 && per_minute_after_60 <= 0) return "Free"
  return `${formatUsd(start_price)} to start, then ${formatUsd(per_minute_first_60)}/min for the first hour and ${formatUsd(per_minute_after_60)}/min after. You only pay for time you accept.`
}

/**
 * Public page for a repository that isn't (fully) on GitHelp yet: shows the
 * demand, lets people get help now from vetted independent helpers, lets the
 * maintainers claim the project and lets experts apply as helpers.
 */
export function RepoDemand({ owner, repo }: { owner: string; repo: string }) {
  const fullName = `${owner}/${repo}`.toLowerCase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const signedIn = !!user?.id
  const { data: overview, isLoading, error } = useRepoOverview(fullName)
  // Back from GitHub verification (?claim=1) or from signing in (?panel=…):
  // reopen the panel the user was on.
  const [panel, setPanel] = useState<Panel>(() => {
    if (searchParams?.get("claim") === "1") return "claim"
    const p = searchParams?.get("panel")
    return p === "help" || p === "claim" || p === "helper" ? p : null
  })
  const [signInOpen, setSignInOpen] = useState(false)

  // A listed project has its own support page.
  useEffect(() => {
    if (overview?.status === "listed" && overview.project?.slug) {
      router.replace(`/support?slug=${encodeURIComponent(overview.project.slug)}`)
    }
  }, [overview, router])

  const needSignIn = (next: Panel) => {
    if (!signedIn) {
      // The sign-in modal returns to the current URL: remember the panel in it.
      if (next) router.replace(`${demandPagePath(fullName)}?panel=${next}`, { scroll: false })
      setSignInOpen(true)
      return
    }
    setPanel(next)
  }

  if (isLoading || overview?.status === "listed") {
    return <Shell><p className="text-sm text-muted-foreground">Loading…</p></Shell>
  }
  if (error || !overview) {
    return (
      <Shell>
        <Card>
          <p className="text-sm text-muted-foreground">We couldn&apos;t load this repository right now. Please try again later.</p>
        </Card>
      </Shell>
    )
  }

  const pricing = describePricing(overview.pricing ?? null)
  const requests = overview.requests ?? 0
  const pledged = overview.pledged_smallest_unit ?? 0
  const independentHelpers = overview.independent_helpers ?? 0

  return (
    <Shell>
      <Card>
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Support for</p>
        <h1 className="text-2xl font-bold text-foreground break-words">
          <a href={`https://github.com/${fullName}`} target="_blank" rel="noreferrer" className="hover:underline">
            {fullName}
          </a>
        </h1>
        <p className="mt-3 text-base text-foreground" data-testid="demand-summary">
          {requests > 0
            ? `${requests} developer${requests === 1 ? "" : "s"} want${requests === 1 ? "s" : ""} support for this project`
            : "Be the first to ask for support for this project"}
          {pledged > 0 ? ` — ${formatUsd(pledged)} pledged` : ""}.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          GitHelp connects developers with the people who know a project best, for paid, on-demand help. The
          maintainers of {fullName} aren&apos;t on GitHelp yet
          {independentHelpers > 0
            ? `, but ${independentHelpers} independent expert${independentHelpers === 1 ? " vetted" : "s vetted"} by GitHelp can help you now.`
            : ". Independent experts vetted by GitHelp can help in the meantime."}
        </p>
        <OutreachStatus overview={overview} />
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="lavender" className="cursor-pointer" onClick={() => needSignIn("help")}>Get help now</Button>
          <Button variant="outline" className="cursor-pointer" onClick={() => needSignIn("claim")}>I maintain this repo — claim it</Button>
          <Button variant="ghost" className="cursor-pointer" onClick={() => needSignIn("helper")}>I know this project — become a helper</Button>
        </div>
      </Card>

      {panel === "help" && <HelpRequestForm repo={fullName} pricing={pricing} />}
      {panel === "claim" && <ClaimPanel repo={fullName} />}
      {panel === "helper" && <HelperApplyForm repo={fullName} />}

      <Card>
        <h2 className="text-base font-semibold text-foreground mb-2">How it works</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Describe your problem. Vetted independent helpers can pick it up right away (if you allow it), and the maintainers are invited to join.</li>
          <li>Helpers are clearly marked as independent — they are not the project&apos;s maintainers.</li>
          {pricing && <li>Pricing: {pricing}</li>}
          <li>Nothing is charged until someone picks up your ticket and you accept their work.</li>
          <li>When the maintainers join, your ticket moves to them and you&apos;re notified.</li>
        </ul>
      </Card>

      <SignInModal
        isOpen={signInOpen}
        onClose={() => setSignInOpen(false)}
        description="Sign in to ask for support, claim the project or apply as a helper."
      />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f9ff]">
      <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" aria-label="GitHelp home">
            <Logo className="w-[40px] h-[40px]" />
          </Link>
          <span className="text-sm text-muted-foreground">GitHelp — on-demand help from the people who know the code</span>
        </div>
        {children}
      </div>
    </div>
  )
}

function OutreachStatus({ overview }: { overview: RepoSupportOverview }) {
  const status = overview.outreach?.status ?? "none"
  const posted_url = overview.outreach?.posted_url ?? null
  if (status === "posted") {
    return (
      <p className="mt-3 text-sm text-foreground" data-testid="outreach-status">
        We&apos;ve invited the maintainers on GitHub
        {posted_url ? (
          <>
            {" "}— <a href={posted_url} target="_blank" rel="noreferrer" className="underline">see the invitation</a>
          </>
        ) : null}
        .
      </p>
    )
  }
  if (status === "pending_review") {
    return <p className="mt-3 text-sm text-muted-foreground" data-testid="outreach-status">We&apos;re preparing an invitation to the maintainers.</p>
  }
  if (status === "opted_out") {
    return (
      <p className="mt-3 text-sm text-muted-foreground" data-testid="outreach-status">
        The maintainers asked not to be contacted about GitHelp. Independent helpers can still assist you.
      </p>
    )
  }
  return null
}

function HelpRequestForm({ repo, pricing }: { repo: string; pricing: string | null }) {
  const router = useRouter()
  const request = useRequestSupport()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [allowIndependent, setAllowIndependent] = useState(true)
  const [budget, setBudget] = useState("")
  const [done, setDone] = useState(false)
  // One id per filled-in form: a retry after a network error doesn't open a
  // second ticket (the backend returns the first one).
  const requestId = useRef<string>(newRequestId())

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const pledge = dollarsToCents(budget)
    if (Number.isNaN(pledge)) {
      toast.error("Enter a budget like 50 or 49.99, or leave it empty.")
      return
    }
    if (title.trim() !== "" && description.trim() === "") {
      toast.error("Add the details of the problem (the exact error, versions, what you tried) so a helper can start.")
      return
    }
    const hasProblem = title.trim() !== "" && description.trim() !== ""
    try {
      const result = await request.mutateAsync({
        repo,
        pledge_smallest_unit: pledge,
        client_request_id: requestId.current,
        ...(hasProblem
          ? { ticket: { title: title.trim().slice(0, 100), description: description.trim(), allow_independent: allowIndependent } }
          : { message: description.trim() || undefined }),
      })
      if (result.already_listed) {
        toast.info(`${result.project.name} is on GitHelp — open a ticket with its maintainers.`)
        router.push(`/support?slug=${encodeURIComponent(result.project.slug)}`)
        return
      }
      requestId.current = newRequestId()
      if (result.ticket_id) {
        router.push(`/support/chat?ticket=${encodeURIComponent(result.ticket_id)}`)
        return
      }
      setDone(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your request")
    }
  }

  if (done) {
    return (
      <Card>
        <p className="text-sm text-foreground font-medium">Thanks — your request is recorded.</p>
        <p className="text-sm text-muted-foreground mt-1">We&apos;ll tell you as soon as the maintainers join GitHelp.</p>
      </Card>
    )
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4" aria-label="Get help">
        <h2 className="text-base font-semibold text-foreground">Get help with {repo}</h2>
        <div className="space-y-1">
          <Label htmlFor="help-title">What&apos;s the problem?</Label>
          <Input id="help-title" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Build fails after upgrading to 3.2" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="help-description">Details</Label>
          <Textarea
            id="help-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="The exact error, what you expected, versions, and what you already tried."
          />
          <p className="text-xs text-muted-foreground">
            Fill in both to open a ticket now. Leave the problem title empty to only register your interest (the details become a note for the maintainers).
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Switch id="allow-independent" checked={allowIndependent} onCheckedChange={setAllowIndependent} />
          <Label htmlFor="allow-independent" className="font-normal leading-snug">
            Let vetted independent experts help while the maintainers aren&apos;t here (recommended)
          </Label>
        </div>
        <div className="space-y-1">
          <Label htmlFor="help-budget">Max budget in USD (optional)</Label>
          <Input id="help-budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 50" className="max-w-[160px]" />
          <p className="text-xs text-muted-foreground">Shown to the maintainers as demand for paid support.</p>
        </div>
        {pricing && <p className="text-xs text-muted-foreground">Pricing: {pricing}</p>}
        <Button type="submit" variant="lavender" className="cursor-pointer" disabled={request.isPending}>
          {request.isPending ? "Sending…" : title.trim() && description.trim() ? "Open ticket" : "Register interest"}
        </Button>
      </form>
    </Card>
  )
}

function newRequestId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

const CLAIM_ERRORS: Record<string, string> = {
  not_a_maintainer: "Your GitHub account doesn't have admin or maintain access to this repository.",
  already_claimed: "This project has already been claimed by its maintainers.",
  github_account_mismatch:
    "That GitHub account isn't the one linked to your GitHelp account. Sign in to GitHub with your linked account and try again.",
  not_found: "There's nothing to claim for this repository yet.",
  github_unavailable: "We couldn't reach GitHub just now. Please try again in a moment.",
}

function ClaimPanel({ repo }: { repo: string }) {
  const router = useRouter()
  const claim = useClaimRepo()
  const enterProject = useEnterProject()
  const [error, setError] = useState<string | null>(null)

  const verify = async (differentAccount = false) => {
    try {
      await startGithubVerification(`${demandPagePath(repo)}?claim=1`, { differentAccount })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start GitHub sign-in")
    }
  }

  const run = async () => {
    setError(null)
    // Only a token from a verification round-trip this page started is used,
    // and only once (then the user verifies again, possibly as someone else).
    const token = await currentGithubToken()
    clearGithubVerification()
    if (!token) {
      await verify()
      return
    }
    try {
      const result = await claim.mutateAsync({ repo, github_token: token })
      toast.success("The project is yours. Welcome to GitHelp!")
      // Select the project and switch to its admin role, then open its settings.
      await enterProject(result.project_id, "admin")
      router.push("/settings/project")
    } catch (err) {
      const code = err instanceof GithelpFunctionError ? err.code : null
      setError((code && CLAIM_ERRORS[code]) || (err instanceof Error ? err.message : "Could not claim this project"))
    }
  }

  // Returning from GitHub verification: continue automatically. run() clears
  // the verification marker, so this happens once (a cancelled timer in a
  // strict-mode double mount leaves the marker for the second mount).
  useEffect(() => {
    if (!justVerifiedWithGithub()) return
    const timer = setTimeout(() => void run(), 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Card>
      <h2 className="text-base font-semibold text-foreground">Claim {repo}</h2>
      <p className="text-sm text-muted-foreground mt-1">
        We verify with GitHub that you have admin or maintain access to the repository. Claiming gives you the
        project with its open tickets, requests and helpers; you can then set your own prices, invite your team or
        attach an AI agent.
      </p>
      {error && <p className="text-sm text-red-700 mt-3" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button className="cursor-pointer" variant="lavender" onClick={() => void run()} disabled={claim.isPending}>
          {claim.isPending ? "Verifying…" : "Verify with GitHub and claim"}
        </Button>
        {error && (
          <Button className="cursor-pointer" variant="ghost" onClick={() => void verify(true)} disabled={claim.isPending}>
            Use a different GitHub account
          </Button>
        )}
      </div>
      {error && (
        <p className="text-xs text-muted-foreground mt-2">
          To switch accounts you may need to sign out of github.com first.
        </p>
      )}
    </Card>
  )
}

function HelperApplyForm({ repo }: { repo: string }) {
  const apply = useApplyAsHelper()
  const [motivation, setMotivation] = useState("")
  const [githubLogin, setGithubLogin] = useState("")
  const [hasLinkedGithub, setHasLinkedGithub] = useState<boolean | null>(null)
  const [sent, setSent] = useState(false)

  // A linked GitHub account is verified evidence; otherwise ask for the login.
  useEffect(() => {
    void (async () => {
      const { supabase } = await import("@/lib/supabase/client")
      const { data } = await supabase.auth.getSession()
      setHasLinkedGithub((data.session?.user.identities ?? []).some((i) => i.provider === "github"))
    })()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (motivation.trim().length < 20) {
      toast.error("Tell us a bit more about your experience with this project.")
      return
    }
    try {
      await apply.mutateAsync({
        repo,
        motivation: motivation.trim(),
        ...(githubLogin.trim() ? { github_login: githubLogin.trim().replace(/^@/, "") } : {}),
      })
      setSent(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your application")
    }
  }

  if (sent) {
    return (
      <Card>
        <p className="text-sm text-foreground font-medium">Application sent.</p>
        <p className="text-sm text-muted-foreground mt-1">
          GitHelp staff review every application. Follow its status under{" "}
          <Link href="/user/applications" className="underline">your helper applications</Link>.
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4" aria-label="Apply as helper">
        <h2 className="text-base font-semibold text-foreground">Become an independent helper for {repo}</h2>
        <p className="text-sm text-muted-foreground">
          Independent helpers answer tickets for this project until its maintainers join, at GitHelp&apos;s standard
          rates. You&apos;re shown as an independent helper, not a maintainer. GitHelp staff review your GitHub
          contributions to the project before approving.
        </p>
        <div className="space-y-1">
          <Label htmlFor="helper-motivation">Your experience with this project</Label>
          <Textarea
            id="helper-motivation"
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            rows={4}
            placeholder="e.g. merged PRs, issues you've answered, how you use it at work."
          />
        </div>
        {hasLinkedGithub === false && (
          <div className="space-y-1">
            <Label htmlFor="helper-github">Your GitHub username (optional)</Label>
            <Input id="helper-github" value={githubLogin} onChange={(e) => setGithubLogin(e.target.value)} placeholder="octocat" className="max-w-[240px]" />
            <p className="text-xs text-muted-foreground">
              Lets staff see your contributions. Linking GitHub to your account (profile settings) counts as verified.
            </p>
          </div>
        )}
        <Button type="submit" variant="lavender" className="cursor-pointer" disabled={apply.isPending}>
          {apply.isPending ? "Sending…" : "Apply"}
        </Button>
      </form>
    </Card>
  )
}
