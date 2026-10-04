import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { StatusChip } from '../../ui/StatusChip';
import { KpiTile } from '../../ui/KpiTile';

// --- Shared Types ---
interface Order {
  id: string;
  ref: string;
  outletId: string;
  outletName: string;
  brand: string;
  district: string;
  temp: 'chilled' | 'ambient';
  units: number;
  weightKg: number;
  volumeM3: number;
  status: string;
  deferredYesterday?: boolean;
  daysSinceLastServed?: number;
  vehicleId?: string;
  tripId?: string;
  deferralReason?: string;
}

interface Vehicle {
  id: string;
  type: string;
  temp: 'chilled' | 'ambient';
  weightCap: number;
  volumeCap: number;
  status: string;
  trips: Array<{
    id: string;
    tripNo: number;
    orders: Order[];
    weightKg: number;
    volumeM3: number;
    violations: string[];
  }>;
}

interface PlanData {
  planId: string;
  status: 'draft' | 'published';
  version: number;
  vehicles: Vehicle[];
  unassigned: Order[];
  deferred: Order[];
  metrics: { utilisation: number; bindingResource: string };
}

// --- 1. Overview Screen ---
function OverviewScreen() {
  const [stats, setStats] = useState({
    queue: 18,
    activeRoutes: 12,
    exceptions: 2,
    vehicles: 48,
    weightPct: 76,
    volumePct: 82,
    cutoff: '16:00',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B3457]">Dispatcher Overview</h1>
        <p className="text-sm text-gray-500">Peliyagoda Central Planning Hub • Cutoff {stats.cutoff}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiTile label="Orders in Queue" value={stats.queue} />
        <KpiTile label="Active Routes" value={stats.activeRoutes} />
        <KpiTile label="Open Exceptions" value={stats.exceptions} />
        <KpiTile label="Fleet Utilisation" value={`${stats.volumePct}%`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Capacity & Bottlenecks">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Fleet Volume Utilisation</span>
                <span className="font-semibold">{stats.volumePct}%</span>
              </div>
              <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                <div className="bg-[#FF8D56] h-2.5 rounded-full" style={{ width: `${stats.volumePct}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Fleet Weight Limit</span>
                <span className="font-semibold">{stats.weightPct}%</span>
              </div>
              <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                <div className="bg-[#0B3457] h-2.5 rounded-full" style={{ width: `${stats.weightPct}%` }}></div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Binding constraint: <strong>Chilled Reefer Capacity</strong> on high-demand festive days.
            </p>
          </div>
        </Card>

        <Card title="Quick Actions">
          <div className="space-y-3">
            <Link to="/dispatcher/planning">
              <Button variant="primary" className="w-full justify-center">Go to Route Planning & Suggestion</Button>
            </Link>
            <Link to="/dispatcher/orders">
              <Button variant="secondary" className="w-full justify-center">Review Confirmed Order Queue</Button>
            </Link>
            <Link to="/dispatcher/exceptions">
              <Button variant="secondary" className="w-full justify-center">View Dock Exceptions (2 Open)</Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

// --- 2. Order Queue Screen ---
function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/orders?date=2026-10-05')
      .then(res => res.json())
      .then(data => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#0B3457]">Order Queue</h1>
          <p className="text-sm text-gray-500">Confirmed orders pending delivery allocation</p>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading order queue...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600">
                  <th className="p-3">Ref</th>
                  <th className="p-3">Outlet</th>
                  <th className="p-3">Brand</th>
                  <th className="p-3">District</th>
                  <th className="p-3">Temp</th>
                  <th className="p-3">Volume</th>
                  <th className="p-3">Weight</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-gray-400">No orders currently in queue.</td>
                  </tr>
                ) : (
                  orders.map(o => (
                    <tr key={o.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-semibold">{o.ref}</td>
                      <td className="p-3">{o.outletName}</td>
                      <td className="p-3">{o.brand}</td>
                      <td className="p-3">{o.district}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${o.temp === 'chilled' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>
                          {o.temp}
                        </span>
                      </td>
                      <td className="p-3">{o.volumeM3} m³</td>
                      <td className="p-3">{o.weightKg} kg</td>
                      <td className="p-3"><StatusChip status={o.status as any} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// --- 3. Route Planning Screen ---
function PlanningScreen() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadPlan = () => {
    setLoading(true);
    fetch('/api/plan?date=2026-10-05')
      .then(res => res.json())
      .then(data => {
        setPlan(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadPlan();
  }, []);

  const handleSuggest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/plan/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2026-10-05' }),
      });
      const data = await res.json();
      setPlan(data);
      setMsg({ type: 'ok', text: 'Plan suggested successfully using allocation engine.' });
    } catch (e: any) {
      setMsg({ type: 'err', text: 'Failed to suggest plan.' });
    }
    setLoading(false);
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/plan/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setMsg({ type: 'ok', text: `Plan published! Version: ${data.version}. Loading lines & Driver runs created.` });
      loadPlan();
    } catch {
      setMsg({ type: 'err', text: 'Failed to publish plan.' });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#0B3457]">Route Planning & Allocation</h1>
          <p className="text-sm text-gray-500">Status: {plan?.status?.toUpperCase() || 'DRAFT'} • Version: {plan?.version || 1}</p>
        </div>
        <div className="space-x-3">
          <Button variant="secondary" onClick={handleSuggest} disabled={loading}>
            {loading ? 'Calculating...' : 'Suggest Plan'}
          </Button>
          <Button variant="primary" onClick={handlePublish} disabled={loading}>
            Publish Plan
          </Button>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded text-sm ${msg.type === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <h2 className="font-bold text-lg text-gray-800">Assigned Fleet Vehicles</h2>
          {plan?.vehicles?.slice(0, 5).map(v => (
            <Card key={v.id} title={`${v.id} (${v.type.toUpperCase()} • ${v.temp.toUpperCase()})`}>
              <div className="space-y-3">
                {v.trips.map(t => (
                  <div key={t.id} className="border p-3 rounded bg-gray-50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-sm">Trip {t.tripNo}: {t.orders.length} Orders</span>
                      <span className="text-xs text-gray-500">{t.volumeM3.toFixed(1)} / {v.volumeCap} m³ • {t.weightKg.toFixed(0)} / {v.weightCap} kg</span>
                    </div>
                    {t.violations.length > 0 && (
                      <div className="p-2 bg-red-50 text-red-700 text-xs rounded mb-2">
                        {t.violations.join(', ')}
                      </div>
                    )}
                    <div className="text-xs space-y-1">
                      {t.orders.map(o => (
                        <div key={o.id} className="flex justify-between text-gray-600">
                          <span>{o.ref} - {o.outletName}</span>
                          <span>{o.volumeM3} m³</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card title="Unassigned Orders">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {plan?.unassigned?.length === 0 ? (
                <p className="text-xs text-gray-400">All orders allocated.</p>
              ) : (
                plan?.unassigned?.map(o => (
                  <div key={o.id} className="border p-2 rounded text-xs">
                    <div className="font-semibold">{o.ref} • {o.outletName}</div>
                    <div className="text-gray-500">{o.temp} • {o.volumeM3} m³</div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- 4. Deferrals Screen ---
function DeferralsScreen() {
  const [deferred, setDeferred] = useState<Order[]>([]);

  useEffect(() => {
    fetch('/api/plan?date=2026-10-05')
      .then(res => res.json())
      .then(data => {
        setDeferred(data.deferred || []);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B3457]">Deferrals & Capacity Degradation</h1>
        <p className="text-sm text-gray-500">Orders deferred due to fleet constraints and starvation protection records</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600">
                <th className="p-3">Order Ref</th>
                <th className="p-3">Outlet</th>
                <th className="p-3">Brand</th>
                <th className="p-3">Skipped Yesterday?</th>
                <th className="p-3">Days Unserved</th>
                <th className="p-3">Reason Code</th>
              </tr>
            </thead>
            <tbody>
              {deferred.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-400">No deferrals currently recorded.</td>
                </tr>
              ) : (
                deferred.map(o => (
                  <tr key={o.id} className="border-b">
                    <td className="p-3 font-semibold">{o.ref}</td>
                    <td className="p-3">{o.outletName}</td>
                    <td className="p-3">{o.brand}</td>
                    <td className="p-3">
                      {o.deferredYesterday ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 font-bold">YES</span>
                      ) : (
                        'No'
                      )}
                    </td>
                    <td className="p-3">{o.daysSinceLastServed || 0} days</td>
                    <td className="p-3 font-mono text-xs text-orange-700">{o.deferralReason || 'VOLUME_WEIGHT_LIMIT'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// --- 5. Exception Inbox Screen ---
function ExceptionsScreen() {
  const [exceptions, setExceptions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/exceptions')
      .then(res => res.json())
      .then(data => setExceptions(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B3457]">Exception Inbox</h1>
        <p className="text-sm text-gray-500">Loading shortfalls, dock damages, and driver route issues</p>
      </div>

      <Card>
        <div className="space-y-4">
          {exceptions.length === 0 ? (
            <p className="text-sm text-gray-400">No open exceptions reported.</p>
          ) : (
            exceptions.map(ex => (
              <div key={ex.id} className="border p-4 rounded flex justify-between items-center bg-gray-50">
                <div>
                  <div className="font-bold text-sm text-[#0B3457]">{ex.type} • Order {ex.orderRef}</div>
                  <div className="text-xs text-gray-600 mt-1">{ex.detail}</div>
                </div>
                <div className="space-x-2">
                  <Button variant="primary">Resolve</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

// --- Dispatcher Router Navigation Shell ---
export function DispatcherRole() {
  const location = useLocation();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <nav className="flex space-x-4 border-b pb-3 text-sm font-medium text-gray-600">
        <Link
          to="/dispatcher"
          className={`pb-2 ${location.pathname === '/dispatcher' ? 'border-b-2 border-[#FF8D56] text-[#0B3457] font-bold' : ''}`}
        >
          Overview
        </Link>
        <Link
          to="/dispatcher/orders"
          className={`pb-2 ${location.pathname.startsWith('/dispatcher/orders') ? 'border-b-2 border-[#FF8D56] text-[#0B3457] font-bold' : ''}`}
        >
          Order Queue
        </Link>
        <Link
          to="/dispatcher/planning"
          className={`pb-2 ${location.pathname.startsWith('/dispatcher/planning') ? 'border-b-2 border-[#FF8D56] text-[#0B3457] font-bold' : ''}`}
        >
          Route Planning
        </Link>
        <Link
          to="/dispatcher/deferrals"
          className={`pb-2 ${location.pathname.startsWith('/dispatcher/deferrals') ? 'border-b-2 border-[#FF8D56] text-[#0B3457] font-bold' : ''}`}
        >
          Deferrals
        </Link>
        <Link
          to="/dispatcher/exceptions"
          className={`pb-2 ${location.pathname.startsWith('/dispatcher/exceptions') ? 'border-b-2 border-[#FF8D56] text-[#0B3457] font-bold' : ''}`}
        >
          Exceptions
        </Link>
      </nav>

      <Routes>
        <Route index element={<OverviewScreen />} />
        <Route path="orders" element={<OrdersScreen />} />
        <Route path="planning" element={<PlanningScreen />} />
        <Route path="deferrals" element={<DeferralsScreen />} />
        <Route path="exceptions" element={<ExceptionsScreen />} />
      </Routes>
    </div>
  );
}

export default DispatcherRole;
