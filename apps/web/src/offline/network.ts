// Network state with a "Simulate offline" override used for demos and the judge walkthrough.
const KEY = 'wp.simulateOffline';
const hasWindow = typeof window !== 'undefined';
let simulate = hasWindow && localStorage.getItem(KEY) === '1';
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const subscribeNetwork = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
export const isSimulatingOffline = () => simulate;
export const isOnline = () => !simulate && (!hasWindow || navigator.onLine);
export function setSimulateOffline(v: boolean) {
  simulate = v;
  if (hasWindow) localStorage.setItem(KEY, v ? '1' : '0');
  emit();
}
if (hasWindow) {
  window.addEventListener('online', emit);
  window.addEventListener('offline', emit);
}
