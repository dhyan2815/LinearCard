import * as React from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

// One header for every dashboard page: h1 + optional description, with the
// divider that used to be copy-pasted (with three different bottom margins).
export function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "border-b border-border-subtle pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4",
        className
      )}
      {...props}
    >
      <div>
        <h1 className="text-2xl font-semibold text-ink-dark tracking-tight">{title}</h1>
        {description && <p className="text-sm text-ink-secondary mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">{actions}</div>}
    </div>
  )
}
