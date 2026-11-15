import { useEffect, useState } from 'react';
import { BatteryWarning, Bell, OctagonAlert, RefreshCw, Wrench } from 'lucide-react';
import { notificationsApi, telemetryApi, vehiclesApi } from '../api';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../lib/useAsync';
import { EVENT_TYPES, fmtDate } from '../lib/format';
import { Alert, DeliveryBadge, EmptyState, ErrorState, EventBadge, Loading, PageHeader, Spinner } from '../components/ui';

const SCENARIOS = {
  ENGINE_FAULT:   { label: 'Engine fault',   icon: Wrench,         extra: { eventType: 'ENGINE_FAULT', engineTemperature: 125, speed: 30, batteryLevel: 70 } },
  LOW_BATTERY:    { label: 'Low battery',    icon: BatteryWarning, extra: { eventType: 'LOW_BATTERY', batteryLevel: 12, speed: 20, engineTemperature: 80 } },
  EMERGENCY_STOP: { label: 'Emergency stop', icon: OctagonAlert,   extra: { eventType: 'EMERGENCY_STOP', speed: 0, engineTemperature: 90, batteryLevel: 60 } },
};

export default function Notifications() {
  const { canWrite } = useAuth();
  const vehicles = useAsync(async () => (await vehiclesApi.list()).data, []);
  const [vehicleId, setVehicleId] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sim, setSim] = useState(null);
  const [busy, setBusy] = useState('');

  useEffect(() => { if (!vehicleId && vehicles.data?.length) setVehicleId(vehicles.data[0].vehicleId); }, [vehicles.data, vehicleId]);

  // admin / fleet_manager see every notification; viewers can only query per vehicle (backend RBAC)
  const list = useAsync(async () => {
    if (canWrite) return (await notificationsApi.list()).data;
    return vehicleId ? (await notificationsApi.forVehicle(vehicleId)).data : [];
  }, [canWrite, canWrite ? null : vehicleId]);

  const simulate = async (key) => {
    const v = vehicles.data.find((x) => x.vehicleId === vehicleId);
    setBusy(key); setSim(null);
    try {
      await telemetryApi.submit({
        vehicleId, latitude: v?.location?.latitude ?? 21.2514, longitude: v?.location?.longitude ?? 81.6296, ...SCENARIOS[key].extra,
      });
      setSim({ ok: `${SCENARIOS[key].label} submitted for ${v?.registrationNumber || vehicleId}. Waiting for the MockSMS result…` });
      setTimeout(() => { list.reload(true); setSim({ ok: `${SCENARIOS[key].label} submitted for ${v?.registrationNumber || vehicleId}. Notification recorded below.` }); }, 900);
    } catch (e) { setSim({ err: errorMessage(e) }); }
    setBusy('');
  };

  const rows = (list.data || []).filter((n) => (!eventFilter || n.eventType === eventFilter) && (!statusFilter || n.status === statusFilter));

  return (
    <>
      <PageHeader title="Notifications" subtitle="MockSMS alerts for critical vehicle events"
        actions={<button className="btn-secondary" onClick={() => list.reload(true)}><RefreshCw className="h-4 w-4" /> Refresh</button>} />

      <section className="card mb-6 p-5">
        <h2 className="font-semibold">Simulate a critical event</h2>
        <p className="mb-4 text-xs text-slate-500">Sends real telemetry through the API; the backend detects the event and dispatches a MockSMS (which randomly fails ~15% of the time by design).</p>
        {!canWrite ? <Alert kind="info">Simulating events requires the admin or fleet_manager role. You can browse notification history per vehicle below.</Alert> : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px]">
              <span className="label">Vehicle</span>
              <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} aria-label="Simulation vehicle">
                {(vehicles.data || []).map((v) => <option key={v.vehicleId} value={v.vehicleId}>{v.registrationNumber} ({v.vehicleId})</option>)}
              </select>
            </div>
            {Object.entries(SCENARIOS).map(([key, { label, icon: Icon }]) => (
              <button key={key} className="btn-secondary" disabled={!vehicleId || !!busy} onClick={() => simulate(key)}>
                {busy === key ? <Spinner className="h-4 w-4" /> : <Icon className="h-4 w-4 text-red-500" />} {label}
              </button>
            ))}
          </div>
        )}
        {sim && <div className="mt-3"><Alert kind={sim.err ? 'error' : 'success'}>{sim.err || sim.ok}</Alert></div>}
      </section>

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        {!canWrite && (
          <select className="input w-auto" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} aria-label="Vehicle">
            {(vehicles.data || []).map((v) => <option key={v.vehicleId} value={v.vehicleId}>{v.registrationNumber}</option>)}
          </select>
        )}
        <select className="input w-auto" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} aria-label="Filter by event type">
          <option value="">All event types</option>{EVENT_TYPES.filter((t) => t !== 'NORMAL').map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="">Sent &amp; failed</option><option value="sent">Sent</option><option value="failed">Failed</option>
        </select>
        <span className="ml-auto text-sm text-slate-500">{rows.length} notification{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className="card overflow-hidden">
        {list.loading && !list.data ? <Loading /> : list.error ? <div className="p-4"><ErrorState message={list.error} onRetry={list.reload} /></div> : rows.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" hint="Simulate an event above, or adjust the filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50"><tr><th className="th">ID</th><th className="th">Vehicle</th><th className="th">Recipient</th><th className="th">Message</th><th className="th">Event</th><th className="th">Time</th><th className="th">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((n) => (
                  <tr key={n._id} className="hover:bg-slate-50 align-top">
                    <td className="td font-mono text-xs text-slate-500" title={n._id}>…{n._id.slice(-8)}</td>
                    <td className="td font-medium">{n.vehicleId}</td>
                    <td className="td whitespace-nowrap">{n.recipient}</td>
                    <td className="td max-w-sm">{n.message}{n.failureReason && <span className="block text-xs text-red-500">{n.failureReason}</span>}</td>
                    <td className="td"><EventBadge type={n.eventType} /></td>
                    <td className="td whitespace-nowrap text-slate-500">{fmtDate(n.timestamp)}</td>
                    <td className="td"><DeliveryBadge status={n.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
