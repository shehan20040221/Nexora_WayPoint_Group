// Mirrors CONTRACT section 3 of the build guide. Do not diverge without a CONTRACT.md PR.
export type Role = 'dispatcher' | 'loader' | 'driver' | 'store';
export type Temp = 'chilled' | 'ambient';
export type Brand = 'Fresh' | 'Style' | 'Tech';
export type OrderStatus =
  | 'confirmed' | 'planned' | 'loading' | 'loaded' | 'in_transit' | 'delivered'
  | 'partial' | 'unable' | 'deferred' | 'received' | 'issue';
export type ReasonCode =
  | 'NO_REEFER_CAPACITY' | 'VOLUME_WEIGHT_LIMIT' | 'TIME_BUDGET' | 'FUEL_QUOTA'
  | 'MALL_WINDOW' | 'NO_VAN' | 'VEHICLE_IN_WORKSHOP' | 'OTHER';

export interface User {
  email: string; role: Role; name: string; outletId?: string; vehicleId?: string;
}
export interface Order {
  id: string; ref: string; outletId: string; outletName: string;
  brand: Brand; district: string; depot: string; temp: Temp;
  units: number; weightKg: number; volumeM3: number;
  status: OrderStatus; orderDate: string; windowOpen: string; windowClose: string;
  deferredYesterday: boolean; daysSinceLastServed: number;
  tripId?: string; vehicleId?: string; seq?: number; etaPlanned?: string;
  deferralReason?: ReasonCode; deferralNote?: string;
}
export interface TimelineStep { label: string; time: string | null; done: boolean }
export type OrderDetail = Order & { timeline: TimelineStep[]; lines?: { sku: string; name: string; qty: number; weightKg: number; handling: string }[] };
export interface Product { id: string; name: string; sku: string; temp: Temp; unit: string; weightKg: number; volumeM3: number; category?: string }
export interface Notification { id: string; type: string; title: string; body: string; createdAt: string }
