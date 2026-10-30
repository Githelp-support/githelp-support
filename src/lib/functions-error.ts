import { FunctionsHttpError } from "@supabase/supabase-js"

/**
 * Edge functions return their real message as JSON `{ error: string }` in a
 * non-2xx body. supabase-js surfaces that as a `FunctionsHttpError` whose
 * `.message` is the generic "Edge Function returned a non-2xx status code"
 * and whose `.context` is the raw `Response`. These helpers read the body so
 * toasts can show the server's message instead of the generic one.
 */

/** Stable error codes the backend returns, mapped to user-facing sentences. */
const FRIENDLY_MESSAGES: Record<string, string> = {
  invite_email_mismatch:
    "This invite was sent to a different email address. Sign in with the account that received the invite.",
  invite_github_mismatch:
    "This invite is for a different GitHub account. Sign in with the GitHub account it was sent to.",
  organization_already_claimed:
    "This organization is already managed by another Githelp account. Ask one of its admins for an invite.",
  not_organization_admin:
    "Only an admin of this organization can add projects to it. Ask one of its admins for an invite.",
  github_permission_required:
    "Sign in with a GitHub account that has write access to this repository to connect it.",
  github_owner_admin_required:
    "Only the GitHub account owner, or an admin of the GitHub organization, can connect the first repository for it.",
  invite_email_unverified:
    "Confirm your email address first, then open the invite link again.",
  not_authorized_for_ticket:
    "Only the helper who claimed this ticket can do that.",
  not_ticket_helper_or_admin:
    "Only the helper who claimed this ticket or a project admin can end and charge it.",
  capture_recorded_in_stripe_only:
    "The payment was captured. It will be recorded automatically in a few minutes.",
  charge_outcome_unknown:
    "The payment provider did not confirm the charge. It is safe to retry.",
  ticket_cancelled_not_billable:
    "This ticket was closed as \"not able to help\", so the customer is not charged.",
  ticket_not_open:
    "This ticket is already closed, so no payment can be requested for it.",
  ticket_not_ended:
    "The ticket has to be ended before the payment can be captured.",
  // Guest tickets (visitors chatting without an account)
  sign_in_required:
    "Please sign in to continue. Your conversation stays where it is.",
  guest_ticket_requires_sign_in:
    "The visitor needs to sign in before this ticket can be claimed or billed. You can still reply.",
  guest_ticket_limit:
    "You've reached the limit for guest conversations today. Sign in to open more tickets.",
  guest_open_ticket_exists:
    "You already have an open guest conversation. Sign in to open more.",
  guest_project_busy:
    "This project is receiving a lot of guest conversations right now. Sign in to open your ticket.",
  guest_not_allowed:
    "Please sign in to do that.",
  invalid_guest_token:
    "Your guest session has expired, so the conversation couldn't be moved to your account.",
}

/** Postgres error hints (RAISE ... HINT) for guest tickets, mapped to user-facing copy. */
export const GUEST_HINT_MESSAGES: Record<string, string> = {
  guest_ticket_limit: FRIENDLY_MESSAGES.guest_ticket_limit,
  guest_ticket_requires_sign_in: FRIENDLY_MESSAGES.guest_ticket_requires_sign_in,
  guest_not_allowed: FRIENDLY_MESSAGES.guest_not_allowed,
}

/** The `hint` of a PostgREST/Postgres error, if any. */
export function getPostgresHint(error: unknown): string | null {
  const hint = (error as { hint?: unknown } | null)?.hint
  return typeof hint === "string" && hint.length > 0 ? hint : null
}

const GENERIC_SUPABASE_MESSAGE = /non-2xx status code/i

export class EdgeFunctionError extends Error {
  /** Raw `error` value from the response body (often a stable code). */
  readonly code: string | null
  /** Parsed JSON body, when the response carried one. */
  readonly body: Record<string, unknown> | null
  readonly status: number | null

  constructor(
    message: string,
    options: { code?: string | null; body?: Record<string, unknown> | null; status?: number | null } = {},
  ) {
    super(message)
    this.name = "EdgeFunctionError"
    this.code = options.code ?? null
    this.body = options.body ?? null
    this.status = options.status ?? null
  }
}

function friendlyMessageFor(code: string): string | null {
  return Object.prototype.hasOwnProperty.call(FRIENDLY_MESSAGES, code) ? FRIENDLY_MESSAGES[code] : null
}

function responseFrom(error: unknown): Response | null {
  if (error instanceof FunctionsHttpError) return error.context
  const ctx = (error as { context?: unknown } | null)?.context
  return typeof Response !== "undefined" && ctx instanceof Response ? ctx : null
}

/**
 * Parse the JSON body of a FunctionsHttpError. The response is cloned so the
 * body can still be read elsewhere; non-JSON bodies yield `null`.
 */
export async function getFunctionErrorBody(error: unknown): Promise<Record<string, unknown> | null> {
  const response = responseFrom(error)
  if (!response) return null
  try {
    const parsed: unknown = await response.clone().json()
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Convert any error thrown around `supabase.functions.invoke` into an Error
 * carrying the server's message (or `fallback`), plus the raw code/body.
 */
export async function toEdgeFunctionError(error: unknown, fallback: string): Promise<EdgeFunctionError> {
  if (error instanceof EdgeFunctionError) return error

  const response = responseFrom(error)
  const body = await getFunctionErrorBody(error)
  // Bodies are `{ error: code, message? }`; some older handlers send
  // `{ error: sentence, code }`, so prefer an explicit `code` field.
  const codeField = body && typeof body.code === "string" ? body.code : null
  const errorField = body && typeof body.error === "string" ? body.error : null
  const rawCode = codeField ?? errorField
  const rawMessage = body && typeof body.message === "string" ? body.message : null

  let message: string | null = null
  if (rawCode) {
    message =
      friendlyMessageFor(rawCode) ?? rawMessage ?? (codeField && errorField ? errorField : rawCode)
  } else if (rawMessage) message = rawMessage

  if (!message) {
    const own = error instanceof Error ? error.message : (error as { message?: unknown } | null)?.message
    if (typeof own === "string" && own.trim() && !GENERIC_SUPABASE_MESSAGE.test(own)) message = own
  }

  return new EdgeFunctionError(message || fallback, {
    code: rawCode,
    body,
    status: response?.status ?? null,
  })
}

/**
 * The message to show the user for an edge-function failure: the JSON
 * `error` from the response body (mapped to a friendly sentence for known
 * codes), else `error.message`, else `fallback`.
 */
export async function getFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  return (await toEdgeFunctionError(error, fallback)).message
}
