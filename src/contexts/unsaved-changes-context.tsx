"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { UnsavedChangesModal } from "@/components/modals/unsaved-changes-modal"

interface UnsavedChangesContextValue {
  /** True when at least one registered section on the page has unsaved changes. */
  isDirty: boolean
  /**
   * Runs `navigate` immediately when the page is clean; otherwise opens the
   * confirmation modal and runs it only if the user chooses to leave.
   */
  confirmNavigation: (navigate: () => void) => void
  /** @internal Registers/updates the dirty flag for one guarded section. */
  setDirty: (id: string, dirty: boolean, message?: string) => void
  /** @internal Removes a guarded section (on unmount). */
  clearDirty: (id: string) => void
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | undefined>(undefined)

interface DirtyEntry {
  message?: string
}

type PendingNavigation = { href: string } | { navigate: () => void }

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // Keyed by a per-caller id so several sections on the same page can be dirty independently.
  const [dirtyEntries, setDirtyEntries] = useState<Record<string, DirtyEntry>>({})
  const [pending, setPending] = useState<PendingNavigation | null>(null)

  const isDirty = Object.keys(dirtyEntries).length > 0

  const setDirty = useCallback((id: string, dirty: boolean, message?: string) => {
    setDirtyEntries((prev) => {
      if (dirty) {
        const existing = prev[id]
        if (existing && existing.message === message) return prev
        return { ...prev, [id]: { message } }
      }
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const clearDirty = useCallback((id: string) => setDirty(id, false), [setDirty])

  // A successful navigation must never leave stale dirty state or an open modal
  // behind. Skip the initial mount: child guards register in their own effects
  // (which run before this one) and must not be wiped straight away.
  const lastPathnameRef = useRef(pathname)
  useEffect(() => {
    if (lastPathnameRef.current === pathname) return
    lastPathnameRef.current = pathname
    setDirtyEntries({})
    setPending(null)
  }, [pathname])

  // (a) Intercept in-app link clicks while dirty.
  useEffect(() => {
    if (!isDirty) return

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target === "_blank") return
      if (anchor.hasAttribute("download")) return

      const rawHref = anchor.getAttribute("href") ?? ""
      if (rawHref.startsWith("#")) return

      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (url.pathname + url.search === window.location.pathname + window.location.search) return

      event.preventDefault()
      event.stopPropagation()
      setPending({ href: url.pathname + url.search + url.hash })
    }

    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [isDirty])

  // (b) Browser reload/close prompt while dirty.
  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  // (c) Programmatic navigation guard.
  const confirmNavigation = useCallback(
    (navigate: () => void) => {
      if (!isDirty) {
        navigate()
        return
      }
      setPending({ navigate })
    },
    [isDirty],
  )

  const handleStay = useCallback(() => setPending(null), [])

  const handleLeave = useCallback(() => {
    const current = pending
    setPending(null)
    setDirtyEntries({})
    if (!current) return
    if ("href" in current) {
      router.push(current.href)
    } else {
      current.navigate()
    }
  }, [pending, router])

  // Show the most recently registered custom message, if any.
  const message = useMemo(() => {
    const entries = Object.values(dirtyEntries)
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].message) return entries[i].message
    }
    return undefined
  }, [dirtyEntries])

  const value = useMemo<UnsavedChangesContextValue>(
    () => ({ isDirty, confirmNavigation, setDirty, clearDirty }),
    [isDirty, confirmNavigation, setDirty, clearDirty],
  )

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <UnsavedChangesModal
        open={pending !== null}
        message={message}
        onStay={handleStay}
        onLeave={handleLeave}
      />
    </UnsavedChangesContext.Provider>
  )
}

/** Used when no provider is mounted (e.g. isolated component tests): never dirty, navigate straight away. */
const runImmediately = (navigate: () => void) => navigate()

/**
 * Exposes the dirty flag and the programmatic-navigation guard. Tolerates a
 * missing provider by reporting a clean page and running navigations
 * immediately, so layout components can call it unconditionally.
 */
export function useUnsavedChanges(): Pick<UnsavedChangesContextValue, "isDirty" | "confirmNavigation"> {
  const context = useContext(UnsavedChangesContext)
  const isDirty = context?.isDirty ?? false
  const confirmNavigation = context?.confirmNavigation ?? runImmediately
  return useMemo(() => ({ isDirty, confirmNavigation }), [isDirty, confirmNavigation])
}

/**
 * Registers a section's dirty state with the nearest UnsavedChangesProvider.
 * Deregisters automatically on unmount.
 */
export function useUnsavedChangesGuard(isDirty: boolean, options?: { message?: string }): void {
  const context = useContext(UnsavedChangesContext)
  if (!context) {
    throw new Error("useUnsavedChangesGuard must be used within an UnsavedChangesProvider")
  }
  const { setDirty, clearDirty } = context
  const id = useId()
  const message = options?.message

  useEffect(() => {
    setDirty(id, isDirty, message)
  }, [id, isDirty, message, setDirty])

  useEffect(() => () => clearDirty(id), [id, clearDirty])
}
