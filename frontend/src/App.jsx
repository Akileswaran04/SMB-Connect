/**
 * Role router: one app per role (buyer, seller, logistics partner, admin).
 * Each role app owns its own state, so switching roles between sessions
 * never changes the hooks rendered by the same component.
 */
import { useState, useCallback, Suspense, lazy } from 'react';
import { getSession, clearSession } from './services/storage';
import LoginScreen from './components/LoginScreen';
import { Loading } from './components/ui';
import './index.css';

const BuyerApp = lazy(() => import('./modules/buyer/BuyerApp'));
const SellerApp = lazy(() => import('./modules/seller/SellerApp'));
const LogisticsApp = lazy(() => import('./modules/logistics/LogisticsApp'));
const AdminApp = lazy(() => import('./modules/admin/AdminApp'));

const APPS = { buyer: BuyerApp, seller: SellerApp, logistics: LogisticsApp, admin: AdminApp };

export default function App() {
  const [session, setSession] = useState(getSession());

  const handleLogin = useCallback(() => setSession(getSession()), []);
  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const RoleApp = session?.token ? APPS[session.role] : null;
  if (!RoleApp) return <LoginScreen onLogin={handleLogin} />;

  return (
    <Suspense fallback={<div className="min-h-screen bg-background"><Loading /></div>}>
      <RoleApp key={`${session.role}-${session.email}`} session={session} onLogout={handleLogout} />
    </Suspense>
  );
}
