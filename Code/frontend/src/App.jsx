import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { EmptyState, Loading } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import VehicleDetail from './pages/VehicleDetail';
import MapPage from './pages/MapPage';
import Telemetry from './pages/Telemetry';
import Notifications from './pages/Notifications';
import Users from './pages/Users';

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading label="Restoring session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

// Role-restricted page: shows a clear 403 screen instead of a blank/redirect.
function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (roles.includes(user.role)) return children;
  return (
    <div className="card mx-auto mt-10 max-w-lg">
      <EmptyState icon={ShieldAlert} title="Access restricted"
        hint={`This page requires the ${roles.join(' or ')} role. You are signed in as ${user.role}.`} />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="vehicles/:vehicleId" element={<VehicleDetail />} />
          <Route path="map" element={<MapPage />} />
          <Route path="telemetry" element={<Telemetry />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="users" element={<RequireRole roles={['admin']}><Users /></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
