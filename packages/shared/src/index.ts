// Shared enums and (from Day 4) Zod schemas used by both API and web.
export const ROLES = ['dispatcher', 'loader', 'driver', 'store'] as const;
export type Role = (typeof ROLES)[number];
export const REASON_CODES = ['NO_REEFER_CAPACITY', 'VOLUME_WEIGHT_LIMIT', 'TIME_BUDGET', 'FUEL_QUOTA', 'MALL_WINDOW', 'NO_VAN', 'VEHICLE_IN_WORKSHOP', 'OTHER'] as const;
export type ReasonCode = (typeof REASON_CODES)[number];
