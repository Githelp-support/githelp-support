"use client"

import { useId, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMarkLandingPageViewed, useOnboardingChecklist } from "@/hooks/useOnboardingChecklist"
import type { OnboardingChecklist as Checklist, OnboardingStep } from "@/lib/onboarding-checklist"
import { cn } from "@/lib/utils"

const iconButtonClass =
  "relative z-10 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast ease-out hover:bg-surface-hover hover:text-foreground active:bg-surface-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"

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
  onOpen,
  onDismiss,
}: {
  step: OnboardingStep
  onOpen: (step: OnboardingStep) => void
  onDismiss: (step: OnboardingStep) => void
}) {
  const isLink = !step.done && !!step.href
  return (
    <li
      className={cn(
        "relative flex min-h-12 items-center gap-3 px-6 py-2",
        isLink &&
          "transition-colors duration-fast ease-out hover:bg-surface-hover has-[a:focus-visible]:bg-surface-hover has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-inset has-[a:focus-visible]:ring-brand-primary/40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full",
          step.done ? "bg-brand-primary text-brand-foreground" : "border border-border-control bg-background",
        )}
      >
        {step.done && <Icon name="fi-rr-check" size={3} />}
      </span>

      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {isLink ? (
          // The link is stretched over the row (after:inset-0); the buttons sit above it.
          <Link
            href={step.href as string}
            onClick={() => onOpen(step)}
            className="text-sm font-medium text-foreground outline-none after:absolute after:inset-0"
          >
            {step.label}
          </Link>
        ) : (
          <span className={cn("text-sm", step.done ? "text-muted-foreground line-through" : "font-medium text-foreground")}>
            {step.label}
            {step.done && <span className="sr-only"> (done)</span>}
          </span>
        )}
        {step.optional && !step.done && (
          <Badge variant="outline" className="border-border-subtle font-normal text-muted-foreground">
            Optional
          </Badge>
        )}
        <StepDetails step={step} />
      </div>

      {isLink && (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Dismiss "${step.label}"`}
                className={iconButtonClass}
                onClick={() => onDismiss(step)}
              >
                <Icon name="fi-rr-cross-small" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Dismiss</TooltipContent>
          </Tooltip>
          <Icon name="fi-rr-angle-small-right" className="text-muted-foreground" />
        </div>
      )}
    </li>
  )
}

interface OnboardingChecklistCardProps {
  checklist: Checklist
  onStepOpen: (step: OnboardingStep) => void
  onStepDismiss: (step: OnboardingStep) => void
}

/** The checklist itself, without data fetching. */
export function OnboardingChecklistCard({ checklist, onStepOpen, onStepDismiss }: OnboardingChecklistCardProps) {
  const titleId = useId()
  const { steps, doneCount, totalCount } = checklist
  return (
    <section aria-labelledby={titleId}>
      <Card className="animate-enter gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-border-subtle px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-subtitle text-foreground">
              Finish setting up your project
            </h2>
            <p className="mt-0.5 text-ui text-muted-foreground">
              A few steps and you&apos;re ready to take support requests.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-ui text-muted-foreground tabular-nums">
              {doneCount} of {totalCount} done
            </span>
            <div
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={0}
              aria-valuemax={totalCount}
              aria-valuenow={doneCount}
              className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-active"
            >
              <div
                className="h-full w-full origin-left rounded-full bg-brand-primary transition-transform duration-slow ease-out"
                style={{ transform: `scaleX(${totalCount > 0 ? doneCount / totalCount : 0})` }}
              />
            </div>
          </div>
        </div>
        <ol className="divide-y divide-border-subtle">
          {steps.map((step) => (
            <StepRow key={step.id} step={step} onOpen={onStepOpen} onDismiss={onStepDismiss} />
          ))}
        </ol>
      </Card>
    </section>
  )
}

/**
 * Onboarding checklist for the admin Overview page. Renders nothing while
 * loading, for a sandbox project, and once every required step is done.
 */
export function OnboardingChecklist({ projectId }: { projectId: string }) {
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

  return <OnboardingChecklistCard checklist={checklist} onStepOpen={handleOpen} onStepDismiss={handleDismiss} />
}
