import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          "w-full bg-surface-card border border-border-subtle rounded-xl px-4 py-3 text-ink-dark text-sm transition-all focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue placeholder:text-ink-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
