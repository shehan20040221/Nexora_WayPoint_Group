import { useOffline } from './useOffline';
import { dismissConflict, flush } from './sync';
import { setSimulateOffline } from './network';

export function SyncChip() {
  const s = useOffline();
  const base = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold';
  if (!s.online)
    return (
      <span className={`${base} border-red-200 bg-[#FDE8E3] text-[#B93815]`}>
        <i className="h-2 w-2 rounded-full bg-[#B93815]" />
        Offline{s.pending ? ` · ${s.pending} saved` : ''}
      </span>
    );
  if (s.syncing || s.pending)
    return (
      <span className={`${base} border-orange-200 bg-[#FFF0E8] text-[#C2501B]`}>
        <i className="h-2 w-2 animate-pulse rounded-full bg-[#FF8D56]" />
        Syncing {s.pending}…
      </span>
    );
  const t = s.lastSyncedAt ? new Date(s.lastSyncedAt).toTimeString().slice(0, 5) : null;
  return (
    <span className={`${base} border-emerald-200 bg-[#E6F4EE] text-[#157A5A]`}>
      <i className="h-2 w-2 rounded-full bg-[#1B8A6B]" />
      {t ? `Synced · ${t}` : 'Online'}
    </span>
  );
}

export function SimulateOfflineToggle() {
  const s = useOffline();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={s.simulate}
      onClick={() => setSimulateOffline(!s.simulate)}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
    >
      <span
        className={`relative h-4 w-7 rounded-full transition ${s.simulate ? 'bg-[#FF8D56]' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${s.simulate ? 'left-3.5' : 'left-0.5'}`}
        />
      </span>
      Simulate offline
    </button>
  );
}

export function SyncBanner() {
  const s = useOffline();
  return (
    <div className="space-y-2">
      {!s.online && (
        <div className="rounded-2xl border border-red-200 bg-[#FDE8E3] px-4 py-3 text-sm text-[#8F2A0F]">
          <b>You're offline.</b> {s.pending} change{s.pending === 1 ? '' : 's'} saved on this phone. Keep
          working; everything sends automatically when the connection returns.
        </div>
      )}
      {s.online && s.pending > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-[#FFF0E8] px-4 py-3 text-sm text-[#8F3A12]">
          <span>
            {s.syncing ? 'Syncing' : 'Waiting to sync'} {s.pending} saved change{s.pending === 1 ? '' : 's'}…
            {s.lastError && !s.syncing ? ' Will retry shortly.' : ''}
          </span>
          {!s.syncing && (
            <button className="font-semibold underline" onClick={() => void flush()}>
              Retry now
            </button>
          )}
        </div>
      )}
      {s.conflicts.map((c) => (
        <div
          key={c.opId}
          className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-[#FDE8E3] px-4 py-3 text-sm text-[#8F2A0F]"
        >
          <span>
            <b>Needs review:</b> a {c.type} record was not accepted. {c.message}
          </span>
          <button className="font-semibold underline" onClick={() => void dismissConflict(c.opId)}>
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
