import { describe, it, expect } from 'vitest';
import { tripMinutes, validate, Order, Vehicle } from './index';
const d = { Gampaha: { outboundMin: 37, interStopMin: 9 }, Colombo: { outboundMin: 24, interStopMin: 8 } };
const a = { 'Fresh|rear_dock': 15, 'Fresh|street': 16 };
const o = (ref: string, p: Partial<Order> = {}): Order => ({ ref, outletId: 'OUT001', brand: 'Fresh', district: 'Gampaha', depot: 'Peliyagoda', temp: 'ambient', weight: 100, volume: 1, dock: 'rear_dock', parking: 'normal', ...p });
const reefer: Vehicle = { id: 'VEH001', type: 'truck', temp: 'reefer', weightCap: 5000, volumeCap: 30, depot: 'Peliyagoda' };
const dry: Vehicle = { ...reefer, id: 'VEH002', temp: 'ambient' };
describe('engine', () => {
  it('matches booklet example (101 min)', () => {
    expect(tripMinutes({ vehicleId: 'VEH001', tripNo: 1, orders: [o('a'), o('b'), o('c', { dock: 'street' })] }, d, a)).toBe(101);
  });
  it('matches booklet example (112 min, 4 street stops)', () => {
    const orders = [1, 2, 3, 4].map(i => o('s' + i, { district: 'Colombo', dock: 'street' }));
    expect(tripMinutes({ vehicleId: 'VEH001', tripNo: 2, orders }, d, a)).toBe(112);
  });
  it('accepts a valid trip', () => {
    expect(validate([{ vehicleId: 'VEH001', tripNo: 1, orders: [o('a', { temp: 'chilled' })] }], [reefer], d, a)).toEqual([]);
  });
  it('blocks chilled on ambient and van-only on truck', () => {
    const r = validate([{ vehicleId: 'VEH002', tripNo: 1, orders: [o('a', { temp: 'chilled', parking: 'van_only' })] }], [dry], d, a).map(x => x.rule);
    expect(r).toEqual(expect.arrayContaining(['REFRIGERATION', 'VAN_ACCESS']));
  });
  it('flags the 270-minute Fresh budget', () => {
    const big = (n: number) => Array.from({ length: n }, (_, i) => o(`x${n}${i}`, { dock: 'street' }));
    const r = validate([{ vehicleId: 'VEH001', tripNo: 1, orders: big(8) }, { vehicleId: 'VEH001', tripNo: 2, orders: big(7) }], [reefer], d, a);
    expect(r.some(x => x.rule === 'TIME_BUDGET')).toBe(true);
  });
});
