/** Admin application (PRD §46): dashboard, users, sellers, products, orders, shipments, disputes, analytics, settings. */
import { useState, useCallback } from 'react';
import NotificationBell from '../../components/NotificationBell';
import Toast from '../../components/shared/Toast';
import { Icon } from '../../components/ui';
import {
  AdminDashboard, AdminUsers, AdminSellers, AdminProducts, AdminOrders, AdminShipments, AdminDisputes, AdminAnalytics, AdminSettings,
} from './AdminPages';

const PAGES = [
  { key: 'dashboard', icon: 'dashboard', label: 'Dashboard', C: AdminDashboard },
  { key: 'users', icon: 'group', label: 'Users', C: AdminUsers },
  { key: 'sellers', icon: 'storefront', label: 'Sellers', C: AdminSellers },
  { key: 'products', icon: 'inventory_2', label: 'Products', C: AdminProducts },
  { key: 'orders', icon: 'receipt_long', label: 'Orders', C: AdminOrders },
  { key: 'shipments', icon: 'local_shipping', label: 'Shipments', C: AdminShipments },
  { key: 'disputes', icon: 'gavel', label: 'Disputes', C: AdminDisputes },
  { key: 'analytics', icon: 'analytics', label: 'Analytics', C: AdminAnalytics },
  { key: 'settings', icon: 'settings', label: 'Settings', C: AdminSettings },
];

export default function AdminApp({ session, onLogout }) {
  const [page, setPage] = useState('dashboard');
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const onToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const go = useCallback((key) => { setPage(key); setMenu(false); }, []);
  const Page = PAGES.find((p) => p.key === page).C;

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {PAGES.map((p) => (
        <button key={p.key} onClick={() => go(p.key)}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-label-md text-left ${page === p.key ? 'bg-primary-container/15 text-primary font-semibold' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'}`}>
          <Icon name={p.icon} filled={page === p.key} />{p.label}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-60 h-screen sticky top-0 flex-col py-5 px-3 bg-surface-container-low border-r border-outline-variant">
        <p className="px-4 mb-5 text-title-md font-bold text-on-surface flex items-center gap-2"><Icon name="admin_panel_settings" className="text-primary" />SMBConnect Admin</p>
        {nav}
        <button onClick={onLogout} className="mt-auto flex items-center gap-3 px-4 py-2.5 rounded-lg text-label-md text-on-surface-variant hover:text-error"><Icon name="logout" />Log out</button>
      </aside>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenu(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="relative w-64 h-full bg-surface-container-low p-3 pt-5 animate-slide-in" onClick={(e) => e.stopPropagation()}>{nav}</aside>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-surface-container-lowest border-b border-outline-variant h-14 px-4 lg:px-8 flex items-center gap-2">
          <button onClick={() => setMenu(true)} className="lg:hidden p-2 rounded-full hover:bg-surface-container" aria-label="Menu"><Icon name="menu" /></button>
          <span className="text-label-md text-on-surface-variant mr-auto truncate">{session.email}</span>
          <NotificationBell />
          <button onClick={onLogout} className="lg:hidden p-2 rounded-full hover:bg-surface-container" aria-label="Log out"><Icon name="logout" /></button>
        </header>
        <main className="max-w-max-width mx-auto px-4 lg:px-8 py-6"><Page go={go} onToast={onToast} /></main>
      </div>
      <Toast message={toast.message} type={toast.type} onDismiss={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
}
