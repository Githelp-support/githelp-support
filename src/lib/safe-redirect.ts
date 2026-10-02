/**
 * A redirect target taken from the URL (e.g. `?redirect=`), returned as a
 * same-origin relative path. A full URL is accepted only when it points at
 * this site (the sign-in modal passes `window.location.href`) and is reduced
 * to its path. Anything else (other origins, protocol-relative `//host`,
 * backslash tricks, control characters) is dropped so sign-in can't bounce
 * users to another site.
 */
export function safeRelativeRedirect(
    value: string | null | undefined,
    origin: string | undefined = typeof window !== "undefined" ? window.location.origin : undefined,
): string | null {
    if (!value) return null
    for (let i = 0; i < value.length; i++) {
        if (value.charCodeAt(i) < 0x20) return null
    }
    if (!value.startsWith("/")) {
        if (!origin) return null
        try {
            const url = new URL(value)
            if (url.origin !== origin) return null
            return `${url.pathname}${url.search}${url.hash}`
        } catch {
            return null
        }
    }
    if (value.startsWith("//") || value.startsWith("/\\")) return null
    return value
}

/**
 * Where Supabase tells us to send the browser back to the app. Native MCP
 * clients may use their own URL scheme (e.g. a desktop app callback), so only
 * schemes that run or read content in this page are refused.
 */
export function isSafeClientRedirect(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return !["javascript:", "data:", "vbscript:", "file:", "blob:"].includes(protocol.toLowerCase())
  } catch {
    return false
  }
}
