import React, { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(
          "w-full bg-surface-card border border-border-subtle rounded-xl px-4 py-3 text-ink-dark text-sm transition-all focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange placeholder:text-ink-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
