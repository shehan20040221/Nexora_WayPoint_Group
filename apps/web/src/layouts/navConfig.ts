import { ClipboardList, Gauge, ListChecks, MapPinned, PackageCheck, Route, TriangleAlert, Truck, Boxes, Pause } from 'lucide-react';
import type { NavItem } from '@/ui';

/**
 * Route map per role. Person B / D: your role's <Routes> must serve exactly these relative paths
 * (they are linked from here). Add more routes freely; just add them here if you want a nav entry.
 */
export const STORE_NAV: NavItem[] = [
  { to: '/store', label: 'Overview', end: true },
  { to: '/store/order', label: 'Place order' },
  { to: '/store/track', label: 'Track deliveries' },
  { to: '/store/receipts', label: 'Receipts' },
  { to: '/store/issues', label: 'Issues' },
];
export const DISPATCHER_NAV: NavItem[] = [
  { to: '/dispatcher', label: 'Overview', icon: Gauge, end: true },
  { to: '/dispatcher/orders', label: 'Order queue', icon: ClipboardList },
  { to: '/dispatcher/planning', label: 'Route planning', icon: Route },
  { to: '/dispatcher/deferrals', label: 'Deferrals', icon: Pause },
  { to: '/dispatcher/exceptions', label: 'Exceptions', icon: TriangleAlert },
];
export const LOADER_NAV: NavItem[] = [
  { to: '/loader', label: 'Assigned trips', icon: Boxes, end: true },
];
export const DRIVER_NAV: NavItem[] = [
  { to: '/driver', label: 'Stops', icon: ListChecks, end: true },
  { to: '/driver/route', label: 'Route', icon: MapPinned },
  { to: '/driver/done', label: 'Done', icon: PackageCheck },
];
export { Truck };
