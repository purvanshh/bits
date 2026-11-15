import { useState } from 'react';
import { errorMessage } from '../api/client';
import { vehiclesApi } from '../api';
import { STATUSES, VEHICLE_TYPES, humanize } from '../lib/format';
import { Alert, Field, Spinner } from './ui';

// Create (vehicle undefined) or edit an existing vehicle.
export default function VehicleForm({ vehicle, onSaved, onCancel }) {
  const editing = !!vehicle;
  const [f, setF] = useState({
    vehicleId: vehicle?.vehicleId || '', registrationNumber: vehicle?.registrationNumber || '',
    vehicleType: vehicle?.vehicleType || 'truck', manufacturer: vehicle?.manufacturer || '', model: vehicle?.model || '',
    assignedDriver: vehicle?.assignedDriver || '', operationalStatus: vehicle?.operationalStatus || 'idle',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    ['vehicleId', 'registrationNumber', 'manufacturer', 'model'].forEach((k) => { if (!f[k].trim()) errs[k] = 'Required'; });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setServerError('');
    try {
      const payload = { ...f, assignedDriver: f.assignedDriver.trim() || undefined };
      const res = editing
        ? await vehiclesApi.update(vehicle.vehicleId, (({ vehicleId, ...rest }) => rest)(payload))
        : await vehiclesApi.create(payload);
      onSaved(res.data);
    } catch (err) {
      setServerError(errorMessage(err)); setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError && <Alert>{serverError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vehicle ID" error={errors.vehicleId} hint={editing ? 'Cannot be changed' : 'e.g. VH100'}>
          <input className="input" value={f.vehicleId} onChange={set('vehicleId')} disabled={editing} />
        </Field>
        <Field label="Registration number" error={errors.registrationNumber}>
          <input className="input uppercase" value={f.registrationNumber} onChange={set('registrationNumber')} placeholder="CG04AB1234" />
        </Field>
        <Field label="Type">
          <select className="input" value={f.vehicleType} onChange={set('vehicleType')}>{VEHICLE_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</select>
        </Field>
        <Field label="Operational status">
          <select className="input" value={f.operationalStatus} onChange={set('operationalStatus')}>{STATUSES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</select>
        </Field>
        <Field label="Manufacturer" error={errors.manufacturer}><input className="input" value={f.manufacturer} onChange={set('manufacturer')} /></Field>
        <Field label="Model" error={errors.model}><input className="input" value={f.model} onChange={set('model')} /></Field>
        <div className="sm:col-span-2"><Field label="Assigned driver"><input className="input" value={f.assignedDriver} onChange={set('assignedDriver')} /></Field></div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{editing ? 'Save changes' : 'Register vehicle'}</button>
      </div>
    </form>
  );
}
