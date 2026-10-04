import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

type T = { id: number; msg: string; tone: 'ok' | 'bad' };
const Ctx = createContext<(msg: string, tone?: 'ok' | 'bad') => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((msg: string, tone: 'ok' | 'bad' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, tone }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-lg">
            {t.tone === 'ok' ? <CheckCircle2 size={16} className="text-ok" /> : <AlertTriangle size={16} className="text-brand" />}{t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
