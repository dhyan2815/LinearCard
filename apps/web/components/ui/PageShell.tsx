import * as React from "react"
import { cn } from "@/lib/utils"

// The one content width every dashboard page shares. See task-1B-brief.md
// (Shared layout primitives) — settles five different max-widths into one.
export function PageShell({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("max-w-6xl mx-auto space-y-6", className)} {...props}>
      {children}
    </div>
  )
}
