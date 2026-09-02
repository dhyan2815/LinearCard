import React, { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={clsx("bg-canvas border border-border-subtle rounded-2xl shadow-sm overflow-hidden", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";
