'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Right-hand panel for detail and forms. Used instead of a route change when
 * the person needs to keep the list they came from in view — a pharmacist
 * checking a script against the queue, for instance.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: 'md' | 'lg';
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy-sunken/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex h-full w-full flex-col bg-white shadow-panel',
          width === 'lg' ? 'sm:w-[640px]' : 'sm:w-[460px]',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div>
            <h2 className="font-display text-title text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-meta text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && <div className="border-t border-hairline px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
