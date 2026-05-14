import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface TabOption<T = string> {
  value: T
  label: string
}

interface TabSelectorProps<T = string> {
  options: TabOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function TabSelector<T = string>({ options, value, onChange, className }: TabSelectorProps<T>) {
  return (
    <div className={cn("inline-flex gap-1 bg-gray-100 rounded-md p-0.5", className)}>
      {options.map((option) => {
        const isSelected = value === option.value
        return (
          <Button
            key={String(option.value)}
            variant="ghost"
            size="sm"
            className={
              isSelected
                ? "text-foreground font-medium bg-background border border-border hover:bg-muted shadow-[0_0_7px_0_rgba(134,140,152,0.30)]"
                : "text-muted-foreground hover:text-muted-foreground hover:bg-muted bg-transparent font-normal"
            }
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}

