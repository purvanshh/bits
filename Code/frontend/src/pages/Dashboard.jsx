import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, PauseCircle, RefreshCw, Truck, Wrench } from 'lucide-react';
import { telemetryApi, vehiclesApi } from '../api';
import { useAsync } from '../lib/useAsync';
import { STATUS, STATUSES, fmtDate } from '../lib/format';
import { EmptyState, ErrorState, EventBadge, Loading, PageHeader, StatCard } from '../components/ui';

const CRITICAL_WINDOW_HOURS = 168; // 7 days

export default function Dashboard() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [vehicles, recent, critical] = await Promise.all([
      vehiclesApi.list(),
      telemetryApi.recent({ limit: 8 }),
      telemetryApi.recent({ critical: true, hours: CRITICAL_WINDOW_HOURS, limit: 500 }),
    ]);
    return { vehicles: vehicles.data, recent: recent.data, critical: critical.data };
  }, []);

  if (loading && !data) return <Loading label="Loading fleet overview…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { vehicles, recent, critical } = data;
  const count = Object.fromEntries(STATUSES.map((s) => [s, vehicles.filter((v) => v.operationalStatus === s).length]));
  const byVehicle = {};
  vehicles.forEach((v) => { byVehicle[v.vehicleId] = v; });
  const total = vehicles.length;

  return (
    <>
      <PageHeader title="Fleet overview" subtitle="Live data from the Fleet Management API"
        actions={<button className="btn-secondary" onClick={() => reload()}><RefreshCw className="h-4 w-4" /> Refresh</button>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Truck} label="Total vehicles" value={total} to="/vehicles" />
        <StatCard icon={CheckCircle2} tone="green" label="Active" value={count.active} to="/vehicles?status=active" />
        <StatCard icon={PauseCircle} tone="amber" label="Idle" value={count.idle} to="/vehicles?status=idle" />
        <StatCard icon={Wrench} tone="blue" label="In maintenance" value={count.maintenance} to="/vehicles?status=maintenance" />
        <StatCard icon={AlertTriangle} tone="red" label="Critical alerts" value={critical.length} hint={`last ${CRITICAL_WINDOW_HOURS / 24} days`} to="/notifications" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Operational status</h2>
          {total === 0 ? <EmptyState title="No vehicles yet" hint="Register a vehicle to see the distribution." /> : (
            <>
              <div className="flex h-4 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Status distribution">
                {STATUSES.map((s) => count[s] > 0 && (
                  <div key={s} style={{ width: `${(count[s] / total) * 100}%`, background: STATUS[s].color }} title={`${STATUS[s].label}: ${count[s]}`} />
                ))}
              </div>
              <ul className="mt-5 space-y-3">
                {STATUSES.map((s) => (
                  <li key={s} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: STATUS[s].color }} />{STATUS[s].label}</span>
                    <span className="text-slate-500"><b className="text-slate-900">{count[s]}</b> · {Math.round((count[s] / total) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">Recent vehicle events</h2>
            <Link to="/telemetry" className="text-sm text-brand-600 hover:underline">All telemetry →</Link>
          </div>
          {recent.length === 0 ? <EmptyState title="No telemetry yet" hint="Submit telemetry from the Telemetry page to see events here." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead><tr><th className="th">Vehicle</th><th className="th">Event</th><th className="th">Speed</th><th className="th">Battery</th><th className="th">Time</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {recent.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-50">
                      <td className="td"><Link className="font-medium text-brand-600 hover:underline" to={`/vehicles/${r.vehicleId}`}>{byVehicle[r.vehicleId]?.registrationNumber || r.vehicleId}</Link></td>
                      <td className="td"><EventBadge type={r.eventType} /></td>
                      <td className="td">{r.speed ?? 0} km/h</td>
                      <td className="td">{r.batteryLevel != null ? `${r.batteryLevel}%` : '—'}</td>
                      <td className="td text-slate-500">{fmtDate(r.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
