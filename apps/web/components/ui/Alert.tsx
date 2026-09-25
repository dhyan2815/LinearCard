import * as React from "react"
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type AlertVariant = "success" | "warning" | "error" | "info"

const VARIANT_STYLES: Record<AlertVariant, string> = {
  success: "bg-success-surface border-success/20 text-success",
  warning: "bg-warning-surface border-warning/20 text-warning",
  error: "bg-destructive/10 border-destructive/20 text-destructive",
  info: "bg-info-surface border-info/20 text-info",
}

const VARIANT_ICONS: Record<AlertVariant, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
}

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
}

// The four banner styles that had drifted (rose/red/amber/destructive) settled
// into one component keyed off the token-layer success/warning/info/destructive colors.
export function Alert({ variant = "info", className, children, ...props }: AlertProps) {
  const Icon = VARIANT_ICONS[variant]
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-3 text-sm font-medium",
        VARIANT_STYLES[variant],
        className
      )}
      {...props}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
