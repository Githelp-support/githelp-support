"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Menu, X } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Below `lg` the sidebar is an off-canvas sheet. The TopBar renders the menu
 * button (`MobileNavToggle`); whoever owns a sidebar for the current page
 * (AppShell, the public support page) renders `MobileSidebarSheet` with that
 * sidebar inside. The sheet is a Radix Dialog, so it traps focus, closes on
 * Esc and on backdrop click; it also closes on navigation.
 */

interface MobileNavContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  /** True while a sheet is mounted for the current page. */
  hasNav: boolean
  setHasNav: (has: boolean) => void
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null)

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [hasNav, setHasNav] = useState(false)
  const value = useMemo(() => ({ open, setOpen, hasNav, setHasNav }), [open, hasNav])
  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext)
  return ctx ?? { open: false, setOpen: () => {}, hasNav: false, setHasNav: () => {} }
}

/** The hamburger in the TopBar. Hidden on lg+ and when no sheet is registered. */
export function MobileNavToggle({ className }: { className?: string }) {
  const { open, setOpen, hasNav } = useMobileNav()
  if (!hasNav) return null
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Open menu"
      aria-expanded={open}
      className={cn("lg:hidden -ml-2 text-text-muted hover:text-foreground", className)}
      onClick={() => setOpen(!open)}
    >
      <Menu className="size-5" aria-hidden />
    </Button>
  )
}

export function MobileSidebarSheet({ children, label = "Menu" }: { children: ReactNode; label?: string }) {
  const { open, setOpen, setHasNav } = useMobileNav()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ""

  // Tell the TopBar there is a menu to open on this page.
  useEffect(() => {
    setHasNav(true)
    return () => setHasNav(false)
  }, [setHasNav])

  // Close on navigation (the sidebar links navigate; the sheet should get out of the way).
  useEffect(() => {
    setOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 lg:hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-fast" />
        <DialogPrimitive.Content
          aria-label={label}
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-modal outline-none lg:hidden data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left duration-slow ease-out"
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close menu"
              className="absolute right-2 top-3 z-10 text-text-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </Button>
          </DialogPrimitive.Close>
          {/* The sidebar fills the sheet; it stretches as a flex item like it does in the shell row. */}
          <div className="flex min-h-0 flex-1 flex-col [&>*]:flex-1 [&>*]:w-full [&>*]:border-r-0">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
