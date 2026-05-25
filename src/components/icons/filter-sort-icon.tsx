import { cn } from "@/lib/utils"

interface FilterSortIconProps {
  className?: string
}

/**
 * Neutral (unsorted) state indicator for sortable table column headers.
 * Two opposing arrows signal that the column can be sorted in either direction.
 */
export function FilterSortIcon({ className }: FilterSortIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path d="m3 16 4 4 4-4" />
      <path d="M7 20V4" />
      <path d="m21 8-4-4-4 4" />
      <path d="M17 4v16" />
    </svg>
  )
}
