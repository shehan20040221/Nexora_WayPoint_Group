import { ReactNode } from 'react';
import { cx } from './cx';

export function Card({ title, subtitle, right, children, className, tint }: {
  title?: ReactNode; subtitle?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string; tint?: boolean;
}) {
  return (
    <section className={cx(tint ? 'wp-tint' : 'wp-card', 'p-5', className)}>
      {(title || right) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-lg font-medium leading-snug">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}
