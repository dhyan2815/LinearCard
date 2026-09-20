import * as React from 'react';
import { cn } from '@/lib/utils';

const DOT_TONE = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  neutral: 'bg-ink-muted',
  info: 'bg-brand-blue',
} as const;

const TEXT_TONE = {
  success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  danger: 'bg-red-500/10 text-red-500 border-red-500/20',
  neutral: 'bg-surface-bone text-ink-secondary border-border-subtle',
  info: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
} as const;

export type BadgeTone = keyof typeof DOT_TONE;

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({ tone = 'neutral', dot = true, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide uppercase border',
        TEXT_TONE[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('w-2 h-2 rounded-full shrink-0', DOT_TONE[tone])} />}
      {children}
    </span>
  );
}
