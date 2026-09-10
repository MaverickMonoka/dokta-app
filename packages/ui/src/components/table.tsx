import * as React from 'react';
import { cn } from '../lib/cn';

export interface Column<T> {
  key: string;
  header: string;
  /** Right-aligns and applies tabular figures. Use for every money and count column. */
  numeric?: boolean;
  width?: string;
  render: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  if (rows.length === 0) return <>{empty}</>;

  return (
    <div className={cn('overflow-x-auto rounded-card border border-hairline bg-white', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  'px-4 py-3 text-meta font-medium text-muted',
                  col.numeric ? 'text-right' : 'text-left',
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-hairline last:border-0',
                onRowClick && 'cursor-pointer hover:bg-canvas',
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn('px-4 py-3 align-middle', col.numeric && 'money text-right')}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
