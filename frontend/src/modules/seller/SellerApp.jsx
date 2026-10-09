/**
 * Seller application shell (PRD §29): sidebar / bottom bar navigation,
 * notifications, onboarding for new stores, and the seller's pages.
 */
import { useState, useCallback, useEffect, Suspense, lazy } from 'react';
import { getSellerById, updateSeller, getTotalUnread } from '../../services/storage';
import OnboardingForm from '../../components/OnboardingForm';
import SellerHeader from '../../components/SellerHeader';
import BottomNav from '../../components/BottomNav';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import Toast from '../../components/shared/Toast';
import { Loading } from '../../components/ui';
import { TAB_KEYS } from '../MODULES';

const DashboardTab = lazy(() => import('./DashboardTab'));
const ProductsTab = lazy(() => import('./ProductsTab'));
const InventoryTab = lazy(() => import('./InventoryTab'));
const OrdersTab = lazy(() => import('./OrdersTab'));
const NegotiationTab = lazy(() => import('./NegotiationTab'));
const CustomersTab = lazy(() => import('./CustomersTab'));
const ShipmentsTab = lazy(() => import('./ShipmentsTab'));
const PaymentsTab = lazy(() => import('./PaymentsTab'));
const AnalyticsTab = lazy(() => import('./AnalyticsTab'));
const ProfileTab = lazy(() => import('./ProfileTab'));
const InboxTab = lazy(() => import('../unified-inbox').then((m) => ({ default: m.InboxTab })));

export default function SellerApp({ onLogout }) {
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(TAB_KEYS.DASHBOARD);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [unreadCount, setUnreadCount] = useState(0);
  const [focus, setFocus] = useState(null); // e.g. { orderId } from a notification

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const loadSeller = useCallback(async () => {
    try {
      setSeller(await getSellerById());
    } catch {
      onLogout();
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => { loadSeller(); }, [loadSeller]);

  useEffect(() => {
    if (!seller?.id) return undefined;
    let cancelled = false;
    const tick = async () => {
      const count = await getTotalUnread();
      if (!cancelled) setUnreadCount(count);
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [seller?.id]);

  const go = useCallback((tab, extra = null) => {
    setActiveTab(tab);
    setFocus(extra);
    setSidebarOpen(false);
  }, []);

  const handleNotification = useCallback((n) => {
    const d = n.data || {};
    if (n.type?.startsWith('negotiation')) go(TAB_KEYS.NEGOTIATION);
    else if (d.order_id) go(TAB_KEYS.ORDERS, { orderId: d.order_id });
    else if (n.type === 'payment_settled') go(TAB_KEYS.PAYMENTS);
    else if (n.type === 'seller_verification') go(TAB_KEYS.PROFILE);
    else if (n.type === 'product_removed') go(TAB_KEYS.PRODUCTS);
  }, [go]);

  const handleOnboardingComplete = useCallback(async (data) => {
    try {
      await updateSeller(seller.id, data);
      await loadSeller();
      showToast('Welcome! Your store is set up');
    } catch {
      showToast('Failed to save profile', 'error');
    }
  }, [seller, loadSeller, showToast]);

  if (loading) return <div className="min-h-screen bg-background"><Loading /></div>;
  if (!seller) return null;
  if (!seller.business_name) return <OnboardingForm seller={seller} onComplete={handleOnboardingComplete} />;

  const common = { onToast: showToast, seller, go, focus };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <div className="lg:hidden">
        <SellerHeader seller={seller} onSellerUpdate={setSeller} onLogout={onLogout} onMenuToggle={() => setSidebarOpen(true)}
          extra={<NotificationBell onOpen={handleNotification} />} />
      </div>

      <Sidebar seller={seller} activeTab={activeTab} onTabChange={(t) => go(t)} onSellerUpdate={setSeller}
        onLogout={onLogout} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} unreadCount={unreadCount} />

      <main className="flex-1 min-w-0 w-full max-w-max-width mx-auto px-4 lg:px-10 py-6 pb-24 lg:pb-8">
        <div className="hidden lg:flex justify-end -mt-2 mb-2">
          <NotificationBell onOpen={handleNotification} />
        </div>
        <Suspense fallback={<Loading />}>
          {activeTab === TAB_KEYS.DASHBOARD && <DashboardTab {...common} />}
          {activeTab === TAB_KEYS.PRODUCTS && <ProductsTab {...common} />}
          {activeTab === TAB_KEYS.INVENTORY && <InventoryTab {...common} />}
          {activeTab === TAB_KEYS.ORDERS && <OrdersTab {...common} />}
          {activeTab === TAB_KEYS.NEGOTIATION && <NegotiationTab {...common} />}
          {activeTab === TAB_KEYS.CUSTOMERS && <CustomersTab {...common} />}
          {activeTab === TAB_KEYS.SHIPMENTS && <ShipmentsTab {...common} />}
          {activeTab === TAB_KEYS.PAYMENTS && <PaymentsTab {...common} />}
          {activeTab === TAB_KEYS.INBOX && <InboxTab sellerId={seller.id} onToast={showToast} onRefresh={() => getTotalUnread().then(setUnreadCount)} />}
          {activeTab === TAB_KEYS.ANALYTICS && <AnalyticsTab {...common} />}
          {activeTab === TAB_KEYS.PROFILE && <ProfileTab {...common} onSellerUpdate={setSeller} reload={loadSeller} />}
        </Suspense>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={(t) => go(t)} unreadCount={unreadCount} onMore={() => setSidebarOpen(true)} />
      <Toast message={toast.message} type={toast.type} onDismiss={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
}
