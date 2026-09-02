import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export const buttonVariants = {
  primary: "bg-brand-orange text-white border border-white/10 hover:bg-brand-orange-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] cursor-pointer",
  secondary: "bg-surface-card text-ink-dark border border-border-subtle hover:bg-surface-bone cursor-pointer"
};

export const buttonBaseClass = "font-medium rounded-xl px-5 py-3 inline-flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className, children, ...props }, ref) => {
    return (
      <button 
        ref={ref}
        className={clsx(buttonBaseClass, buttonVariants[variant], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
