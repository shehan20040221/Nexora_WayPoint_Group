import { MapPin } from 'lucide-react';

/** Text-based Waypoint wordmark (the design's logo asset was not supplied as a file). */
export function Logo({ sub = 'GROUP', size = 'md' }: { sub?: string; size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  return (
    <div className="leading-none">
      <div className={`flex items-center font-extrabold tracking-tight text-navy ${big ? 'text-3xl' : 'text-xl'}`}>
        WAYP<span className="relative -mx-[1px] inline-grid place-items-center"><MapPin size={big ? 28 : 21} className="fill-ok text-ok" strokeWidth={0} /><span className="absolute top-[22%] h-1.5 w-1.5 rounded-full bg-white" /></span>INT
      </div>
      <div className={`mt-0.5 text-center font-semibold tracking-[0.3em] text-ok ${big ? 'text-[10px]' : 'text-[8px]'}`}>{sub}</div>
    </div>
  );
}
