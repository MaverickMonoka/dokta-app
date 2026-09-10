import * as React from 'react';
import { cn } from '../lib/cn';

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
  /** Hides the label visually but keeps it for screen readers. */
  hideLabel?: boolean;
}

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, hint, error, options, hideLabel, className, id, ...props }, ref) => {
    const generated = React.useId();
    const fieldId = id ?? generated;

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={fieldId}
          className={cn('block text-sm font-medium text-ink', hideLabel && 'sr-only')}
        >
          {label}
        </label>
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          className={cn(
            'h-11 w-full rounded-control border bg-white px-3 text-[0.9375rem]',
            error ? 'border-alert' : 'border-hairline',
            className,
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error ? (
          <p className="text-meta text-alert">{error}</p>
        ) : hint ? (
          <p className="text-meta text-muted">{hint}</p>
        ) : null}
      </div>
    );
  },
);
SelectField.displayName = 'SelectField';

export const TextArea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }
>(({ label, hint, className, id, ...props }, ref) => {
  const generated = React.useId();
  const fieldId = id ?? generated;

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        ref={ref}
        id={fieldId}
        className={cn(
          'w-full rounded-control border border-hairline bg-white px-3 py-2.5 text-[0.9375rem] leading-relaxed placeholder:text-muted',
          className,
        )}
        {...props}
      />
      {hint && <p className="text-meta text-muted">{hint}</p>}
    </div>
  );
});
TextArea.displayName = 'TextArea';
