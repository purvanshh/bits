import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2, Truck } from 'lucide-react';
import { vehiclesApi } from '../api';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../lib/useAsync';
import { STATUSES, humanize } from '../lib/format';
import VehicleForm from '../components/VehicleForm';
import { Alert, EmptyState, ErrorState, Loading, Modal, PageHeader, Spinner, StatusBadge } from '../components/ui';

export default function Vehicles() {
  const { canWrite, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [modal, setModal] = useState(null); // { kind: 'create' | 'edit' | 'delete', vehicle? }
  const [notice, setNotice] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(t); }, [query]);

  // Search by registration uses the backend search endpoint; status is filtered by the backend list endpoint.
  const { data, loading, error, reload } = useAsync(async () => {
    const res = debounced ? await vehiclesApi.search(debounced) : await vehiclesApi.list(status ? { status } : undefined);
    return res.data;
  }, [debounced, status]);

  const rows = useMemo(() => (data || []).filter((v) => !debounced || !status || v.operationalStatus === status), [data, debounced, status]);

  const saved = (msg) => { setModal(null); setNotice(msg); reload(true); };
  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await vehiclesApi.remove(modal.vehicle.vehicleId);
      saved(`Vehicle ${modal.vehicle.registrationNumber} deleted.`);
    } catch (e) { setModal(null); setNotice({ error: errorMessage(e) }); }
    setDeleting(false);
  };

  return (
    <>
      <PageHeader title="Vehicles" subtitle="Register, search and manage fleet vehicles"
        actions={canWrite && <button className="btn-primary" onClick={() => setModal({ kind: 'create' })}><Plus className="h-4 w-4" /> Register vehicle</button>} />

      {notice && (
        <div className="mb-4" onClick={() => setNotice(null)}>
          <Alert kind={notice.error ? 'error' : 'success'}>{notice.error || notice}</Alert>
        </div>
      )}

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search by registration number…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search by registration number" />
        </div>
        <select className="input w-auto" value={status} aria-label="Filter by status"
          onChange={(e) => (e.target.value ? setParams({ status: e.target.value }) : setParams({}))}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading && !data ? <Loading /> : error ? <div className="p-4"><ErrorState message={error} onRetry={reload} /></div> : rows.length === 0 ? (
          <EmptyState icon={Truck} title="No vehicles found" hint={debounced || status ? 'Try changing the search or filter.' : 'Register your first vehicle to get started.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50"><tr>
                <th className="th">Registration</th><th className="th">Vehicle ID</th><th className="th">Type</th><th className="th">Make / model</th>
                <th className="th">Driver</th><th className="th">Status</th><th className="th">Battery</th><th className="th text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((v) => (
                  <tr key={v._id} className="hover:bg-slate-50">
                    <td className="td font-medium"><Link className="text-brand-600 hover:underline" to={`/vehicles/${v.vehicleId}`}>{v.registrationNumber}</Link></td>
                    <td className="td text-slate-500">{v.vehicleId}</td>
                    <td className="td">{humanize(v.vehicleType)}</td>
                    <td className="td">{v.manufacturer} {v.model}</td>
                    <td className="td text-slate-500">{v.assignedDriver || '—'}</td>
                    <td className="td"><StatusBadge status={v.operationalStatus} /></td>
                    <td className="td">{v.batteryLevel}%</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        {canWrite && <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Edit" aria-label={`Edit ${v.registrationNumber}`} onClick={() => setModal({ kind: 'edit', vehicle: v })}><Pencil className="h-4 w-4" /></button>}
                        {isAdmin && <button className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Delete" aria-label={`Delete ${v.registrationNumber}`} onClick={() => setModal({ kind: 'delete', vehicle: v })}><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && rows.length > 0 && <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{rows.length} vehicle{rows.length === 1 ? '' : 's'}</div>}
      </div>
      {!canWrite && <p className="mt-3 text-xs text-slate-400">Your role (viewer) has read-only access to vehicles.</p>}

      {modal?.kind === 'create' && <Modal title="Register vehicle" wide onClose={() => setModal(null)}><VehicleForm onSaved={(v) => saved(`Vehicle ${v.registrationNumber} registered.`)} onCancel={() => setModal(null)} /></Modal>}
      {modal?.kind === 'edit' && <Modal title={`Edit ${modal.vehicle.registrationNumber}`} wide onClose={() => setModal(null)}><VehicleForm vehicle={modal.vehicle} onSaved={(v) => saved(`Vehicle ${v.registrationNumber} updated.`)} onCancel={() => setModal(null)} /></Modal>}
      {modal?.kind === 'delete' && (
        <Modal title="Delete vehicle" onClose={() => setModal(null)}>
          <p className="text-sm text-slate-600">Permanently delete <b>{modal.vehicle.registrationNumber}</b> ({modal.vehicle.vehicleId})? This cannot be undone.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-danger" onClick={confirmDelete} disabled={deleting}>{deleting && <Spinner className="h-4 w-4" />} Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}
