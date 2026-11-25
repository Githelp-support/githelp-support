"use client"

import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from "react"

/** How close to the bottom (px) the thread counts as "at the bottom". */
export const CHAT_AT_BOTTOM_THRESHOLD_PX = 48

/** Below `lg` the chat's side panels are sheets that cover the thread. */
const BELOW_LG_QUERY = "(max-width: 1023.98px)"

function isDocumentVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible"
}

function hasWindowFocus(): boolean {
  return typeof document === "undefined" || typeof document.hasFocus !== "function" || document.hasFocus()
}

function isBelowLg(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.(BELOW_LG_QUERY)?.matches
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

function subscribeBelowLg(onChange: () => void) {
  const mql = window.matchMedia?.(BELOW_LG_QUERY)
  if (!mql || typeof mql.addEventListener !== "function") return () => {}
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/**
 * Whether the reader can actually see the newest message of a chat thread:
 * the tab is visible, the window has focus, the thread is scrolled to (within
 * ~48px of) the bottom or the end sentinel is in view, and no mobile sheet
 * covers the chat. Used to decide when to mark a ticket read.
 *
 * - `scrollRef`: the thread's scroll container (`data-slot="chat-scroll"`).
 * - `endRef`: the sentinel after the last message (observed with an
 *   IntersectionObserver rooted at the scroll container).
 * - `coveredBySheet`: a sheet is open over the chat (only counts below `lg`,
 *   where the panels are overlays).
 * - `contentKey`: changes when the thread changes (e.g. message count), so
 *   the bottom check is re-measured after new rows render.
 */
export function useChatReadVisibility({
  scrollRef,
  endRef,
  coveredBySheet = false,
  contentKey,
}: {
  scrollRef: RefObject<HTMLElement | null>
  endRef: RefObject<HTMLElement | null>
  coveredBySheet?: boolean
  contentKey?: unknown
}): boolean {
  const docVisible = useSyncExternalStore(subscribeVisibility, isDocumentVisible, () => false)
  const belowLg = useSyncExternalStore(subscribeBelowLg, isBelowLg, () => false)
  // Focus follows the focus/blur events (hasFocus() can lag inside a blur handler).
  const [focused, setFocused] = useState(hasWindowFocus)
  const [atBottom, setAtBottom] = useState(false)
  const [endInView, setEndInView] = useState(false)

  useEffect(() => {
    const onFocus = () => setFocused(true)
    const onBlur = () => setFocused(false)
    window.addEventListener("focus", onFocus)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("blur", onBlur)
    }
  }, [])

  const measure = useCallback(() => {
    const box = scrollRef.current
    if (!box) return
    const distance = box.scrollHeight - box.scrollTop - box.clientHeight
    setAtBottom(distance <= CHAT_AT_BOTTOM_THRESHOLD_PX)
  }, [scrollRef])

  useEffect(() => {
    const box = scrollRef.current
    if (!box) return
    measure()
    box.addEventListener("scroll", measure, { passive: true })
    return () => box.removeEventListener("scroll", measure)
    // contentKey: the container may mount after a loading state.
  }, [scrollRef, measure, contentKey])

  // New rows (or the opening jump to the bottom) change the geometry without
  // a scroll event; measure again once they have rendered.
  useEffect(() => {
    measure()
    if (typeof requestAnimationFrame !== "function") return
    const id = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(id)
  }, [contentKey, measure])

  useEffect(() => {
    const end = endRef.current
    if (!end || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) setEndInView(entry.isIntersecting)
      },
      { root: scrollRef.current, rootMargin: `0px 0px ${CHAT_AT_BOTTOM_THRESHOLD_PX}px 0px` },
    )
    observer.observe(end)
    return () => observer.disconnect()
  }, [scrollRef, endRef, contentKey])

  const hiddenBySheet = coveredBySheet && belowLg
  return docVisible && focused && (atBottom || endInView) && !hiddenBySheet
}
