import { useEffect, useState } from 'react';
import { flushQueue, getQueue, Queued } from './postQueue';

export function useStoreQueue(onFlushed?: () => void) {
  const [q, setQ] = useState<Queued[]>(getQueue());
  useEffect(() => {
    const upd = () => setQ(getQueue());
    const tryFlush = async () => { const n = await flushQueue(); if (n && onFlushed) onFlushed(); upd(); };
    window.addEventListener('wp-queue', upd); window.addEventListener('online', tryFlush);
    tryFlush();
    const t = setInterval(tryFlush, 8000);
    return () => { window.removeEventListener('wp-queue', upd); window.removeEventListener('online', tryFlush); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return q;
}
