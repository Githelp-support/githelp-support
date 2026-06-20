import { loadStripe, type Stripe } from "@stripe/stripe-js"

export type StripeMode = "test" | "live"

// One memoized Stripe.js instance per mode.
const promises: Partial<Record<StripeMode, Promise<Stripe | null>>> = {}

function publishableKeyFor(mode: StripeMode): string | undefined {
  if (mode === "test") {
    return process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY
  }
  // Live: prefer the explicit live var; fall back to the legacy single-key var
  // so deployments that only set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY keep working.
  return (
    process.env.NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  )
}

/**
 * Lazy, memoized Stripe.js loader — one instance per mode. A sandbox project's
 * PaymentIntents live in Stripe **test** mode, so confirming their client_secret
 * (e.g. an SCA/3D-Secure step) requires the **test** publishable key; live
 * projects require the live key. Using the wrong-mode key makes Stripe.js reject
 * the client_secret, so the caller must pass the payment's mode (sandbox → test).
 *
 * Returns null when the matching key is unset (e.g. in tests) so callers can
 * surface a useful error instead of crashing.
 */
export function getStripe(mode: StripeMode): Promise<Stripe | null> {
  if (!promises[mode]) {
    const key = publishableKeyFor(mode)
    if (!key) {
      console.warn(`Stripe ${mode} publishable key is not set`)
      promises[mode] = Promise.resolve(null)
    } else {
      promises[mode] = loadStripe(key)
    }
  }
  return promises[mode]!
}
