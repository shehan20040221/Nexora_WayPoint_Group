import { Link, Route, Routes } from 'react-router-dom';
import { SimulateOfflineToggle, SyncBanner, SyncChip } from '../../offline';
import AssignedTrips from './AssignedTrips';
import ActiveLoading from './ActiveLoading';
import StalePlan from './StalePlan';
import { Page } from './ui';

/** Mount at `/loader/*`. Person C's per-role layout can wrap this; the header below is a stand-in. */
export function LoaderRoutes() {
  return (
    <Page>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#FDFBF0] px-4 py-3 md:px-6">
        <Link to="/loader" className="text-lg font-extrabold tracking-tight text-[#0B3457]">WAYPOINT <span className="text-xs font-semibold text-slate-500">Loader</span></Link>
        <div className="flex items-center gap-2"><SimulateOfflineToggle /><SyncChip /></div>
      </header>
      <div className="px-4 pt-3 md:px-6"><SyncBanner /></div>
      <Routes>
        <Route index element={<AssignedTrips />} />
        <Route path="trip/:id" element={<ActiveLoading />} />
        <Route path="trip/:id/stale" element={<StalePlan />} />
      </Routes>
    </Page>
  );
}
export default LoaderRoutes;
