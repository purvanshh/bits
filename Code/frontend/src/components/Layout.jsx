import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Bell, Gauge, LogOut, Map, Menu, Truck, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: Gauge, end: true },
  { to: '/vehicles', label: 'Vehicles', icon: Truck },
  { to: '/map', label: 'Live map', icon: Map },
  { to: '/telemetry', label: 'Telemetry', icon: Activity },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/users', label: 'Users', icon: Users, adminOnly: true },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="mt-6 flex-1 space-y-1 px-3">
      {NAV.filter((n) => !n.adminOnly || isAdmin).map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white/10 text-white' : 'text-indigo-200 hover:bg-white/5 hover:text-white'}`}>
          <Icon className="h-5 w-5" /> {label}
        </NavLink>
      ))}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-900">
      <div className="flex items-center gap-2.5 px-6 pt-6 text-white">
        <div className="rounded-lg bg-brand-500 p-1.5"><Truck className="h-5 w-5" /></div>
        <span className="text-lg font-semibold tracking-tight">FleetOps</span>
      </div>
      {nav}
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium text-white">{user?.name}</p>
        <p className="truncate text-xs text-indigo-300">{user?.email}</p>
        <div className="mt-2 flex items-center justify-between">
          <RoleBadge role={user?.role} />
          <button onClick={logout} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-indigo-200 hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-[3000] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">
            {sidebar}
            <button className="absolute right-3 top-4 text-white" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-6 w-6" /></button>
        <span className="font-semibold">FleetOps</span>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
      <footer className="px-8 pb-6 text-center text-xs text-slate-400">
        Map data © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
      </footer>
    </div>
  );
}
