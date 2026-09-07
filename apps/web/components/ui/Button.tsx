import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 active:scale-[0.98] cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-brand-blue text-white border border-white/10 hover:bg-brand-blue-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90",
        outline:
          "border border-border-subtle bg-surface-card text-ink-dark shadow-xs hover:bg-surface-bone",
        secondary:
          "bg-surface-card text-ink-dark border border-border-subtle hover:bg-surface-bone shadow-xs",
        ghost: "hover:bg-surface-bone hover:text-ink-dark text-ink-secondary",
        link: "text-brand-blue underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-5 py-3 has-[>svg]:px-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-xl px-8 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
