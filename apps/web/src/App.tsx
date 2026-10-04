import { Navigate, Route, Routes } from 'react-router-dom';
import { RoleGuard, homeFor } from '@/auth/RoleGuard';
import { useAuth } from '@/auth/AuthContext';
import Login from '@/pages/Login';
import { DispatcherLayout, DriverLayout, LoaderLayout, StoreLayout } from '@/layouts/Layouts';
import StoreRoutes from '@/roles/store';
import DispatcherRoutes from '@/roles/dispatcher';
import LoaderRoutes from '@/roles/loader';
import DriverRoutes from '@/roles/driver';

function Root() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/login" element={<Login />} />
      <Route element={<RoleGuard role="store" />}>
        <Route path="/store/*" element={<StoreLayout><StoreRoutes /></StoreLayout>} />
      </Route>
      <Route element={<RoleGuard role="dispatcher" />}>
        <Route path="/dispatcher/*" element={<DispatcherLayout><DispatcherRoutes /></DispatcherLayout>} />
      </Route>
      <Route element={<RoleGuard role="loader" />}>
        <Route path="/loader/*" element={<LoaderLayout><LoaderRoutes /></LoaderLayout>} />
      </Route>
      <Route element={<RoleGuard role="driver" />}>
        <Route path="/driver/*" element={<DriverLayout><DriverRoutes /></DriverLayout>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
