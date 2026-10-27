/**
 * Role router: one app per role (buyer, seller, logistics partner, admin).
 * Each role app owns its own state, so switching roles between sessions
 * never changes the hooks rendered by the same component.
 */
import { useState, useCallback, useEffect, Suspense, lazy } from 'react';
import { getSession, clearSession, updateSessionLanguage } from './services/storage';
import { setLanguage } from './services/smb';
import { getLang, setLang, hasChosenLang, t } from './i18n';
import LoginScreen from './components/LoginScreen';
import HelpButton from './components/HelpButton';
import { Loading } from './components/ui';
import './index.css';

const BuyerApp = lazy(() => import('./modules/buyer/BuyerApp'));
const SellerApp = lazy(() => import('./modules/seller/SellerApp'));
const LogisticsApp = lazy(() => import('./modules/logistics/LogisticsApp'));
const AdminApp = lazy(() => import('./modules/admin/AdminApp'));

const APPS = { buyer: BuyerApp, seller: SellerApp, logistics: LogisticsApp, admin: AdminApp };

export default function App() {
  const [session, setSession] = useState(getSession());
  const [notice, setNotice] = useState('');
  const [, setLangTick] = useState(0);

  useEffect(() => {
    document.documentElement.lang = getLang() === 'tanglish' ? 'en' : getLang();
    const rerender = () => setLangTick((n) => n + 1);
    // An expired or revoked login (any 401) returns to the login screen with a clear reason.
    const expired = () => { clearSession(); setSession(null); setNotice(t('Your login has expired. Please log in again.')); };
    window.addEventListener('smb:lang', rerender);
    window.addEventListener('smb:logout', expired);
    return () => { window.removeEventListener('smb:lang', rerender); window.removeEventListener('smb:logout', expired); };
  }, []);

  const handleLogin = useCallback(() => {
    const s = getSession();
    // A language picked on the login screen wins over the one saved on the account.
    if (hasChosenLang() && s?.language !== getLang()) {
      updateSessionLanguage(getLang());
      setLanguage(getLang()).catch(() => {});
    } else if (s?.language) {
      setLang(s.language);
    }
    setNotice('');
    setSession(getSession());
  }, []);

  const handleLogout = useCallback(() => {
    if (!window.confirm(t('Log out of SMBConnect?'))) return;
    clearSession();
    setSession(null);
  }, []);

  const RoleApp = session?.token ? APPS[session.role] : null;
  return (
    <>
      {RoleApp ? (
        <Suspense fallback={<div className="min-h-screen bg-background"><Loading /></div>}>
          <RoleApp key={`${session.role}-${session.email}`} session={session} onLogout={handleLogout} />
        </Suspense>
      ) : <LoginScreen onLogin={handleLogin} notice={notice} />}
      <HelpButton />
    </>
  );
}
