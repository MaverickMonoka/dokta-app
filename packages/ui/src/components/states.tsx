import * as React from 'react';
import { cn } from '../lib/cn';
import { Button, buttonVariants } from './button';

/** An empty screen is an invitation to act — never a shrug. */
export function EmptyState({
  title,
  body,
  action,
  icon: Icon,
  className,
}: {
  title: string;
  body: string;
  action?: { label: string; href?: string; onClick?: () => void };
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-navy-50">
          <Icon className="h-5 w-5 text-navy" />
        </span>
      )}
      <h3 className="font-display text-title">{title}</h3>
      <p className="mt-1.5 max-w-prose text-sm text-muted">{body}</p>
      {action && (
        <div className="mt-5">
          {action.href ? (
            <a href={action.href} className={buttonVariants()}>
              {action.label}
            </a>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Errors say what happened and what to do. They do not apologise. */
export function ErrorState({
  title = 'That did not load',
  body,
  onRetry,
}: {
  title?: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-card border border-alert/30 bg-alert-soft p-5">
      <h3 className="font-display text-[0.9375rem] font-semibold text-alert">{title}</h3>
      <p className="mt-1 text-sm text-ink/80">{body}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-control bg-navy-100/70', className)} />;
}
