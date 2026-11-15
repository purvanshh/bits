import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Pencil, Trash2 } from 'lucide-react';
import { mapsApi, notificationsApi, telemetryApi, vehiclesApi } from '../api';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../lib/useAsync';
import { STATUSES, fmtCoord, fmtDate, humanize } from '../lib/format';
import VehicleForm from '../components/VehicleForm';
import { Alert, DeliveryBadge, ErrorState, EventBadge, Field, Loading, Modal, PageHeader, ProgressBar, Spinner, StatusBadge } from '../components/ui';

const Row = ({ k, children }) => (
  <div className="flex justify-between gap-4 py-2.5 text-sm"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-slate-900">{children}</dd></div>
);

export default function VehicleDetail() {
  const { vehicleId } = useParams();
  const { canWrite, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState(null);
  const [address, setAddress] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const [v, latest, notes] = await Promise.all([
      vehiclesApi.get(vehicleId),
      telemetryApi.latest(vehicleId).then((r) => r.data).catch(() => null), // 404 = no telemetry yet
      notificationsApi.forVehicle(vehicleId).then((r) => r.data),
    ]);
    return { vehicle: v.data, latest, notes };
  }, [vehicleId]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { vehicle: v, latest, notes } = data;

  const changeStatus = async (s) => {
    try { await vehiclesApi.setStatus(v.vehicleId, s); setMsg({ ok: `Status changed to ${humanize(s)}. A MockSMS notification was triggered.` }); reload(true); }
    catch (e) { setMsg({ err: errorMessage(e) }); }
  };
  const geocode = async (e) => {
    e.preventDefault(); setGeoBusy(true); setMsg(null);
    try {
      const r = await mapsApi.geocodeVehicle(v.vehicleId, address);
      const c = r.data.coordinates;
      setMsg({ ok: `Saved ${fmtCoord(c.latitude)}, ${fmtCoord(c.longitude)} (${c.cached ? 'cached' : 'Nominatim'}). ${c.attribution}` });
      setAddress(''); reload(true);
    } catch (err) { setMsg({ err: errorMessage(err) }); }
    setGeoBusy(false);
  };
  const del = async () => {
    try { await vehiclesApi.remove(v.vehicleId); navigate('/vehicles'); } catch (e) { setModal(null); setMsg({ err: errorMessage(e) }); }
  };

  return (
    <>
      <Link to="/vehicles" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Vehicles</Link>
      <PageHeader title={v.registrationNumber} subtitle={`${v.vehicleId} · ${v.manufacturer} ${v.model}`}
        actions={<>
          <StatusBadge status={v.operationalStatus} />
          {canWrite && <button className="btn-secondary" onClick={() => setModal('edit')}><Pencil className="h-4 w-4" /> Edit</button>}
          {isAdmin && <button className="btn-danger" onClick={() => setModal('delete')}><Trash2 className="h-4 w-4" /> Delete</button>}
        </>} />
      {msg && <div className="mb-4"><Alert kind={msg.err ? 'error' : 'success'}>{msg.err || msg.ok}</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Details</h2>
          <dl className="divide-y divide-slate-100">
            <Row k="Type">{humanize(v.vehicleType)}</Row>
            <Row k="Driver">{v.assignedDriver || '—'}</Row>
            <Row k="Address">{v.address || '—'}</Row>
            <Row k="Latitude">{fmtCoord(v.location?.latitude)}</Row>
            <Row k="Longitude">{fmtCoord(v.location?.longitude)}</Row>
            <Row k="Registered">{fmtDate(v.createdAt)}</Row>
            <Row k="Updated">{fmtDate(v.updatedAt)}</Row>
          </dl>
          <div className="mt-3"><p className="mb-1 text-xs text-slate-500">Battery {v.batteryLevel}%</p><ProgressBar value={v.batteryLevel} color={v.batteryLevel < 20 ? 'bg-red-500' : 'bg-green-500'} /></div>
          {canWrite && (
            <div className="mt-5">
              <span className="label">Change status</span>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => <button key={s} disabled={s === v.operationalStatus} onClick={() => changeStatus(s)} className="btn-secondary px-2.5 py-1 text-xs">{humanize(s)}</button>)}
              </div>
            </div>
          )}
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Latest telemetry</h2>
            {!latest ? <p className="text-sm text-slate-500">No telemetry received for this vehicle yet.</p> : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[['Speed', `${latest.speed} km/h`], ['Engine', latest.engineTemperature != null ? `${latest.engineTemperature} °C` : '—'], ['Battery', latest.batteryLevel != null ? `${latest.batteryLevel}%` : '—'], ['GPS', `${fmtCoord(latest.latitude)}, ${fmtCoord(latest.longitude)}`]].map(([k, val]) => (
                    <div key={k} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{k}</p><p className="text-sm font-semibold">{val}</p></div>
                  ))}
                </div>
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><EventBadge type={latest.eventType} /> {fmtDate(latest.timestamp)}</p>
              </>
            )}
          </section>

          {canWrite && (
            <section className="card p-5">
              <h2 className="mb-1 flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4 text-brand-600" /> Set location from address</h2>
              <p className="mb-3 text-xs text-slate-500">Geocoded with OpenStreetMap Nominatim (cached, max 1 request/second). Results © OpenStreetMap contributors.</p>
              <form onSubmit={geocode} className="flex flex-wrap gap-2">
                <div className="min-w-[240px] flex-1"><Field label="Address"><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Raipur Railway Station, Chhattisgarh, India" required /></Field></div>
                <button className="btn-primary self-end" disabled={geoBusy || !address.trim()}>{geoBusy && <Spinner className="h-4 w-4" />} Geocode &amp; save</button>
              </form>
            </section>
          )}

          <section className="card">
            <h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Notifications</h2>
            {notes.length === 0 ? <p className="p-5 text-sm text-slate-500">No notifications for this vehicle.</p> : (
              <ul className="divide-y divide-slate-100">
                {notes.slice(0, 6).map((n) => (
                  <li key={n._id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <span className="flex-1">{n.message}</span><EventBadge type={n.eventType} /><DeliveryBadge status={n.status} /><span className="text-xs text-slate-400">{fmtDate(n.timestamp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {modal === 'edit' && <Modal title={`Edit ${v.registrationNumber}`} wide onClose={() => setModal(null)}><VehicleForm vehicle={v} onSaved={() => { setModal(null); reload(true); }} onCancel={() => setModal(null)} /></Modal>}
      {modal === 'delete' && (
        <Modal title="Delete vehicle" onClose={() => setModal(null)}>
          <p className="text-sm text-slate-600">Permanently delete <b>{v.registrationNumber}</b>? This cannot be undone.</p>
          <div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn-danger" onClick={del}>Delete</button></div>
        </Modal>
      )}
    </>
  );
}
