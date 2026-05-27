import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex w-fit items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,border-color] duration-150 ease-out cursor-pointer disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 [&_svg]:block outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_0_rgba(0,0,0,0.04)] hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-[rgba(0,0,0,0.1)] bg-background shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-[rgba(0,0,0,0.04)] hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        lavender:
          "bg-purple-50 border border-[#3C2EC5] text-[#3C2EC5] hover:bg-[#3c2ec5]/90 hover:text-white dark:bg-purple-950/30 dark:border-[#3C2EC5] dark:text-[#3C2EC5] dark:hover:bg-[#3c2ec5]/90 dark:hover:text-white",
        neutral:
          "bg-[rgba(0,0,0,0.05)] border border-[rgba(0,0,0,0.1)] text-foreground hover:bg-[rgba(0,0,0,0.08)] dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10",
      },
      size: {
        default: "h-8 px-[14px] py-2 has-[>svg]:px-[14px]",
        sm: "h-8 px-[14px] has-[>svg]:px-[14px]",
        lg: "h-10 px-[14px] has-[>svg]:px-[14px]",
        icon: "size-8",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    compoundVariants: [
      {
        variant: "outline",
        size: "default",
        className: "py-2 px-3 has-[>svg]:px-3",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
