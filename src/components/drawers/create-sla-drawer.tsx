"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/ui/form-field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Info } from "lucide-react"
import { DrawerPanel } from "@/components/ui/drawer-panel"
import { SLAConfirmationModal } from "@/components/modals/sla-confirmation-modal"

export interface SLAPayload {
  id: string
  contractName: string
  mainContactPerson: string
  emailAddress: string
  supportLimitation: string
  monthlyHours: string
  unusedHoursRollover: boolean
  subscriptionCost: string
  paymentFrequency: string
  startPrice: string
  firstSixtyMinRate: string
  afterSixtyMinRate: string
  maxResponseTime: string
  maxDownTime: string
}

interface CreateSLADrawerProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (sla: SLAPayload) => void
}

export function CreateSLADrawer({ isOpen, onClose, onSubmit }: CreateSLADrawerProps) {
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [generatedSlaId, setGeneratedSlaId] = useState("")

  const [formData, setFormData] = useState({
    contractName: "",
    mainContactPerson: "",
    emailAddress: "",
    supportLimitation: "unlimited", // "unlimited" or "limited"
    monthlyHours: "",
    unusedHoursRollover: false,
    subscriptionCost: "",
    paymentFrequency: "",
    startPrice: "",
    firstSixtyMinRate: "",
    afterSixtyMinRate: "",
    maxResponseTime: "",
    maxDownTime: "",
  })

  const generateSlaId = () => {
    return Math.random().toString(36).substring(2, 15).toUpperCase()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const slaId = generateSlaId()
    setGeneratedSlaId(slaId)
    setShowConfirmation(true)
  }

  const handleConfirmCreation = () => {
    onSubmit({ ...formData, id: generatedSlaId })
    setFormData({
      contractName: "",
      mainContactPerson: "",
      emailAddress: "",
      supportLimitation: "unlimited",
      monthlyHours: "",
      unusedHoursRollover: false,
      subscriptionCost: "",
      paymentFrequency: "",
      startPrice: "",
      firstSixtyMinRate: "",
      afterSixtyMinRate: "",
      maxResponseTime: "",
      maxDownTime: "",
    })
    setShowConfirmation(false)
    onClose()
  }

  const handleCloseConfirmation = () => {
    setShowConfirmation(false)
    onClose()
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <>
      <DrawerPanel isOpen={isOpen} onClose={onClose} title="Creating new SLA" width="w-[500px]">
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 px-6 py-6 space-y-6 overflow-y-auto max-h-full">
            {/* Contact details */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">Contact details</h3>

              <FormField label="Contract name">
                <Input
                  placeholder="Choose name"
                  value={formData.contractName}
                  onChange={(e) => handleInputChange("contractName", e.target.value)}
                  className="border-border-control"
                  required
                />
              </FormField>

              <FormField label="Main contact person">
                <Input
                  placeholder="First and last name"
                  value={formData.mainContactPerson}
                  onChange={(e) => handleInputChange("mainContactPerson", e.target.value)}
                  className="border-border-control"
                  required
                />
              </FormField>

              <FormField label="Email address">
                <Input
                  type="email"
                  placeholder="Type in address"
                  value={formData.emailAddress}
                  onChange={(e) => handleInputChange("emailAddress", e.target.value)}
                  className="border-border-control"
                  required
                />
              </FormField>
            </div>

            {/* Support limitations */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">Support limitations</h3>

              <RadioGroup
                value={formData.supportLimitation}
                onValueChange={(value) => {
                  handleInputChange("supportLimitation", value)
                  if (value === "unlimited") {
                    setFormData((prev) => ({ ...prev, monthlyHours: "", unusedHoursRollover: false, startPrice: "", firstSixtyMinRate: "", afterSixtyMinRate: "" }))
                  }
                }}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="unlimited" id="unlimited" className="border-border-control" />
                  <Label htmlFor="unlimited" className="text-sm text-text-secondary flex items-center gap-2">
                    Unlimited hours
                    <Info className="w-4 h-4 text-text-tertiary" />
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="limited" id="limited" className="border-border-control" />
                  <Label htmlFor="limited" className="text-sm text-text-secondary flex items-center gap-2">
                    Limited hours
                    <Info className="w-4 h-4 text-text-tertiary" />
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Hours included */}
            {formData.supportLimitation === "limited" && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Hours included</h3>

                <FormField label="Monthly hours included in contract">
                  <Input
                    placeholder="Number of hours"
                    type="number"
                    value={formData.monthlyHours}
                    onChange={(e) => handleInputChange("monthlyHours", e.target.value)}
                    className="border-border-control"
                  />
                </FormField>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="rollover"
                    checked={formData.unusedHoursRollover}
                    onCheckedChange={(checked) => handleInputChange("unusedHoursRollover", checked as boolean)}
                    className="border-border-control"
                  />
                  <Label htmlFor="rollover" className="text-sm text-text-secondary flex items-center gap-2">
                    Unused hours rollover
                    <Info className="w-4 h-4 text-text-tertiary" />
                  </Label>
                </div>
              </div>
            )}

            {/* Subscription cost */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                Subscription cost
                <Info className="w-4 h-4 text-text-tertiary" />
              </h3>

              <FormField label="Cost">
                <Input
                  placeholder="USD 0.00"
                  value={formData.subscriptionCost}
                  onChange={(e) => handleInputChange("subscriptionCost", e.target.value)}
                  className="border-border-control"
                />
              </FormField>

              <div className="space-y-2">
                <label className="text-sm text-text-secondary flex items-center gap-2">
                  Paid
                  <Info className="w-4 h-4 text-text-tertiary" />
                </label>
                <Select
                  value={formData.paymentFrequency}
                  onValueChange={(value) => handleInputChange("paymentFrequency", value)}
                >
                  <SelectTrigger className="border-border-control">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Rates beyond included hours */}
            {formData.supportLimitation === "limited" && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Rates beyond included hours</h3>

                <div className="space-y-2">
                  <label className="text-sm text-text-secondary flex items-center gap-2">
                    Start price
                    <Info className="w-4 h-4 text-text-tertiary" />
                  </label>
                  <Input
                    placeholder="USD 0.00"
                    value={formData.startPrice}
                    onChange={(e) => handleInputChange("startPrice", e.target.value)}
                    className="border-border-control"
                  />
                </div>

                <FormField label="USD/min - First 60 min">
                  <Input
                    placeholder="USD 0.00"
                    value={formData.firstSixtyMinRate}
                    onChange={(e) => handleInputChange("firstSixtyMinRate", e.target.value)}
                    className="border-border-control"
                  />
                </FormField>

                <FormField label="USD/min - After 60 min">
                  <Input
                    placeholder="USD 0.00"
                    value={formData.afterSixtyMinRate}
                    onChange={(e) => handleInputChange("afterSixtyMinRate", e.target.value)}
                    className="border-border-control"
                  />
                </FormField>
              </div>
            )}

            {/* Response times */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">Response times</h3>

              <div className="space-y-2">
                <label className="text-sm text-text-secondary flex items-center gap-2">
                  Max response time
                  <Info className="w-4 h-4 text-text-tertiary" />
                </label>
                <Input
                  placeholder="0.0 hours"
                  value={formData.maxResponseTime}
                  onChange={(e) => handleInputChange("maxResponseTime", e.target.value)}
                  className="border-border-control"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-text-secondary flex items-center gap-2">
                  Max down time
                  <Info className="w-4 h-4 text-text-tertiary" />
                </label>
                <Input
                  placeholder="0.0 hours"
                  value={formData.maxDownTime}
                  onChange={(e) => handleInputChange("maxDownTime", e.target.value)}
                  className="border-border-control"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border-subtle flex gap-3 flex-shrink-0 bg-background">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-border-control text-text-secondary hover:bg-surface-hover bg-background"
            >
              Cancel
            </Button>
            <Button type="submit" variant="brand" className="flex-1">
              Create SLA
            </Button>
          </div>
        </form>
      </DrawerPanel>

      {/* Confirmation Modal */}
      <SLAConfirmationModal
        isOpen={showConfirmation}
        onClose={handleCloseConfirmation}
        onConfirm={handleConfirmCreation}
        slaId={generatedSlaId}
      />
    </>
  )
}
