import * as React from 'react';
import { cn } from '../lib/cn';

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, hint, error, hideLabel, className, id, ...props }, ref) => {
    const generated = React.useId();
    const fieldId = id ?? generated;
    const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

    return (
      <div className="space-y-1.5">
        <label htmlFor={fieldId} className={cn("block text-sm font-medium text-ink", hideLabel && "sr-only")}>
          {label}
        </label>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(
            'h-11 w-full rounded-control border bg-white px-3 text-[0.9375rem] placeholder:text-muted',
            error ? 'border-alert' : 'border-hairline',
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={`${fieldId}-error`} className="text-meta text-alert">
            {error}
          </p>
        ) : hint ? (
          <p id={`${fieldId}-hint`} className="text-meta text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Field.displayName = 'Field';
