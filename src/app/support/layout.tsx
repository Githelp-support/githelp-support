"use client"

import type React from "react"

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Chain the support shell into the root layout's flex column instead of
  // forcing an additional `min-h-screen` (100vh) container. The root layout
  // already renders a sticky TopBar above this subtree inside a
  // `flex flex-col min-h-full` wrapper; using `min-h-screen` here used to
  // stack a second full-viewport container BELOW that TopBar, which both
  // caused the body to scroll by the TopBar's height AND left a strip of
  // blank space at the bottom of the screen on the support landing page
  // (because the page's own `h-[calc(100dvh-61px)]` math assumed a fixed
  // TopBar height that does not hold for the Incognito visitor — the project
  // dropdown is not rendered for the "user" role, so the TopBar is shorter
  // than 61px).
  //
  // Using `flex-1 min-h-0 flex flex-col` makes this shell fill exactly the
  // viewport area BELOW the TopBar, regardless of the TopBar's actual height.
  // `main` is also turned into a flex column so child pages can use
  // `flex-1 min-h-0` (or `h-full`) to take all remaining vertical space
  // without any blank space at the bottom.
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <main className="flex-1 min-h-0 bg-bg-subtle flex flex-col">{children}</main>
    </div>
  )
}
