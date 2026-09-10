import * as React from 'react';
import { cn } from '../lib/cn';

const TONES = {
  neutral: 'bg-navy-50 text-navy',
  care: 'bg-care-soft text-care-dark',
  warn: 'bg-warn-soft text-warn',
  alert: 'bg-alert-soft text-alert',
  onNavy: 'bg-white/10 text-white',
} as const;

/** Maps a domain status straight to its tone, so statuses read the same everywhere. */
const STATUS_TONE: Record<string, keyof typeof TONES> = {
  CONFIRMED: 'care',
  COMPLETED: 'care',
  DELIVERED: 'care',
  PAID: 'care',
  SUCCEEDED: 'care',
  DISPENSED: 'care',
  REQUESTED: 'warn',
  PENDING: 'warn',
  AWAITING_PAYMENT: 'warn',
  PICKING: 'warn',
  READY_FOR_COLLECTION: 'warn',
  CANCELLED: 'alert',
  FAILED: 'alert',
  NO_SHOW: 'alert',
  REJECTED: 'alert',
};

export function Badge({
  tone,
  status,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof TONES;
  status?: string;
}) {
  const resolved = tone ?? (status ? STATUS_TONE[status] ?? 'neutral' : 'neutral');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-1 text-meta font-medium',
        TONES[resolved],
        className,
      )}
      {...props}
    >
      {children ?? status?.toLowerCase().replace(/_/g, ' ')}
    </span>
  );
}
