"use client"

import { useId, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMarkLandingPageViewed, useOnboardingChecklist } from "@/hooks/useOnboardingChecklist"
import type { OnboardingChecklist as Checklist, OnboardingStep } from "@/lib/onboarding-checklist"
import { cn } from "@/lib/utils"

const iconButtonClass =
  "relative z-10 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors duration-fast ease-out hover:bg-surface-hover active:bg-surface-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"

/** Open step: the dashed ring from githelp-step-todo. */
function StepTodoIcon() {
  return (
    <svg role="img" aria-label="Not done" viewBox="0 0 20 20" fill="none" className="size-5 shrink-0 text-step-todo">
      <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.6 2.4" />
    </svg>
  )
}

/** Done step: the Githelp face cut out of a brand disc (githelp-step-done). */
function StepDoneIcon() {
  const maskId = useId()
  return (
    <svg role="img" aria-label="Done" viewBox="0 0 512 512" className="size-5 shrink-0 text-brand-primary">
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
        <rect width="512" height="512" fill="#fff" />
        <circle cx="318" cy="176" r="106" fill="#000" />
        <circle cx="132" cy="273" r="62" fill="#000" />
        <path d="M190 392Q260 433 330 350" fill="none" stroke="#000" strokeWidth="38" strokeLinecap="round" />
      </mask>
      <circle cx="256" cy="256" r="256" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  )
}

/**
 * Info button: the details show on hover and focus, stay open on click, and
 * toggle on tap. Radix closes a tooltip when its trigger is pressed, so the
 * click decides the final state itself (preventDefault skips Radix's close).
 */
function StepDetails({ step }: { step: OnboardingStep }) {
  const [open, setOpen] = useState(false)
  // Whether a touch press started on an open tooltip: that tap closes it.
  const closeOnClick = useRef(false)
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About "${step.label}"`}
          className={cn(iconButtonClass, "cursor-help")}
          onPointerDown={(event) => {
            closeOnClick.current = event.pointerType !== "mouse" && open
          }}
          onClick={(event) => {
            event.preventDefault()
            setOpen(!closeOnClick.current)
            closeOnClick.current = false
          }}
        >
          <Icon name="fi-rr-info" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        {step.details}
      </TooltipContent>
    </Tooltip>
  )
}

function StepRow({
  step,
  isNext,
  onOpen,
  onDismiss,
}: {
  step: OnboardingStep
  /** The first step that is not done: marked with a brand edge (visual only). */
  isNext: boolean
  onOpen: (step: OnboardingStep) => void
  onDismiss: (step: OnboardingStep) => void
}) {
  const isLink = !step.done && !!step.href
  return (
    <li
      className={cn(
        // 10px has no radius token (md 6, lg 8, xl 12).
        "relative flex min-h-13 items-center gap-3 rounded-[10px] border border-border-subtle bg-card px-4",
        isNext && "shadow-[inset_3px_0_0_var(--color-brand-primary)]",
        isLink &&
          "transition-colors duration-fast ease-out hover:bg-surface-hover has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand-primary/40",
      )}
    >
      {step.done ? <StepDoneIcon /> : <StepTodoIcon />}

      {isLink ? (
        // The link is stretched over the row (after:inset-0); the buttons sit above it.
        <Link
          href={step.href as string}
          onClick={() => onOpen(step)}
          className="min-w-0 truncate text-ui font-medium text-foreground outline-none after:absolute after:inset-0"
        >
          {step.label}
        </Link>
      ) : (
        <span
          className={cn("min-w-0 truncate text-ui font-medium", step.done ? "text-muted-foreground" : "text-foreground")}
        >
          {step.label}
        </span>
      )}
      {step.optional && !step.done && (
        <Badge variant="outline" className="border-border-subtle bg-card px-1.75 font-medium text-muted-foreground">
          Optional
        </Badge>
      )}
      <StepDetails step={step} />

      {isLink && (
        <button
          type="button"
          aria-label={`Skip "${step.label}"`}
          className="relative z-10 ml-auto shrink-0 cursor-pointer rounded-md px-2 py-1 text-ui text-muted-foreground transition-colors duration-fast ease-out hover:bg-surface-hover active:bg-surface-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
          onClick={() => onDismiss(step)}
        >
          Skip
        </button>
      )}
    </li>
  )
}

interface OnboardingChecklistCardProps {
  checklist: Checklist
  onStepOpen: (step: OnboardingStep) => void
  onStepDismiss: (step: OnboardingStep) => void
  className?: string
}

/**
 * The checklist itself, without data fetching: a white card with the title,
 * a done-count pill and one bordered row per step (the rows are a design
 * exception to "no cards inside cards").
 */
export function OnboardingChecklistCard({
  checklist,
  onStepOpen,
  onStepDismiss,
  className,
}: OnboardingChecklistCardProps) {
  const titleId = useId()
  const { steps, doneCount, totalCount } = checklist
  const nextStepId = steps.find((s) => !s.done)?.id
  return (
    <section
      aria-labelledby={titleId}
      className={cn("animate-enter rounded-2xl border border-border-subtle bg-card px-8 pt-7 pb-8", className)}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h2 id={titleId} className="text-base font-subtitle text-foreground">
          Finish setting up your project
        </h2>
        <span
          role="img"
          aria-label={`${doneCount} of ${totalCount} done`}
          className="rounded-md bg-badge-neutral-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground"
        >
          {doneCount} / {totalCount}
        </span>
      </div>
      <ol className="mt-5 flex flex-col gap-2">
        {steps.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            isNext={step.id === nextStepId}
            onOpen={onStepOpen}
            onDismiss={onStepDismiss}
          />
        ))}
      </ol>
    </section>
  )
}

/**
 * Onboarding checklist for the admin Overview page. Renders nothing while
 * loading, for a sandbox project, and once every step is done or dismissed.
 */
export function OnboardingChecklist({ projectId, className }: { projectId: string; className?: string }) {
  const { checklist, setStepDismissed } = useOnboardingChecklist(projectId)
  const markLandingPageViewed = useMarkLandingPageViewed(projectId)

  if (!checklist?.visible) return null

  const handleDismiss = async (step: OnboardingStep) => {
    try {
      await setStepDismissed(step.id, true)
      toast(`"${step.label}" dismissed`, {
        action: {
          label: "Undo",
          onClick: () => {
            setStepDismissed(step.id, false).catch(() => toast.error("Couldn't bring the step back. Please try again."))
          },
        },
      })
    } catch {
      toast.error("Couldn't dismiss the step. Please try again.")
    }
  }

  const handleOpen = (step: OnboardingStep) => {
    if (step.id === "view_landing_page") markLandingPageViewed()
  }

  return (
    <OnboardingChecklistCard
      checklist={checklist}
      onStepOpen={handleOpen}
      onStepDismiss={handleDismiss}
      className={className}
    />
  )
}
