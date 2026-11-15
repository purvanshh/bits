import { Link } from 'react-router-dom';
import { AlertTriangle, Inbox, Loader2, X } from 'lucide-react';
import { EVENT_BADGE, STATUS, humanize } from '../lib/format';

export const Spinner = ({ className = 'h-5 w-5' }) => <Loader2 className={`animate-spin ${className}`} />;

export const Loading = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-3 py-16 text-slate-500" role="status">
    <Spinner /> <span className="text-sm">{label}</span>
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
    <AlertTriangle className="h-8 w-8 text-red-500" />
    <p className="text-sm font-medium text-slate-800">Something went wrong</p>
    <p className="max-w-md text-sm text-slate-500">{message}</p>
    {onRetry && <button className="btn-secondary" onClick={() => onRetry()}>Try again</button>}
  </div>
);

export const EmptyState = ({ icon: Icon = Inbox, title, hint, children }) => (
  <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
    <Icon className="h-9 w-9 text-slate-300" />
    <p className="text-sm font-medium text-slate-700">{title}</p>
    {hint && <p className="max-w-sm text-sm text-slate-500">{hint}</p>}
    {children}
  </div>
);

export const Alert = ({ kind = 'error', children }) => {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-green-200 bg-green-50 text-green-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-800',
  };
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${styles[kind]}`}>{children}</div>;
};

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

const pill = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset';

export const StatusBadge = ({ status }) => {
  const s = STATUS[status];
  return (
    <span className={`${pill} ${s?.badge || 'bg-slate-100 text-slate-600 ring-slate-500/20'}`}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full" style={{ background: s?.color || '#94a3b8' }} />
      {s?.label || humanize(status)}
    </span>
  );
};

export const EventBadge = ({ type }) => <span className={`${pill} ${EVENT_BADGE[type] || EVENT_BADGE.NORMAL}`}>{humanize(type)}</span>;

export const DeliveryBadge = ({ status }) => (
  <span className={`${pill} ${status === 'sent' ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-red-50 text-red-700 ring-red-600/20'}`}>
    {status === 'sent' ? 'Sent' : 'Failed'}
  </span>
);

export const RoleBadge = ({ role }) => {
  const c = { admin: 'bg-purple-50 text-purple-700 ring-purple-600/20', fleet_manager: 'bg-sky-50 text-sky-700 ring-sky-600/20', viewer: 'bg-slate-100 text-slate-600 ring-slate-500/20' }[role];
  return <span className={`${pill} ${c}`}>{role}</span>;
};

export const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div role="dialog" aria-modal="true" aria-label={title} className={`card w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} mt-8`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

export const Field = ({ label, error, children, hint }) => (
  <label className="block">
    <span className="label">{label}</span>
    {children}
    {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
  </label>
);

export const StatCard = ({ icon: Icon, label, value, tone = 'indigo', to, hint }) => {
  const tones = { indigo: 'bg-indigo-50 text-indigo-600', green: 'bg-green-50 text-green-600', amber: 'bg-amber-50 text-amber-600', blue: 'bg-blue-50 text-blue-600', red: 'bg-red-50 text-red-600' };
  const body = (
    <div className="card flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`rounded-xl p-3 ${tones[tone]}`}><Icon className="h-6 w-6" /></div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-3xl font-semibold text-slate-900">{value}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
};

export const ProgressBar = ({ value, color = 'bg-brand-600' }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
  </div>
);
