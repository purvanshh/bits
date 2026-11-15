import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';
import { Alert, Field, Spinner } from '../components/ui';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from || '/'} replace />;

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (!form.password) e.password = 'Password is required';
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setServerError(errorMessage(err));
      setBusy(false);
    }
  };

  const set = (k) => (ev) => setForm({ ...form, [k]: ev.target.value });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3 text-white">
          <div className="rounded-xl bg-white/15 p-2.5"><Truck className="h-7 w-7" /></div>
          <span className="text-3xl font-semibold tracking-tight">FleetOps</span>
        </div>
        <form onSubmit={submit} noValidate className="card space-y-4 p-7 shadow-xl">
          <div>
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="text-sm text-slate-500">Fleet Management Dashboard</p>
          </div>
          {serverError && <Alert>{serverError}</Alert>}
          <Field label="Email" error={errors.email}>
            <input className="input" type="email" autoComplete="username" value={form.email} onChange={set('email')} placeholder="admin@fleet.com" autoFocus />
          </Field>
          <Field label="Password" error={errors.password}>
            <input className="input" type="password" autoComplete="current-password" value={form.password} onChange={set('password')} placeholder="••••••••" />
          </Field>
          <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Sign in</button>
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <p className="mb-1 font-medium text-slate-600">Demo accounts (after <code>npm run seed</code>)</p>
            <p>admin@fleet.com / admin123</p>
            <p>manager@fleet.com / manager123</p>
            <p>viewer@fleet.com / viewer123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
