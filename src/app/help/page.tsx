"use client"

import Link from "next/link"
import { MessageCircle, BookOpen, Mail, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useUser } from "@/contexts/user-context"
import { GITHELP_SUPPORT_URL } from "@/lib/constants"

const SHARED_FAQ_ITEMS = [
  {
    question: "I can't see my project or tickets",
    answer:
      "Make sure you're signed in and have selected the correct project from the dropdown in the sidebar. If you've just been invited to a project, try refreshing the page. If you still don't see it, ask a project admin to confirm your access.",
  },
  {
    question: "I can't change my role (Admin / Helper / User)",
    answer:
      "The role dropdown in the header only shows roles you're allowed to use. You must be an admin in the project to switch to Admin; you must be in the project's helpers list to switch to Helper. Select a project first if the dropdown is empty.",
  },
  {
    question: "Something else isn't working",
    answer:
      "Try signing out and back in, or refreshing the page. If the issue continues, use the support or ticket option for your project so an admin or helper can assist you.",
  },
]

const ADMIN_FAQ_ITEMS = [
  SHARED_FAQ_ITEMS[0],
  {
    question: "My report looks wrong",
    answer:
      "Check the time period filter (current month, choose month, or all time) on the Reports page. Reports only include completed tickets with logged time, so recent work may not appear yet. If numbers still look incorrect, verify the helper's logged time on the ticket itself.",
  },
  {
    question: "How do I manage the helpers in my project?",
    answer:
      "Open Helpers in the sidebar to see everyone in your project's helpers list. From there you can review each helper's category and activity, and remove helpers who should no longer have access. Helpers must be in this list before they can claim tickets.",
  },
  {
    question: "How do I set up SLAs for my project?",
    answer:
      "Go to SLAs in the sidebar to define service-level agreements — response and resolution targets for tickets. Once configured, SLAs are applied to incoming tickets so you and your helpers can see which ones are at risk of breaching.",
  },
  {
    question: "How do I customize my project's support landing page?",
    answer:
      "Open your project's settings to update the landing-page branding — logo, name, and description shown on the public support page. Changes appear immediately on your project's support URL, so users always see up-to-date branding.",
  },
  {
    question: "How do I configure payment settings and payouts?",
    answer:
      "Payment settings live in your project's settings. There you can review the payment distribution between helpers and configure how payouts are calculated. Use the distribution preview to check how a payment will be split before confirming.",
  },
  {
    question: "How do I invite people to my project?",
    answer:
      "From your project's settings, create an invite and share the generated link. When someone opens the invite link and signs in, they're added to the project with the role you chose. If an invite expires, simply generate a new one.",
  },
  SHARED_FAQ_ITEMS[1],
  SHARED_FAQ_ITEMS[2],
]

const HELPER_FAQ_ITEMS = [
  SHARED_FAQ_ITEMS[0],
  {
    question: "I'm a helper — how do I claim and work on tickets?",
    answer:
      "Go to Tickets in the sidebar to see available tickets. Open a ticket and use the 'Claim' action to assign it to yourself. You can then chat with the user and log time. When done, mark the ticket as completed.",
  },
  {
    question: "How do I log time on a ticket?",
    answer:
      "Open a ticket you've claimed and log the time you've spent directly on it. Logged time is what your payouts and the project's reports are based on, so keep it up to date — you can adjust it before the ticket is marked as completed.",
  },
  {
    question: "My payout looks wrong",
    answer:
      "Check the time period filter (current month, choose month, or all time) on the Payouts page. Payouts are calculated from time logged on completed tickets, so unfinished tickets won't be counted yet. If something still looks incorrect, contact the project admin.",
  },
  {
    question: "How do I set up how I get paid?",
    answer:
      "Open Profile in the sidebar and complete your payout details so the project can pay you for completed tickets. Until your payout setup is complete, earnings accumulate but can't be paid out.",
  },
  {
    question: "How do I manage my availability?",
    answer:
      "Your availability settings control when you're shown as available to take tickets. Update them from your helper profile settings — if you're marked unavailable, new tickets won't be routed to you, but you can still work on tickets you've already claimed.",
  },
  {
    question: "Where do I manage my helper profile?",
    answer:
      "If you're a helper, open Profile in the sidebar (under the helper menu). There you can edit your display name, email, username, and helper category for the selected project.",
  },
  SHARED_FAQ_ITEMS[1],
  SHARED_FAQ_ITEMS[2],
]

const USER_FAQ_ITEMS = [
  SHARED_FAQ_ITEMS[0],
  {
    question: "How do I get support for the project?",
    answer:
      "If you're a user needing help with the project, go to Support in the sidebar and start a chat or create a ticket. You can also open a ticket from the project's support page if you have the link.",
  },
  {
    question: "How do I open a support ticket?",
    answer:
      "Go to Support > Tickets in the sidebar (or visit your project's support page) and create a new ticket describing your issue. A helper will claim it and follow up with you — you can track the status and reply from the same page.",
  },
  {
    question: "How do I chat with support?",
    answer:
      "Open Support > Chat in the sidebar to start a live conversation with the project's support team. Chat is best for quick questions; for issues that need follow-up, create a ticket instead so nothing gets lost.",
  },
  {
    question: "How do I manage my notifications?",
    answer:
      "Open Notifications under Settings in the sidebar to choose how you're notified about replies and updates on your tickets. If you're missing updates, check that notifications are enabled there first.",
  },
  SHARED_FAQ_ITEMS[1],
  SHARED_FAQ_ITEMS[2],
]

const FAQ_ITEMS_BY_ROLE: Record<"admin" | "helper" | "user", typeof SHARED_FAQ_ITEMS> = {
  admin: ADMIN_FAQ_ITEMS,
  helper: HELPER_FAQ_ITEMS,
  user: USER_FAQ_ITEMS,
}

export default function HelpPage() {
  const { user } = useUser()
  const isAuthenticated = !!user?.id

  // Match the sidebar's getNavigationItems fallback: unknown/missing role → admin
  const role =
    user?.role === "helper" || user?.role === "user" ? user.role : "admin"
  const faqItems = FAQ_ITEMS_BY_ROLE[role]

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Help" subtitle="Get help with common issues" />

        <main className="flex-1 overflow-auto px-8 py-6">
          <div className="max-w-3xl space-y-8">
            {/* Intro */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">Having an issue?</h2>
              <p className="text-sm text-muted-foreground">
                Use the topics below to find answers. If you still need help, reach out through support or create a ticket for your project.
              </p>
            </div>

            {/* FAQ */}
            <Card className="border-[#E1E1E1] shadow-none rounded-lg">
              <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                  {faqItems.map((item, index) => (
                    <AccordionItem key={index} value={`item-${index}`} className="px-6">
                      <AccordionTrigger className="text-foreground hover:no-underline hover:text-brand-primary">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* Get support CTA */}
            <Card className="border-[#E1E1E1] shadow-none rounded-lg bg-muted/30">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">Still need help?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Get in touch with your project&apos;s support team or open a ticket.
                </p>
                <div className="flex flex-wrap gap-3">
                  {isAuthenticated && (
                    <>
                      <Button asChild className="bg-brand-primary hover:bg-brand-primary/90 text-white">
                        <Link href={GITHELP_SUPPORT_URL} className="inline-flex items-center gap-2">
                          <MessageCircle className="w-4 h-4" />
                          Open support chat
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/support/tickets" className="inline-flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          My tickets
                        </Link>
                      </Button>
                    </>
                  )}
                  {!isAuthenticated && (
                    <Button asChild className="bg-brand-primary hover:bg-brand-primary/90 text-white">
                      <Link href="/auth/signin" className="inline-flex items-center gap-2">
                        Sign in to get support
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Documentation link placeholder */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <BookOpen className="w-5 h-5 shrink-0" />
              <span>
                For detailed guides and API docs, see Documentation in the sidebar when available.
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
