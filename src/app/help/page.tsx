"use client"

import Link from "next/link"
import { HelpCircle, MessageCircle, BookOpen, Mail, ArrowRight } from "lucide-react"
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

const FAQ_ITEMS = [
  {
    question: "I can't see my project or tickets",
    answer:
      "Make sure you're signed in and have selected the correct project from the dropdown in the sidebar. If you've just been invited to a project, try refreshing the page. If you still don't see it, ask a project admin to confirm your access.",
  },
  {
    question: "How do I get support for the project?",
    answer:
      "If you're a user needing help with the project, go to Support in the sidebar and start a chat or create a ticket. You can also open a ticket from the project's support page if you have the link.",
  },
  {
    question: "I'm a helper — how do I claim and work on tickets?",
    answer:
      "Go to Tickets in the sidebar to see available tickets. Open a ticket and use the 'Claim' action to assign it to yourself. You can then chat with the user and log time. When done, mark the ticket as completed.",
  },
  {
    question: "My payout or report looks wrong",
    answer:
      "Check the time period filter (current month, choose month, or all time) on the Reports or Payouts page. If something still looks incorrect, contact the project admin or use the support channel for your project.",
  },
  {
    question: "I can't change my role (Admin / Helper / User)",
    answer:
      "The role dropdown in the header only shows roles you're allowed to use. You must be an admin in the project to switch to Admin; you must be in the project's helpers list to switch to Helper. Select a project first if the dropdown is empty.",
  },
  {
    question: "Where do I manage my helper profile?",
    answer:
      "If you're a helper, open Profile in the sidebar (under the helper menu). There you can edit your display name, email, username, and helper category for the selected project.",
  },
  {
    question: "Something else isn't working",
    answer:
      "Try signing out and back in, or refreshing the page. If the issue continues, use the support or ticket option for your project so an admin or helper can assist you.",
  },
]

export default function HelpPage() {
  const { user } = useUser()
  const isAuthenticated = !!user?.id

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Help" subtitle="Get help with common issues" />

        <main className="flex-1 overflow-auto px-[34px] py-6">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Intro */}
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-brand-primary/10 p-3 shrink-0">
                <HelpCircle className="w-8 h-8 text-brand-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Having an issue?</h2>
                <p className="text-muted-foreground">
                  Use the topics below to find answers. If you still need help, reach out through support or create a ticket for your project.
                </p>
              </div>
            </div>

            {/* FAQ */}
            <Card className="border-border">
              <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                  {FAQ_ITEMS.map((item, index) => (
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
            <Card className="border-border bg-muted/30">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">Still need help?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Get in touch with your project&apos;s support team or open a ticket.
                </p>
                <div className="flex flex-wrap gap-3">
                  {isAuthenticated && (
                    <>
                      <Button asChild className="bg-brand-primary hover:bg-brand-primary/90 text-white">
                        <Link href="/support/chat" className="inline-flex items-center gap-2">
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
