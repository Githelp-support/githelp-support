"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DrawerPanel } from "@/components/ui/drawer-panel"
import { Info } from "lucide-react"

interface AcceptRequestDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (requestData: { category: string }) => void
  requestData: {
    name: string
    discordUser: string
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

  const generatedEmail = `${requestData.discordUser}@gmail.com`

  return (
    <DrawerPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Accept helper request"
      headerAction={<Info className="w-4 h-4 text-muted-foreground" />}
      footer={
        <div className="flex space-x-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" form="accept-request-form" variant="default" className="flex-1">
            Accept request
          </Button>
        </div>
      }
    >
      <form id="accept-request-form" onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Discord username</label>
            <Input value={requestData.discordUser} disabled className="bg-muted border-input text-muted-foreground" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Full name</label>
            <Input value={requestData.name} disabled className="bg-muted border-input text-muted-foreground" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email address</label>
            <Input value={generatedEmail} disabled className="bg-muted border-input text-muted-foreground" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="border-input">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="core">Core team</SelectItem>
                <SelectItem value="extended">Extended team</SelectItem>
                <SelectItem value="community">Community</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              When accepting this request, {requestData.discordUser} will be validated as a helper and be eligible to
              receive and accept support requests.
            </p>
          </div>
        </div>
      </form>
    </DrawerPanel>
  )
}
