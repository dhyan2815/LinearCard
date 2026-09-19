import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card"
      className={cn(
        "bg-surface-card border border-border-subtle rounded-2xl shadow-sm overflow-hidden",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

export { Card }
