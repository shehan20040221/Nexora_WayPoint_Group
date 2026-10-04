import { ReactNode } from 'react';
import { TopBar, Sidebar, BottomNav } from '@/ui';
import { DISPATCHER_NAV, DRIVER_NAV, LOADER_NAV } from './navConfig';

/** Store: header only. Tabs live in <StorePage> because the design puts them under the page title. */
export function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6">
        <TopBar sub="FRESH" shift="Shift 06:00–14:00" />
        <main>{children}</main>
      </div>
    </div>
  );
}

/** Dispatcher: large-screen workspace with a left sidebar. */
export function DispatcherLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-6">
        <TopBar sub="DISPATCH · PELIYAGODA" />
        <div className="flex gap-6">
          <Sidebar items={DISPATCHER_NAV} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}

/** Loader: shared tablet/terminal, also works on a phone (bottom nav under lg). */
export function LoaderLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full pb-20 lg:pb-8">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <TopBar sub="LOADING DOCK" compact />
        <div className="flex gap-6"><Sidebar items={LOADER_NAV} /><main className="min-w-0 flex-1">{children}</main></div>
      </div>
      <BottomNav items={LOADER_NAV} />
    </div>
  );
}

/** Driver: phone-first, single column, bottom navigation. */
export function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full pb-24">
      <div className="mx-auto max-w-xl px-4"><TopBar sub="DRIVER" compact /><main>{children}</main></div>
      <BottomNav items={DRIVER_NAV} />
    </div>
  );
}
