"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Search, Clock, Target, HelpCircle } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useProject, useProjectBySlug, useProjectResources, useProjectBranding, useProjectPaymentSettings } from "@/hooks/useProject"
import { useUser } from "@/contexts/user-context"
import { useProjectRole } from "@/hooks/useProjectRole"
import { useParams, useSearchParams } from "next/navigation"

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState("get-support")
  const [searchQuery, setSearchQuery] = useState("")
  const { setProjectRole } = useUser()
  const searchParams = useSearchParams()
  const params = useParams<{ slug?: string }>()

  const projectIdParam = searchParams.get("project")
  const slugParam = params?.slug || searchParams.get("slug")
  const { data: projectById } = useProject(projectIdParam || "")
  const { data: projectBySlug } = useProjectBySlug(slugParam || "")
  const project = projectIdParam ? projectById : projectBySlug
  const projectId = project?.project_id

  const supportQuery = slugParam
    ? `?slug=${encodeURIComponent(slugParam)}`
    : projectIdParam
      ? `?project=${encodeURIComponent(projectIdParam)}`
      : ""

  // Get user's role in this project
  const { data: projectRole } = useProjectRole(projectId || undefined)
  
  // Update user context with project role
  useEffect(() => {
    if (projectId && projectRole) {
      setProjectRole(projectRole)
    } else if (!projectId) {
      setProjectRole(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectRole])

  // Fetch resources and branding from database
  const { data: resourcesData, isLoading: resourcesLoading } = useProjectResources(projectId || "")
  const { data: brandingData } = useProjectBranding(projectId || "")
  const { data: paymentSettings } = useProjectPaymentSettings(projectId || "")

  // Get project logo from branding only
  const projectLogo = brandingData?.logo_url || null
  const projectName = project?.name || "Algorax"

  // Format payment values (convert cents to dollars)
  const startPrice = paymentSettings?.ticket_start_price ? (paymentSettings.ticket_start_price / 100).toFixed(2) : "10.00"
  const first60Price = paymentSettings?.ticket_price_minute_first_60 ? (paymentSettings.ticket_price_minute_first_60 / 100).toFixed(2) : "1.50"
  const after60Price = paymentSettings?.ticket_price_minute_after_60 ? (paymentSettings.ticket_price_minute_after_60 / 100).toFixed(2) : "1.00"

  // Transform resources data
  const resources = resourcesData || []

  const faqs = [
    {
      question: "Who will I get help from?",
      answer:
        "You'll be connected with validated experts from our community who have proven experience in your specific area of need.",
    },
    {
      question: "How long will it take before someone will help me?",
      answer:
        "Response times vary based on your SLA agreement. Typically, you can expect a response within 1-4 hours during business hours.",
    },
    {
      question: "My employer will pay for the service. How do I facilitate that?",
      answer:
        "You can set up an SLA agreement with your employer. Contact us to arrange corporate billing and payment terms.",
    },
    {
      question: "How does the process work, from me reaching out to me getting help?",
      answer:
        "Simply submit your request, get matched with an expert, communicate through our platform, and receive help in real-time or asynchronously.",
    },
    {
      question: "How much will I pay?",
      answer:
        "Pricing depends on the complexity of your issue and response time requirements. Check our Rates and details tab for more information.",
    },
  ]

  const filteredFaqs = faqs.filter((faq) => faq.question.toLowerCase().includes(searchQuery.toLowerCase()))

  const supportAreas = [
    "Problems",
    "Bugs",
    "Dependencies",
    "Breaking changes",
    "Best practices",
    "Mentoring",
    "Code reviews",
    "Documentation",
  ]

  if (!projectIdParam && !slugParam) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h1 className="text-2xl font-semibold text-[#444444] mb-2">Missing project identifier</h1>
          <p className="text-[#868c98] mb-6">
            This support page is project-specific. Please open it using a link that includes either a project <span className="font-semibold">slug</span> or <span className="font-semibold">id</span>.
          </p>
          <div className="flex items-center gap-3">
            <Button asChild className="bg-[#554abf] hover:bg-[#4a3fa3] text-white cursor-pointer">
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="border-gray-200 text-[#444444] bg-transparent cursor-pointer">
              <Link href="/">Go to home</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="relative">
          <div className="w-20 h-20 bg-white rounded-lg shadow-sm flex items-center justify-center overflow-hidden">
            <Avatar className="w-20 h-20">
              <AvatarImage src={projectLogo} alt={projectName} />
              <AvatarFallback className="bg-brand-primary text-white text-xs">
                {projectName?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="absolute -top-2 -left-2 bg-[#868c98] text-white text-xs px-2 py-1 rounded">OS</div>
        </div>
        <div>
          <h1 className="text-3xl font-normal text-[#444444]">
            Welcome to the support page for <span className="font-semibold">{projectName}</span>
          </h1>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-12">
        <nav className="flex gap-8">
          <button type="button"
            onClick={() => setActiveTab("get-support")}
            className={`pb-3 px-1 text-sm font-medium cursor-pointer transition-colors ${
              activeTab === "get-support"
                ? "text-[#554abf] border-b-2 border-[#554abf]"
                : "text-[#868c98] hover:text-[#444444]"
            }`}
          >
            Get support
          </button>
          <button type="button"
            onClick={() => setActiveTab("rates")}
            className={`pb-3 px-1 text-sm font-medium cursor-pointer transition-colors ${
              activeTab === "rates"
                ? "text-[#554abf] border-b-2 border-[#554abf]"
                : "text-[#868c98] hover:text-[#444444]"
            }`}
          >
            Rates and details
          </button>
          <button type="button"
            onClick={() => setActiveTab("resources")}
            className={`pb-3 px-1 text-sm font-medium cursor-pointer transition-colors ${
              activeTab === "resources"
                ? "text-[#554abf] border-b-2 border-[#554abf]"
                : "text-[#868c98] hover:text-[#444444]"
            }`}
          >
            Resources
          </button>
          <button type="button"
            onClick={() => setActiveTab("about")}
            className={`pb-3 px-1 text-sm font-medium cursor-pointer transition-colors ${
              activeTab === "about"
                ? "text-[#554abf] border-b-2 border-[#554abf]"
                : "text-[#868c98] hover:text-[#444444]"
            }`}
          >
            About support
          </button>
        </nav>
      </div>

      {activeTab === "get-support" && (
        <div className="space-y-12">
          {/* Support buttons section */}
          <div>
            <h2 className="text-xl font-normal text-[#444444] mb-6">Get help with an issue by a validated expert</h2>
            <div className="flex gap-3">
              <Link href={`/support/get-support${supportQuery}`}>
                <Button
                  variant="outline"
                  className="border-[#554abf] text-[#554abf] hover:bg-[#554abf] hover:text-white cursor-pointer bg-transparent"
                >
                  Get support
                </Button>
              </Link>
              <Link href={`/support/sla${supportQuery}`}>
                <Button
                  variant="outline"
                  className="border-[#554abf] text-[#554abf] hover:bg-[#554abf] hover:text-white cursor-pointer bg-transparent"
                >
                  I have an SLA ID
                </Button>
              </Link>
            </div>
          </div>

          {/* FAQ section */}
          <div className="bg-white rounded-lg p-8 shadow-sm">
            <h3 className="text-lg font-normal text-[#444444] mb-6">Do you have any questions on how support works?</h3>

            {/* Search input */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#868c98]" />
              <Input
                type="text"
                placeholder="Search FAQs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-gray-200"
              />
            </div>

            {/* FAQ Accordion */}
            <Accordion type="single" collapsible className="space-y-2">
              {filteredFaqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-b border-gray-200">
                  <AccordionTrigger className="text-[#444444] hover:text-[#554abf] text-left py-4 cursor-pointer">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-[#868c98] pb-4">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {filteredFaqs.length === 0 && (
              <p className="text-center text-[#868c98] py-8">No FAQs found matching your search.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "rates" && (
        <div className="space-y-12">
          {/* Rates section */}
          <div>
            <h2 className="text-2xl font-normal text-[#444444] mb-8">{projectName}&apos;s rates</h2>

            {/* Pricing cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {/* Ticket start price */}
              <div className="rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-br from-[#c5b0ef] to-[#b8a0e8] p-6 text-center">
                  <div className="text-2xl font-semibold text-[#2d2a49]">{startPrice} USD</div>
                </div>
                <div className="bg-white p-6">
                  <h3 className="font-semibold text-[#444444] mb-2">Ticket start price</h3>
                  <p className="text-sm text-[#868c98]">
                    Price for starting the support. You will of course not pay anything if your ticket isn&apos;t picked up.
                  </p>
                </div>
              </div>

              {/* First 60 minutes */}
              <div className="rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-br from-[#e7e5fd] to-[#d8d4f7] p-6 text-center">
                  <div className="text-2xl font-semibold text-[#2d2a49]">{first60Price} USD/min</div>
                </div>
                <div className="bg-white p-6">
                  <h3 className="font-semibold text-[#444444] mb-2">First 60 minutes</h3>
                  <p className="text-sm text-[#868c98]">
                    This is the price per minute for the first 60 minutes. Most issues are solved within that time.
                  </p>
                </div>
              </div>

              {/* After 60 minutes */}
              <div className="rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gradient-to-br from-[#f9f7ff] to-[#f0ecff] p-6 text-center">
                  <div className="text-2xl font-semibold text-[#2d2a49]">{after60Price} USD/min</div>
                </div>
                <div className="bg-white p-6">
                  <h3 className="font-semibold text-[#444444] mb-2">After 60 minutes</h3>
                  <p className="text-sm text-[#868c98]">
                    If the support is lengthy, the price drops to {after60Price} USD per minute after the first hour.
                  </p>
                </div>
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Average response time */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-start gap-3 mb-4">
                  <Clock className="h-5 w-5 text-[#444444] mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-normal text-[#444444]">Average response time</h3>
                      <HelpCircle className="h-4 w-4 text-[#868c98]" />
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-normal text-[#444444]">6 minutes</p>
              </div>

              {/* Core team support */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-start gap-3 mb-4">
                  <Target className="h-5 w-5 text-[#444444] mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-normal text-[#444444]">Core team support</h3>
                      <HelpCircle className="h-4 w-4 text-[#868c98]" />
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-normal text-[#444444]">Yes</p>
              </div>
            </div>

            {/* Get an SLA button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-[#554abf] text-[#554abf] hover:bg-[#554abf] hover:text-white cursor-pointer bg-transparent"
              >
                Get an SLA
              </Button>
              <HelpCircle className="h-4 w-4 text-[#868c98]" />
            </div>
          </div>
        </div>
      )}

      {activeTab === "resources" && (
        <div className="space-y-8">
          <h2 className="text-2xl font-normal text-[#444444]">{projectName}&apos;s resources</h2>

          {resourcesLoading ? (
            <p className="text-[#868c98]">Loading resources...</p>
          ) : resources.length === 0 ? (
            <p className="text-[#868c98]">No resources available yet.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {resources.map((resource) => (
                <a
                  key={resource.id}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-gradient-to-r from-[#c5b0ef] to-[#b8a0e8] text-[#2d2a49] rounded-full font-medium hover:from-[#b8a0e8] hover:to-[#ab90e0] transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  {resource.name}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "about" && (
        <div className="space-y-16">
          {/* How support works section */}
          <div className="max-w-[37rem]">
            <h2 className="text-2xl font-normal text-[#444444] mb-6">How support works</h2>
            <p className="text-[#444444] mb-4">
              The <span className="font-semibold">{projectName}</span> team can help out with issues related to areas such
              as:
            </p>
            <div className="flex flex-wrap gap-2">
              {supportAreas.map((area) => (
                <span
                  key={area}
                  className="px-4 py-2 border border-[#554abf] text-[#554abf] rounded-md text-sm"
                  style={{ fontFamily: 'Cousine, monospace' }}
                >
                  {area}
                </span>
              ))}
            </div>
          </div>

          {/* Get started section */}
          <div>
            <h2 className="text-2xl font-normal text-[#444444] mb-6">Get started</h2>
            <div className="bg-white rounded-lg p-8 shadow-sm max-w-[52rem]">
              <div className="space-y-0 max-w-[36rem]">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-[#554abf] flex-shrink-0"></div>
                    <div className="w-0.5 flex-1 bg-[#554abf] min-h-[2rem]"></div>
                  </div>
                  <div className="flex-1 pb-8">
                    <h3 className="text-lg font-semibold text-[#444444] mb-2">Choose how to get help</h3>
                    <p className="text-[#868c98]">
                      You can get help through standard support or through an SLA. Getting help through an SLA requires
                      no registration, if accepted by your employer.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-[#554abf] flex-shrink-0"></div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[#444444] mb-2">Register or share details</h3>
                    <p className="text-[#868c98]">
                      Register an account or share your email and card details before getting started. Registration only
                      takes a couple of minutes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Receive help section */}
          <div>
            <h2 className="text-2xl font-normal text-[#444444] mb-6">Receive help</h2>
            <div className="bg-white rounded-lg p-8 shadow-sm max-w-[52rem]">
              <div className="space-y-0 max-w-[36rem]">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-[#554abf] flex-shrink-0"></div>
                    <div className="w-0.5 flex-1 bg-[#554abf] min-h-[2rem]"></div>
                  </div>
                  <div className="flex-1 pb-8">
                    <h3 className="text-lg font-semibold text-[#444444] mb-2">Wait for a helper to connect</h3>
                    <p className="text-[#868c98]">
                      How long it takes varies. Looking into &quot;Rates and details&quot; will give you an idea about average
                      waiting time. The helper is normally someone on the core team of the project.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-[#554abf] flex-shrink-0"></div>
                    <div className="w-0.5 flex-1 bg-[#554abf] min-h-[2rem]"></div>
                  </div>
                  <div className="flex-1 pb-8">
                    <h3 className="text-lg font-semibold text-[#444444] mb-2">Start chatting</h3>
                    <p className="text-[#868c98]">
                      Describe your issue, in text or by sharing code, and get help. If the helper can&apos;t help you, you
                      are normally not charged anything.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-[#554abf] flex-shrink-0"></div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[#444444] mb-2">Issue is solved</h3>
                    <p className="text-[#868c98]">
                      When you are pleased with the assistance, the chat is ended, and time spent is logged by the
                      helper.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment and reports section */}
          <div>
            <h2 className="text-2xl font-normal text-[#444444] mb-6">Payment and reports</h2>
            <div className="bg-white rounded-lg p-8 shadow-sm max-w-[52rem]">
              <div className="space-y-0 max-w-[36rem]">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-[#554abf] flex-shrink-0"></div>
                    <div className="w-0.5 flex-1 bg-[#554abf] min-h-[2rem]"></div>
                  </div>
                  <div className="flex-1 pb-8">
                    <h3 className="text-lg font-semibold text-[#444444] mb-2">Choose how to pay</h3>
                    <p className="text-[#868c98]">
                      If you are using support both privately and through your employer, you are asked to specify who
                      you want the support charged to. The amount is charged to your card.
                    </p>
                    <p className="text-[#868c98] mt-2">
                      Payment is then made to the helper, with a commission also going to the project you are getting
                      support with. In this case <span className="font-semibold">{projectName}</span>.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-[#554abf] flex-shrink-0"></div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[#444444] mb-2">Receive documentation</h3>
                    <p className="text-[#868c98]">
                      You will receive a report via cards or email, showing payment and support details. If you are
                      registered, you can also retrieve any support documentation from the Github user login page.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
