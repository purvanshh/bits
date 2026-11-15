import { useEffect, useState } from 'react';
import { Activity, Battery, Gauge, MapPin, RefreshCw, Send, Thermometer } from 'lucide-react';
import { telemetryApi, vehiclesApi } from '../api';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../lib/useAsync';
import { EVENT_TYPES, fmtCoord, fmtDate } from '../lib/format';
import { Alert, EmptyState, ErrorState, EventBadge, Field, Loading, PageHeader, ProgressBar, Spinner } from '../components/ui';

const Metric = ({ icon: Icon, label, value, children }) => (
  <div className="card p-4">
    <div className="flex items-center gap-2 text-sm text-slate-500"><Icon className="h-4 w-4" /> {label}</div>
    <p className="mt-1 text-2xl font-semibold">{value}</p>
    {children}
  </div>
);

export default function Telemetry() {
  const { canWrite } = useAuth();
  const vehicles = useAsync(async () => (await vehiclesApi.list()).data, []);
  const [vehicleId, setVehicleId] = useState('');
  const [eventFilter, setEventFilter] = useState('');

  useEffect(() => { if (!vehicleId && vehicles.data?.length) setVehicleId(vehicles.data[0].vehicleId); }, [vehicles.data, vehicleId]);
  const vehicle = vehicles.data?.find((v) => v.vehicleId === vehicleId);

  const tel = useAsync(async () => {
    if (!vehicleId) return null;
    const [history, latest] = await Promise.all([
      telemetryApi.history(vehicleId, 50),
      telemetryApi.latest(vehicleId).then((r) => r.data).catch((e) => (e.response?.status === 404 ? null : Promise.reject(e))),
    ]);
    return { history: history.data, latest };
  }, [vehicleId]);

  const [form, setForm] = useState({ latitude: '', longitude: '', speed: '40', engineTemperature: '85', batteryLevel: '80', eventType: '' });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  // Pre-fill the simulator with the vehicle's current location
  useEffect(() => {
    if (vehicle) setForm((f) => ({ ...f, latitude: String(vehicle.location?.latitude ?? 21.2514), longitude: String(vehicle.location?.longitude ?? 81.6296) }));
  }, [vehicle?.vehicleId]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setResult(null);
    const num = (v) => (v === '' ? undefined : Number(v));
    try {
      const res = await telemetryApi.submit({
        vehicleId, latitude: num(form.latitude), longitude: num(form.longitude), speed: num(form.speed),
        engineTemperature: num(form.engineTemperature), batteryLevel: num(form.batteryLevel), ...(form.eventType && { eventType: form.eventType }),
      });
      const t = res.data;
      setResult({ ok: `Telemetry stored (${t.eventType}).${['ENGINE_FAULT', 'LOW_BATTERY', 'EMERGENCY_STOP'].includes(t.eventType) ? ' A MockSMS alert was triggered – see Notifications.' : ''}` });
      tel.reload(true); vehicles.reload(true);
    } catch (err) { setResult({ err: errorMessage(err) }); }
    setBusy(false);
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (vehicles.loading && !vehicles.data) return <Loading />;
  if (vehicles.error) return <ErrorState message={vehicles.error} onRetry={vehicles.reload} />;
  if (!vehicles.data.length) return <EmptyState title="No vehicles" hint="Register a vehicle first." />;

  const latest = tel.data?.latest;
  const history = (tel.data?.history || []).filter((r) => !eventFilter || r.eventType === eventFilter);

  return (
    <>
      <PageHeader title="Telemetry" subtitle="Live readings and event history per vehicle"
        actions={<>
          <select className="input w-auto" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} aria-label="Select vehicle">
            {vehicles.data.map((v) => <option key={v.vehicleId} value={v.vehicleId}>{v.registrationNumber} ({v.vehicleId})</option>)}
          </select>
          <button className="btn-secondary" onClick={() => tel.reload(true)}><RefreshCw className="h-4 w-4" /> Refresh</button>
        </>} />

      {tel.error ? <ErrorState message={tel.error} onRetry={tel.reload} /> : tel.loading && !tel.data ? <Loading /> : (
        <>
          {!latest ? (
            <div className="card mb-6"><EmptyState icon={Activity} title="No telemetry for this vehicle yet" hint={canWrite ? 'Use the simulator below to submit a reading.' : 'Readings will appear once the vehicle reports.'} /></div>
          ) : (
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric icon={Gauge} label="Speed" value={`${latest.speed ?? 0} km/h`}><p className="mt-1 text-xs text-slate-400">{fmtDate(latest.timestamp)}</p></Metric>
              <Metric icon={Battery} label="Battery" value={latest.batteryLevel != null ? `${latest.batteryLevel}%` : '—'}>
                {latest.batteryLevel != null && <div className="mt-2"><ProgressBar value={latest.batteryLevel} color={latest.batteryLevel < 20 ? 'bg-red-500' : 'bg-green-500'} /></div>}
              </Metric>
              <Metric icon={Thermometer} label="Engine temperature" value={latest.engineTemperature != null ? `${latest.engineTemperature} °C` : '—'}>
                {latest.engineTemperature > 110 && <p className="mt-1 text-xs font-medium text-red-600">Above 110 °C threshold</p>}
              </Metric>
              <Metric icon={MapPin} label="GPS coordinates" value={<span className="text-lg">{fmtCoord(latest.latitude)}, {fmtCoord(latest.longitude)}</span>}>
                <div className="mt-1"><EventBadge type={latest.eventType} /></div>
              </Metric>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-3">
            <section className="card xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
                <h2 className="font-semibold">Event history</h2>
                <select className="input w-auto" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} aria-label="Filter events">
                  <option value="">All events</option>{EVENT_TYPES.filter((t) => t !== 'STATUS_CHANGE').map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {history.length === 0 ? <EmptyState title="No events" hint="No readings match the filter." /> : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="sticky top-0 bg-slate-50"><tr><th className="th">Time</th><th className="th">Event</th><th className="th">Speed</th><th className="th">Temp</th><th className="th">Battery</th><th className="th">GPS</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((r) => (
                        <tr key={r._id}><td className="td whitespace-nowrap text-slate-500">{fmtDate(r.timestamp)}</td><td className="td"><EventBadge type={r.eventType} /></td>
                          <td className="td">{r.speed ?? 0}</td><td className="td">{r.engineTemperature ?? '—'}</td><td className="td">{r.batteryLevel != null ? `${r.batteryLevel}%` : '—'}</td>
                          <td className="td whitespace-nowrap text-slate-500">{fmtCoord(r.latitude)}, {fmtCoord(r.longitude)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card p-5">
              <h2 className="mb-1 font-semibold">Telemetry simulator</h2>
              <p className="mb-4 text-xs text-slate-500">Simulates the vehicle sending a reading to <code>POST /api/telemetry</code>. Engine &gt; 110 °C or battery &lt; 20% are detected automatically.</p>
              {!canWrite ? <Alert kind="info">Submitting telemetry requires the admin or fleet_manager role.</Alert> : (
                <form onSubmit={submit} className="space-y-3">
                  {result && <Alert kind={result.err ? 'error' : 'success'}>{result.err || result.ok}</Alert>}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Latitude"><input className="input" type="number" step="any" required value={form.latitude} onChange={set('latitude')} /></Field>
                    <Field label="Longitude"><input className="input" type="number" step="any" required value={form.longitude} onChange={set('longitude')} /></Field>
                    <Field label="Speed (km/h)"><input className="input" type="number" min="0" value={form.speed} onChange={set('speed')} /></Field>
                    <Field label="Engine °C"><input className="input" type="number" value={form.engineTemperature} onChange={set('engineTemperature')} /></Field>
                    <Field label="Battery %"><input className="input" type="number" min="0" max="100" value={form.batteryLevel} onChange={set('batteryLevel')} /></Field>
                    <Field label="Event type"><select className="input" value={form.eventType} onChange={set('eventType')}><option value="">Auto-detect</option>{EVENT_TYPES.filter((t) => t !== 'STATUS_CHANGE').map((t) => <option key={t}>{t}</option>)}</select></Field>
                  </div>
                  <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />} Submit telemetry</button>
                </form>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
