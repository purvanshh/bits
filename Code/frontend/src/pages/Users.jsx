import { useState } from 'react';
import { Info, Plus, Users as UsersIcon } from 'lucide-react';
import { usersApi } from '../api';
import { errorMessage } from '../api/client';
import { useAsync } from '../lib/useAsync';
import { ROLE_LABEL, fmtDate } from '../lib/format';
import { Alert, EmptyState, ErrorState, Field, Loading, Modal, PageHeader, RoleBadge, Spinner } from '../components/ui';

const PERMISSIONS = [
  ['admin', 'Everything: manage users, delete vehicles, all notifications, test SMS'],
  ['fleet_manager', 'Register/edit vehicles, change status, submit telemetry, geocode, view all notifications'],
  ['viewer', 'Read-only: vehicles, telemetry, map, nearby search, per-vehicle notifications'],
];

function CreateUser({ onDone, onCancel }) {
  const [f, setF] = useState({ name: '', email: '', password: '', phone: '', role: 'viewer' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!f.name.trim()) errs.name = 'Required';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) errs.email = 'Valid email required';
    if (f.password.length < 6) errs.password = 'At least 6 characters';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setServerError('');
    try { await usersApi.create({ ...f, phone: f.phone || undefined }); onDone(f.email); }
    catch (err) { setServerError(errorMessage(err)); setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError && <Alert>{serverError}</Alert>}
      <Field label="Full name" error={errors.name}><input className="input" value={f.name} onChange={set('name')} /></Field>
      <Field label="Email" error={errors.email}><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
      <Field label="Password" error={errors.password}><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
      <Field label="Phone (for SMS)"><input className="input" value={f.phone} onChange={set('phone')} placeholder="+919876543210" /></Field>
      <Field label="Role"><select className="input" value={f.role} onChange={set('role')}>{Object.keys(ROLE_LABEL).map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button><button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Create user</button></div>
    </form>
  );
}

export default function Users() {
  const { data, loading, error, reload } = useAsync(async () => (await usersApi.list()).data, []);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState('');

  return (
    <>
      <PageHeader title="User management" subtitle="Administrator access only"
        actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Create user</button>} />
      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card overflow-hidden xl:col-span-2">
          {loading && !data ? <Loading /> : error ? <div className="p-4"><ErrorState message={error} onRetry={reload} /></div> : data.length === 0 ? <EmptyState icon={UsersIcon} title="No users" /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50"><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Phone</th><th className="th">Role</th><th className="th">Created</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50"><td className="td font-medium">{u.name}</td><td className="td">{u.email}</td><td className="td text-slate-500">{u.phone || '—'}</td><td className="td"><RoleBadge role={u.role} /></td><td className="td text-slate-500">{fmtDate(u.createdAt)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><Info className="h-4 w-4 text-brand-600" /> Role permissions</h2>
          <p className="mb-3 text-xs text-slate-500">Enforced by the backend (JWT + RBAC). The UI hides actions your role cannot perform, but the API is the authority.</p>
          <ul className="space-y-3">{PERMISSIONS.map(([r, d]) => <li key={r}><RoleBadge role={r} /><p className="mt-1 text-sm text-slate-600">{d}</p></li>)}</ul>
          <p className="mt-4 text-xs text-slate-400">Editing and deleting users is available through the API (<code>PUT/DELETE /api/users/:id</code>).</p>
        </section>
      </div>

      {creating && <Modal title="Create user" onClose={() => setCreating(false)}><CreateUser onCancel={() => setCreating(false)} onDone={(email) => { setCreating(false); setNotice(`User ${email} created.`); reload(true); }} /></Modal>}
    </>
  );
}
