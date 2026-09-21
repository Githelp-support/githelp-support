"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Search } from "lucide-react"

export interface SupportResource {
  id: string | number
  name: string
  url: string
}

interface ResourcesContentProps {
  projectName: string
  resources: SupportResource[]
  resourcesLoading: boolean
}

const FAQS = [
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

/**
 * "Resources" tab content — shared between the public /support page tabs and
 * the user-portal /support/resources route.
 */
export function ResourcesContent({ projectName, resources, resourcesLoading }: ResourcesContentProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredFaqs = FAQS.filter((faq) => faq.question.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="space-y-8">
      <h2 className="text-[22px] font-normal text-[#444444] mb-8">{projectName}&apos;s resources</h2>

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
              className="inline-flex items-center h-8 px-6 text-sm bg-gradient-to-r from-[#c5b0ef] to-[#b8a0e8] text-[#2d2a49] rounded-md font-medium hover:from-[#b8a0e8] hover:to-[#ab90e0] transition-all cursor-pointer shadow-sm hover:shadow-md"
            >
              {resource.name}
            </a>
          ))}
        </div>
      )}

      <Card className="max-w-3xl border-[#E1E1E1] shadow-none rounded-lg">
        <CardContent className="p-0">
          <div className="px-6 py-6">
            <h3 className="text-sm font-semibold text-[#444444] mb-6">Do you have any questions on how support works?</h3>

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
          </div>

          {/* FAQ Accordion */}
          <Accordion type="single" collapsible className="w-full">
            {filteredFaqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="px-6">
                <AccordionTrigger className="text-foreground hover:no-underline hover:text-brand-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {filteredFaqs.length === 0 && (
            <p className="text-center text-sm text-[#868c98] py-8">No FAQs found matching your search.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
