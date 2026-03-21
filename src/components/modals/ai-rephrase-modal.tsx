"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Sparkles, RefreshCw } from "lucide-react"

interface AIRephraseModalProps {
  isOpen: boolean
  onClose: () => void
  originalText: string
}

export function AIRephraseModal({ isOpen, onClose, originalText }: AIRephraseModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [rephrasedText, setRephrasedText] = useState("")
  const [hasGenerated, setHasGenerated] = useState(false)

  const handleRephrase = async () => {
    setIsLoading(true)

    // Simulate AI processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Mock AI rephrase response
    const rephrased = `The user is experiencing an issue with event type discovery in their application. They have configured event types but the system is not recognizing or processing them correctly. They've provided a code example showing a PurchaseEvent record with PurchaseItem containing ItemId, UserId, and PaymentMethodId properties. This appears to be a configuration or implementation bug where the event registration or discovery mechanism is not functioning as expected.

Key points:
• Event types are configured but not being discovered
• System behavior doesn't match expectations  
• Code example shows a record-based event structure
• Likely related to event registration or discovery pipeline`

    setRephrasedText(rephrased)
    setHasGenerated(true)
    setIsLoading(false)
  }

  const handleRegenerate = () => {
    setHasGenerated(false)
    setRephrasedText("")
    handleRephrase()
  }

  const handleClose = () => {
    setHasGenerated(false)
    setRephrasedText("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-primary" />
            AI Rephrase - Better Understanding
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6">
          {/* Original Text */}
          <div>
            <h3 className="font-medium text-foreground mb-3">Original user request:</h3>
            <Card className="border border-border">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{originalText}</p>
              </CardContent>
            </Card>
          </div>

          {/* AI Rephrased Text */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-foreground">AI interpretation:</h3>
              {hasGenerated && (
                <Button
                  onClick={handleRegenerate}
                  variant="outline"
                  size="sm"
                  className="border-brand-primary text-brand-primary hover:bg-brand-primary/10 bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
              )}
            </div>

            <Card className="border border-border">
              <CardContent className="p-4">
                {!hasGenerated && !isLoading && (
                  <div className="text-center py-8">
                    <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Click &quot;Generate AI Interpretation&quot; to get a clearer understanding of the user&apos;s request.
                    </p>
                    <Button onClick={handleRephrase} variant="lavender">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate AI Interpretation
                    </Button>
                  </div>
                )}

                {isLoading && (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 text-brand-primary animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">AI is analyzing the request...</p>
                  </div>
                )}

                {hasGenerated && rephrasedText && (
                  <div className="space-y-4">
                    <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-brand-primary" />
                        <span className="text-sm font-medium text-brand-primary">AI Interpretation</span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{rephrasedText}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          {hasGenerated && (
            <Button variant="lavender" onClick={handleClose}>
              Continue with ticket
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
