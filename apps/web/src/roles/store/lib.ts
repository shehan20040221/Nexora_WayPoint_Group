import type { Order } from '@/types';
import { fmtDate } from '@/lib/format';

export const ack = {
  get: (): string[] => { try { return JSON.parse(localStorage.getItem('waypoint.store.ack') || '[]'); } catch { return []; } },
  add: (id: string) => { try { localStorage.setItem('waypoint.store.ack', JSON.stringify([...ack.get(), id])); } catch { /* ignore */ } },
};
export const win = (o: Order) => `${o.windowOpen}–${o.windowClose}`;
export const eta = (o: Order) => (o.etaPlanned ? `${fmtDate(o.orderDate)} · ${o.etaPlanned}` : `${fmtDate(o.orderDate)} · ${win(o)}`);
export const awaitingReceipt = (o: Order) => o.status === 'delivered' || o.status === 'partial';
export const isActive = (o: Order) => !['received', 'issue'].includes(o.status);
export const REASON_TEXT: Record<string, string> = {
  NO_REEFER_CAPACITY: 'No refrigerated capacity was left on the run.',
  VOLUME_WEIGHT_LIMIT: 'The vehicles were full by volume or weight.',
  TIME_BUDGET: 'The route ran out of delivery time.',
  FUEL_QUOTA: 'The vehicle fuel quota was used up.',
  MALL_WINDOW: 'The mall delivery window could not be met.',
  NO_VAN: 'No van was available for your outlet.',
  VEHICLE_IN_WORKSHOP: 'Vehicles were in the workshop.',
  OTHER: 'Capacity was short on the run.',
};
