"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { getStripe } from "@/lib/stripe"

interface Props {
  clientSecret: string
  onResolved: (status: "authorized" | "requires_action") => void
  onCancel: () => void
}

/**
 * Lightweight modal: takes a PaymentIntent client_secret and asks Stripe.js
 * to confirm it. On success (PI moves to requires_capture / succeeded) we
 * call onResolved("authorized"). If Stripe still wants another step, we
 * call onResolved("requires_action") so the caller can decide what to do
 * next.
 */
export function ConfirmPaymentModal({ clientSecret, onResolved, onCancel }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const stripe = await getStripe()
      if (!stripe) {
        setError("Stripe is not configured.")
        return
      }
      const result = await stripe.confirmCardPayment(clientSecret)
      if (result.error) {
        setError(result.error.message ?? "Payment confirmation failed.")
        return
      }
      const piStatus = result.paymentIntent?.status
      if (piStatus === "requires_capture" || piStatus === "succeeded") {
        onResolved("authorized")
      } else {
        onResolved("requires_action")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment confirmation failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        <h2 className="text-lg font-semibold mb-2">Confirm your payment</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your bank requires an extra confirmation step before we can place a hold for this ticket.
        </p>
        {error && (
          <p className="text-sm text-red-600 mb-3" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={busy}>
            {busy ? "Confirming…" : "Confirm payment"}
          </Button>
        </div>
      </div>
    </div>
  )
}
