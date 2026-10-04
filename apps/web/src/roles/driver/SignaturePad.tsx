import { useEffect, useRef, useState } from 'react';

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0B3457';
  }, []);

  const pt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const down = (e: React.PointerEvent) => {
    ref.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = ref.current!.getContext('2d')!;
    const [x, y] = pt(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext('2d')!;
    const [x, y] = pt(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setEmpty(false);
    onChange(ref.current!.toDataURL('image/png'));
  };
  const clear = () => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-2xl border border-dashed border-slate-300 bg-white">
        <canvas ref={ref} className="h-40 w-full touch-none rounded-2xl" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
        {empty && <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-400">Sign here with your finger</span>}
      </div>
      <button type="button" onClick={clear} className="mt-1 min-h-9 text-sm font-semibold text-[#C2501B]">Clear</button>
    </div>
  );
}
