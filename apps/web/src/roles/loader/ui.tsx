import { ButtonHTMLAttributes, ReactNode } from 'react';

// Local primitives so Person D is not blocked on C's shared ui/. Swap for apps/web/src/ui later.
export type Tone = 'neutral' | 'orange' | 'green' | 'blue' | 'red';

const chip: Record<Tone, string> = {
  neutral: 'bg-white text-slate-700 border-slate-200',
  orange: 'bg-[#FFF0E8] text-[#C2501B] border-[#FFD3BD]',
  green: 'bg-[#E6F4EE] text-[#157A5A] border-[#BFE3D3]',
  blue: 'bg-[#E8F1FD] text-[#1F63B5] border-[#C5DCF7]',
  red: 'bg-[#FDE8E3] text-[#B93815] border-[#F7C6B8]',
};
const card: Record<Tone, string> = {
  neutral: 'bg-white border-slate-200',
  orange: 'bg-[#FFF3EC] border-[#FFD3BD]',
  green: 'bg-[#EAF6F0] border-[#BFE3D3]',
  blue: 'bg-[#EAF2FD] border-[#C5DCF7]',
  red: 'bg-[#FDECE7] border-[#F7C6B8]',
};

export const Page = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-[#FDFBF0] font-[Poppins,sans-serif] text-[#0F1B2D]">{children}</div>
);

export const Chip = ({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${chip[tone]} ${className}`}>
    {children}
  </span>
);

export const Card = ({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl border p-4 ${card[tone]} ${className}`}>{children}</div>
);

export const Kpi = ({ label, value, sub, tone = 'neutral' }: { label: string; value: ReactNode; sub?: string; tone?: Tone }) => (
  <Card tone={tone}>
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-1 text-2xl font-semibold">{value}</div>
    {sub && <div className="text-xs text-slate-500">{sub}</div>}
  </Card>
);

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'dark' | 'ghost' | 'danger' };
const btn = {
  primary: 'bg-[#FF8D56] text-white hover:bg-[#F27A3F]',
  dark: 'bg-[#0F1B2D] text-white hover:bg-[#0B3457]',
  ghost: 'bg-white text-[#0F1B2D] border border-slate-300 hover:bg-slate-50',
  danger: 'bg-white text-[#B93815] border border-[#F7C6B8] hover:bg-[#FDECE7]',
};
export const Btn = ({ variant = 'dark', className = '', ...p }: BtnProps) => (
  <button
    {...p}
    className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${btn[variant]} ${className}`}
  />
);
