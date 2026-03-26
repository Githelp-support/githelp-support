"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { X, Info } from "lucide-react"
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
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[500px] bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Creating new SLA</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 px-6 py-6 space-y-6 overflow-y-auto max-h-full">
            {/* Contact details */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Contact details</h3>

              <div className="space-y-2">
                <label className="text-sm text-gray-700">Contract name</label>
                <Input
                  placeholder="Choose name"
                  value={formData.contractName}
                  onChange={(e) => handleInputChange("contractName", e.target.value)}
                  className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700">Main contact person</label>
                <Input
                  placeholder="First and last name"
                  value={formData.mainContactPerson}
                  onChange={(e) => handleInputChange("mainContactPerson", e.target.value)}
                  className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700">Email address</label>
                <Input
                  type="email"
                  placeholder="Type in address"
                  value={formData.emailAddress}
                  onChange={(e) => handleInputChange("emailAddress", e.target.value)}
                  className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Support limitations */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Support limitations</h3>

              <RadioGroup
                value={formData.supportLimitation}
                onValueChange={(value) => handleInputChange("supportLimitation", value)}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="unlimited" id="unlimited" className="border-gray-300" />
                  <Label htmlFor="unlimited" className="text-sm text-gray-700 flex items-center gap-2">
                    Unlimited hours
                    <Info className="w-4 h-4 text-gray-400" />
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="limited" id="limited" className="border-gray-300" />
                  <Label htmlFor="limited" className="text-sm text-gray-700 flex items-center gap-2">
                    Limited hours
                    <Info className="w-4 h-4 text-gray-400" />
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Hours included - only visible when "Limited hours" is selected */}
            {formData.supportLimitation === "limited" && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Hours included</h3>

                <div className="space-y-2">
                  <label className="text-sm text-gray-700">Monthly hours included in contract</label>
                  <Input
                    placeholder="Number of hours"
                    type="number"
                    value={formData.monthlyHours}
                    onChange={(e) => handleInputChange("monthlyHours", e.target.value)}
                    className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="rollover"
                    checked={formData.unusedHoursRollover}
                    onCheckedChange={(checked) => handleInputChange("unusedHoursRollover", checked as boolean)}
                    className="border-gray-300"
                  />
                  <Label htmlFor="rollover" className="text-sm text-gray-700 flex items-center gap-2">
                    Unused hours rollover
                    <Info className="w-4 h-4 text-gray-400" />
                  </Label>
                </div>
              </div>
            )}

            {/* Subscription cost */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                Subscription cost
                <Info className="w-4 h-4 text-gray-400" />
              </h3>

              <div className="space-y-2">
                <label className="text-sm text-gray-700">Cost</label>
                <Input
                  placeholder="USD 0.00"
                  value={formData.subscriptionCost}
                  onChange={(e) => handleInputChange("subscriptionCost", e.target.value)}
                  className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 flex items-center gap-2">
                  Paid
                  <Info className="w-4 h-4 text-gray-400" />
                </label>
                <Select
                  value={formData.paymentFrequency}
                  onValueChange={(value) => handleInputChange("paymentFrequency", value)}
                >
                  <SelectTrigger className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500">
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
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Rates beyond included hours</h3>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 flex items-center gap-2">
                  Start price
                  <Info className="w-4 h-4 text-gray-400" />
                </label>
                <Input
                  placeholder="USD 0.00"
                  value={formData.startPrice}
                  onChange={(e) => handleInputChange("startPrice", e.target.value)}
                  className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700">USD/min - First 60 min</label>
                <Input
                  placeholder="USD 0.00"
                  value={formData.firstSixtyMinRate}
                  onChange={(e) => handleInputChange("firstSixtyMinRate", e.target.value)}
                  className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700">USD/min - After 60 min</label>
                <Input
                  placeholder="USD 0.00"
                  value={formData.afterSixtyMinRate}
                  onChange={(e) => handleInputChange("afterSixtyMinRate", e.target.value)}
                  className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Response times */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Response times</h3>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 flex items-center gap-2">
                  Max response time
                  <Info className="w-4 h-4 text-gray-400" />
                </label>
                <Input
                  placeholder="0.0 hours"
                  value={formData.maxResponseTime}
                  onChange={(e) => handleInputChange("maxResponseTime", e.target.value)}
                  className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 flex items-center gap-2">
                  Max down time
                  <Info className="w-4 h-4 text-gray-400" />
                </label>
                <Input
                  placeholder="0.0 hours"
                  value={formData.maxDownTime}
                  onChange={(e) => handleInputChange("maxDownTime", e.target.value)}
                  className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0 bg-white">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-9 border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white">
              Create SLA
            </Button>
          </div>
        </form>
      </div>

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
