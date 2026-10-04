import { NavLink, Route, Routes } from 'react-router-dom';
import { SimulateOfflineToggle, SyncBanner, SyncChip } from '../../offline';
import { RunProvider, useRunCtx } from './useRun';
import StopList from './StopList';
import StopDetails from './StopDetails';
import DeliveryConfirmation from './DeliveryConfirmation';
import ReportProblem from './ReportProblem';
import { Page } from '../loader/ui';

function Shell() {
  const { run, nextStop } = useRunCtx();
  const next = nextStop?.id;
  const item = 'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-semibold';
  const cls = ({ isActive }: { isActive: boolean }) => `${item} ${isActive ? 'text-[#FF8D56]' : 'text-slate-500'}`;
  return (
    <Page>
      <div className="mx-auto max-w-xl pb-20">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-[#FDFBF0]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <div><div className="text-sm font-extrabold tracking-tight text-[#0B3457]">WAYPOINT Driver</div><div className="text-xs text-slate-500">{run ? `${run.route.id} · ${run.route.vehicleId}` : '…'}</div></div>
            <SyncChip />
          </div>
          <div className="mt-2"><SimulateOfflineToggle /></div>
        </header>
        <div className="px-4 pt-3"><SyncBanner /></div>
        <Routes>
          <Route index element={<StopList />} />
          <Route path="stop/:stopId" element={<StopDetails />} />
          <Route path="stop/:stopId/deliver" element={<DeliveryConfirmation />} />
          <Route path="stop/:stopId/problem" element={<ReportProblem />} />
        </Routes>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-xl">
          <NavLink end to="/driver" className={cls}><span aria-hidden>☰</span>Route</NavLink>
          <NavLink to={next ? `/driver/stop/${next}` : '/driver'} end className={cls}><span aria-hidden>📍</span>Current stop</NavLink>
          <NavLink to={next ? `/driver/stop/${next}/problem` : '/driver'} className={cls}><span aria-hidden>⚠</span>Problem</NavLink>
        </div>
      </nav>
    </Page>
  );
}

/** Mount at `/driver/*`. Phone-first: bottom navigation, large tap targets, works offline via ../../offline. */
export function DriverRoutes() {
  return (
    <RunProvider>
      <Shell />
    </RunProvider>
  );
}
export default DriverRoutes;
