import * as React from 'react';
import { cn } from '../lib/cn';

/**
 * A single figure with its label. Deliberately plain: on a clinical dashboard
 * the number is the content, and decoration around it slows reading.
 */
export function Stat({
  label,
  value,
  delta,
  hint,
  tone = 'light',
  className,
}: {
  label: string;
  value: string | number;
  delta?: { value: string; direction: 'up' | 'down' };
  hint?: string;
  tone?: 'light' | 'navy';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-card p-4',
        tone === 'light' ? 'border border-hairline bg-white' : 'bg-white/5 ring-1 ring-white/10',
        className,
      )}
    >
      <p className={cn('text-meta', tone === 'light' ? 'text-muted' : 'text-white/60')}>{label}</p>
      <p
        className={cn(
          'money mt-1 font-display text-[1.75rem] font-bold leading-none',
          tone === 'light' ? 'text-ink' : 'text-white',
        )}
      >
        {value}
      </p>
      {(delta || hint) && (
        <p className="mt-2 flex items-center gap-2 text-meta">
          {delta && (
            <span className={delta.direction === 'up' ? 'text-care' : 'text-alert'}>
              {delta.direction === 'up' ? '↑' : '↓'} {delta.value}
            </span>
          )}
          {hint && <span className={tone === 'light' ? 'text-muted' : 'text-white/50'}>{hint}</span>}
        </p>
      )}
    </div>
  );
}
