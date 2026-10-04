import { ReactNode } from 'react';
import { cx } from './cx';

export interface Column<T> { key: string; header: string; render: (row: T) => ReactNode; className?: string }

export function Table<T>({ columns, rows, rowKey, onRowClick, empty = 'Nothing to show.' }: {
  columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; empty?: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-muted">
            {columns.map((c) => <th key={c.key} className={cx('px-3 py-2 font-medium', c.className)}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} onClick={onRowClick && (() => onRowClick(r))} className={cx('border-b border-gray-50 last:border-0', onRowClick && 'cursor-pointer hover:bg-brand-tint/60')}>
              {columns.map((c) => <td key={c.key} className={cx('px-3 py-3', c.className)}>{c.render(r)}</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-muted">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
