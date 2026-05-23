import { loadStripe, type Stripe } from "@stripe/stripe-js"

let stripePromise: Promise<Stripe | null> | null = null

/**
 * Lazy, memoized Stripe.js loader. Reads the publishable key from the env.
 * Returns null in environments without a configured key (e.g. tests) so
 * callers can surface a useful error instead of crashing.
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.warn("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set")
      stripePromise = Promise.resolve(null)
    } else {
      stripePromise = loadStripe(key)
    }
  }
  return stripePromise
}
