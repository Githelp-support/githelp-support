"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/ui/form-field"
import { DrawerPanel } from "@/components/ui/drawer-panel"
import { Info, Github } from "lucide-react"

interface AcceptRequestDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (requestData: { category: string }) => void
  requestData: {
    name: string
    email?: string
    githubUser: string
    githubAccount: string
  } | null
}

export function AcceptRequestDrawer({ isOpen, onClose, onSubmit, requestData }: AcceptRequestDrawerProps) {
  const [category, setCategory] = useState("community")

  if (!requestData) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ category })
    onClose()
  }

  const displayEmail = requestData.email || `${requestData.githubUser}@gmail.com`

  return (
    <DrawerPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Accept helper request"
      width="w-[440px]"
      className="shadow-2xl"
      headerAction={<Info className="w-4 h-4 text-muted-foreground" />}
      footer={
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11 rounded-xl text-[14px] font-semibold shadow-sm">
            Cancel
          </Button>
          <Button type="submit" form="accept-request-form" variant="default" className="flex-1 h-11 rounded-xl text-[14px] font-semibold bg-brand-primary hover:bg-brand-primary/90 text-white shadow-md">
            Accept request
          </Button>
        </div>
      }
    >
      <form id="accept-request-form" onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 px-6 py-5 space-y-6 overflow-auto">
          <FormField label="GitHub user">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Github className="w-4 h-4" />
              </span>
              <Input value={requestData.githubUser} disabled className="h-10 rounded-lg bg-muted/60 border-border text-foreground disabled:opacity-70 pl-9" />
            </div>
          </FormField>
          <FormField label="Full name">
            <Input value={requestData.name} disabled className="h-10 rounded-lg bg-muted/60 border-border text-foreground disabled:opacity-70" />
          </FormField>
          <FormField label="Email address">
            <Input value={displayEmail} disabled className="h-10 rounded-lg bg-muted/60 border-border text-foreground disabled:opacity-70" />
          </FormField>
          <FormField label="Category">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full h-10 rounded-lg border-border focus-visible:ring-ring">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="core">Core team</SelectItem>
                <SelectItem value="extended">Extended team</SelectItem>
                <SelectItem value="community">Community</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <div className="bg-muted/30 border border-border/60 rounded-xl px-4 py-3.5">
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              When accepting this request, {requestData.githubUser} will be validated as a helper and be eligible to
              receive and accept support requests.
            </p>
          </div>
        </div>
      </form>
    </DrawerPanel>
  )
}
