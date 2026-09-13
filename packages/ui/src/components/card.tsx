import * as React from 'react';
import { cn } from '../lib/cn';

export function Card({
  className,
  tone = 'light',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: 'light' | 'navy' }) {
  return (
    <div
      className={cn(
        'rounded-card',
        tone === 'light'
          ? 'border border-hairline bg-white shadow-raise'
          : 'on-navy bg-navy-raised text-white shadow-panel',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-start justify-between gap-3 p-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-display text-[0.9375rem] font-semibold', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />;
}
