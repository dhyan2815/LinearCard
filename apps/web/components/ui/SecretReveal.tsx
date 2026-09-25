"use client"
import * as React from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "./Button"
import { Alert } from "./Alert"

interface SecretRevealProps {
  label: string
  secret: string
  onDone: () => void
}

// Shared "show once" panel for API keys and webhook secrets. Caller is
// responsible for not persisting `secret` anywhere after onDone() fires.
export function SecretReveal({ label, secret, onDone }: SecretRevealProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore clipboard failures, value is still visible/selectable
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-bone p-4">
      <Alert variant="warning">
        {label} — copy it now. You will not be able to see it again.
      </Alert>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-xs font-mono text-ink-dark break-all">
          {secret}
        </code>
        <Button type="button" variant="secondary" size="sm" onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <Button type="button" onClick={onDone} className="w-full">
        Done, I've saved it
      </Button>
    </div>
  )
}
