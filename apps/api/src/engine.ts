export type ReasonCode =
  | 'NO_REEFER_CAPACITY'
  | 'VOLUME_WEIGHT_LIMIT'
  | 'TIME_BUDGET'
  | 'FUEL_QUOTA'
  | 'MALL_WINDOW'
  | 'NO_VAN'
  | 'VEHICLE_IN_WORKSHOP'
  | 'OTHER';

export type OrderStatus =
  | 'confirmed' | 'planned' | 'loading' | 'loaded' | 'in_transit'
  | 'delivered' | 'partial' | 'unable' | 'deferred' | 'received' | 'issue';

export interface Order {
  id: string;
  ref: string;
  outletId: string;
  outletName: string;
  brand: 'Fresh' | 'Style' | 'Tech';
  district: string;
  depot: string;
  temp: 'chilled' | 'ambient';
  units: number;
  weightKg: number;
  volumeM3: number;
  status: OrderStatus;
  orderDate: string;
  windowOpen: string;
  windowClose: string;
  deferredYesterday: boolean;
  daysSinceLastServed: number;
  tripId?: string;
  vehicleId?: string;
  seq?: number;
  etaPlanned?: string;
  deferralReason?: ReasonCode;
  deferralNote?: string;
}

export interface Violation {
  rule: string;
  message: string;
}

export interface Trip {
  id: string;
  vehicleId: string;
  tripNo: 1 | 2;
  brand: string;
  district: string;
  orders: Order[];
  minutes: number;
  budgetMinutes: number;
  weightKg: number;
  volumeM3: number;
  violations: string[];
}

export interface Vehicle {
  id: string;
  type: string;
  temp: 'chilled' | 'ambient';
  weightCap: number;
  volumeCap: number;
  status: string;
  trips: Trip[];
}

export interface Plan {
  planId?: string;
  date?: string;
  status?: 'draft' | 'published';
  version?: number;
  vehicles: Vehicle[];
  unassigned: Order[];
  deferred: Order[];
  metrics: {
    utilisation: number;
    bindingResource: string;
  };
}

export interface PlanState {
  assignments: Record<string, { vehicleId: string; tripNo: 1 | 2 }>;
  deferred: Record<string, Deferral>;
}

export interface Deferral {
  reasonCode: ReasonCode;
  note?: string;
  option?: string;
}

export interface Context {
  orders: Order[];
  vehicles: Array<{
    id: string;
    type: string;
    temp: 'chilled' | 'ambient';
    weightCap: number;
    volumeCap: number;
    status: string;
  }>;
}

export function emptyState(): PlanState {
  return {
    assignments: {},
    deferred: {},
  };
}

export function evaluatePlan(ctx: Context, state: PlanState): Plan {
  const vehiclesMap = new Map<string, Vehicle>();
  for (const v of ctx.vehicles) {
    vehiclesMap.set(v.id, {
      id: v.id,
      type: v.type,
      temp: v.temp,
      weightCap: Number(v.weightCap || 0),
      volumeCap: Number(v.volumeCap || 0),
      status: v.status || 'available',
      trips: [
        {
          id: `${v.id}-T1`,
          vehicleId: v.id,
          tripNo: 1,
          brand: 'Fresh',
          district: 'Colombo',
          orders: [],
          minutes: 0,
          budgetMinutes: 270,
          weightKg: 0,
          volumeM3: 0,
          violations: [],
        },
        {
          id: `${v.id}-T2`,
          vehicleId: v.id,
          tripNo: 2,
          brand: 'Fresh',
          district: 'Colombo',
          orders: [],
          minutes: 0,
          budgetMinutes: 270,
          weightKg: 0,
          volumeM3: 0,
          violations: [],
        },
      ],
    });
  }

  const unassigned: Order[] = [];
  const deferred: Order[] = [];

  let totalAssignedVol = 0;
  let totalCapVol = 0;
  for (const v of vehiclesMap.values()) {
    if (v.status !== 'workshop') {
      totalCapVol += v.volumeCap * 2;
    }
  }

  for (const order of ctx.orders) {
    if (state.deferred[order.id]) {
      const def = state.deferred[order.id];
      deferred.push({
        ...order,
        status: 'deferred',
        deferralReason: def.reasonCode,
        deferralNote: def.note,
      });
      continue;
    }

    const asgn = state.assignments[order.id];
    if (asgn && vehiclesMap.has(asgn.vehicleId)) {
      const v = vehiclesMap.get(asgn.vehicleId)!;
      const trip = v.trips.find(t => t.tripNo === asgn.tripNo) || v.trips[0];
      const updatedOrder: Order = {
        ...order,
        tripId: trip.id,
        vehicleId: v.id,
        seq: trip.orders.length + 1,
        status: 'planned',
      };
      trip.orders.push(updatedOrder);
      trip.weightKg += Number(order.weightKg || 0);
      trip.volumeM3 += Number(order.volumeM3 || 0);
      totalAssignedVol += Number(order.volumeM3 || 0);

      // Validate constraints
      if (trip.volumeM3 > v.volumeCap && !trip.violations.includes('VOLUME_EXCEEDED')) {
        trip.violations.push(`Volume exceeds capacity (${trip.volumeM3.toFixed(1)} / ${v.volumeCap})`);
      }
      if (trip.weightKg > v.weightCap && !trip.violations.includes('WEIGHT_EXCEEDED')) {
        trip.violations.push(`Weight exceeds capacity (${trip.weightKg.toFixed(1)} / ${v.weightCap})`);
      }
      if (order.temp === 'chilled' && v.temp !== 'chilled' && !trip.violations.includes('TEMP_MISMATCH')) {
        trip.violations.push('Chilled order cannot be loaded onto ambient vehicle');
      }
    } else {
      unassigned.push({ ...order, status: 'confirmed' });
    }
  }

  const utilisation = totalCapVol > 0 ? Math.min(100, Math.round((totalAssignedVol / totalCapVol) * 100)) : 0;

  return {
    vehicles: Array.from(vehiclesMap.values()),
    unassigned,
    deferred,
    metrics: {
      utilisation,
      bindingResource: utilisation > 85 ? 'REEFER_VOLUME' : 'NONE',
    },
  };
}

export function allocate(ctx: Context): PlanState {
  const state = emptyState();
  const sortedOrders = [...ctx.orders].sort((a, b) => {
    // 1. Skipped yesterday gets highest priority
    if (a.deferredYesterday && !b.deferredYesterday) return -1;
    if (!a.deferredYesterday && b.deferredYesterday) return 1;
    // 2. Starvation / days since last served
    if ((b.daysSinceLastServed || 0) !== (a.daysSinceLastServed || 0)) {
      return (b.daysSinceLastServed || 0) - (a.daysSinceLastServed || 0);
    }
    // 3. Chilled orders first
    if (a.temp === 'chilled' && b.temp !== 'chilled') return -1;
    if (a.temp !== 'chilled' && b.temp === 'chilled') return 1;
    return 0;
  });

  const availableVehicles = ctx.vehicles.filter(v => v.status !== 'workshop');

  for (const order of sortedOrders) {
    let assigned = false;
    for (const v of availableVehicles) {
      if (order.temp === 'chilled' && v.temp !== 'chilled') continue;
      // Assign to vehicle Trip 1 if capacity allows
      state.assignments[order.id] = { vehicleId: v.id, tripNo: 1 };
      const testPlan = evaluatePlan(ctx, state);
      const assignedV = testPlan.vehicles.find(veh => veh.id === v.id);
      const trip = assignedV?.trips[0];
      if (trip && trip.violations.length === 0) {
        assigned = true;
        break;
      }
      // Try Trip 2
      state.assignments[order.id] = { vehicleId: v.id, tripNo: 2 };
      const testPlan2 = evaluatePlan(ctx, state);
      const assignedV2 = testPlan2.vehicles.find(veh => veh.id === v.id);
      const trip2 = assignedV2?.trips[1];
      if (trip2 && trip2.violations.length === 0) {
        assigned = true;
        break;
      }
      delete state.assignments[order.id];
    }
    if (!assigned && (order.deferredYesterday || (order.daysSinceLastServed || 0) > 2)) {
      // Starvation order that cannot fit
      state.deferred[order.id] = {
        reasonCode: order.temp === 'chilled' ? 'NO_REEFER_CAPACITY' : 'VOLUME_WEIGHT_LIMIT',
        note: 'Demand exceeds capacity for today',
      };
    }
  }

  return state;
}

export function assignOrder(
  ctx: Context,
  state: PlanState,
  orderId: string,
  vehicleId: string,
  tripNo: 1 | 2
): { ok: boolean; violations: Violation[]; state: PlanState } {
  delete state.deferred[orderId];
  const newState: PlanState = {
    assignments: { ...state.assignments, [orderId]: { vehicleId, tripNo } },
    deferred: { ...state.deferred },
  };

  const plan = evaluatePlan(ctx, newState);
  const v = plan.vehicles.find(veh => veh.id === vehicleId);
  const trip = v?.trips.find(t => t.tripNo === tripNo);
  const violations: Violation[] = (trip?.violations || []).map(msg => ({
    rule: 'CAPACITY_VIOLATION',
    message: msg,
  }));

  if (violations.length > 0) {
    return { ok: false, violations, state };
  }

  return { ok: true, violations: [], state: newState };
}

export function unassignOrder(state: PlanState, orderId: string): PlanState {
  const assignments = { ...state.assignments };
  delete assignments[orderId];
  return { ...state, assignments };
}

export function deferOrder(
  state: PlanState,
  orderId: string,
  deferral: Deferral
): PlanState {
  const assignments = { ...state.assignments };
  delete assignments[orderId];
  return {
    ...state,
    assignments,
    deferred: {
      ...state.deferred,
      [orderId]: deferral,
    },
  };
}
