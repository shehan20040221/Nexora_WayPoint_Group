export const CUTOFF = '16:00'; // order cutoff, from the contract (dashboard.cutoff) and the brief (4 PM)

export function msUntilCutoff(now = new Date(), cutoff = CUTOFF): number {
  const [h, m] = cutoff.split(':').map(Number);
  const t = new Date(now); t.setHours(h, m, 0, 0);
  return t.getTime() - now.getTime();
}
export function fmtCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
export function fmtDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export const todayStr = () => new Date().toISOString().slice(0, 10);
export const tomorrowStr = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10);
export const num = (n: number, d = 0) => n.toLocaleString('en-GB', { maximumFractionDigits: d });
