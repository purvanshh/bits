export const STATUS = {
  active:      { label: 'Active',      color: '#16a34a', badge: 'bg-green-50 text-green-700 ring-green-600/20' },
  idle:        { label: 'Idle',        color: '#f59e0b', badge: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  maintenance: { label: 'Maintenance', color: '#2563eb', badge: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  inactive:    { label: 'Inactive',    color: '#64748b', badge: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
};
export const STATUSES = Object.keys(STATUS);
export const VEHICLE_TYPES = ['truck', 'van', 'car', 'motorcycle', 'bus', 'other'];
export const EVENT_TYPES = ['NORMAL', 'ENGINE_FAULT', 'LOW_BATTERY', 'EMERGENCY_STOP', 'STATUS_CHANGE'];
export const CRITICAL = ['ENGINE_FAULT', 'LOW_BATTERY', 'EMERGENCY_STOP'];
export const EVENT_BADGE = {
  NORMAL: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  ENGINE_FAULT: 'bg-red-50 text-red-700 ring-red-600/20',
  LOW_BATTERY: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  EMERGENCY_STOP: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  STATUS_CHANGE: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
};
export const ROLE_LABEL = { admin: 'Administrator', fleet_manager: 'Fleet manager', viewer: 'Viewer' };

export const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const fmtCoord = (n) => (typeof n === 'number' ? n.toFixed(5) : '—');
export const hasCoords = (v) => typeof v?.location?.latitude === 'number' && typeof v?.location?.longitude === 'number';
export const humanize = (s) => (s || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
