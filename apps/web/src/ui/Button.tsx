import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'outline' | 'dark' | 'ghost' | 'danger';
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode; block?: boolean; loading?: boolean;
}
const V: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-brand/50',
  outline: 'border border-brand-line bg-white text-ink hover:bg-brand-tint',
  dark: 'bg-ink text-white hover:bg-night disabled:bg-ink/50',
  ghost: 'text-ink hover:bg-black/5',
  danger: 'bg-bad text-white hover:opacity-90 disabled:opacity-50',
};
const S = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3.5 text-sm' };

export function Button({ variant = 'primary', size = 'md', icon, block, loading, className, children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed', V[variant], S[size], block && 'w-full', className)}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      {children}
    </button>
  );
}
