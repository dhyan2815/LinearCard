import React, { LabelHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <label 
        ref={ref}
        className={clsx("block text-xs font-medium text-ink-secondary mb-2", className)}
        {...props}
      >
        {children}
      </label>
    );
  }
);
Label.displayName = "Label";
