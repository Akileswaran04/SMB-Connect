
import { useState, useCallback, useEffect } from 'react';
import HomePage from './components/HomePage';
import DiscoverPage from './components/DiscoverPage';
import ProductDetail from './components/ProductDetail';
import BuyerInbox from './components/BuyerInbox';
import OrdersPage from './components/OrdersPage';
import BuyerProfilePage from './components/BuyerProfilePage';
import { CartDrawer } from '../cart';
import Toast from '../../components/shared/Toast';
import { getSession, clearSession, getCart } from '../../services/storage';

const TABS = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'discover', icon: 'search', label: 'Catalogue' },
  { key: 'inbox', icon: 'chat', label: 'Inbox' },
  { key: 'orders', icon: 'receipt_long', label: 'Orders' },
  { key: 'profile', icon: 'person', label: 'Profile' },
];

export default function BuyerApp({ onLogout }) {
  const session = getSession();
  const [activeTab, setActiveTab] = useState('home');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [inboxKey, setInboxKey] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [ordersKey, setOrdersKey] = useState(0);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    getCart().then((c) => setCartCount(c.itemCount)).catch(() => {});
  }, []);

  const handleCartUpdate = useCallback((cart) => {
    setCartCount(cart.itemCount);
  }, []);

  const handleOrderPlaced = useCallback(() => {
    setActiveTab('orders');
    setOrdersKey((k) => k + 1);
  }, []);

  const handleChatOpened = useCallback((conversationId) => {
    setSelectedProduct(null);
    setActiveTab('inbox');
    setInboxKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-surface-container-lowest border-b border-outline-variant">
        <div className="max-w-max-width mx-auto px-4 lg:px-10 h-16 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
          </div>
          <div className="flex-1">
            <p className="text-label-md text-on-surface font-bold leading-tight">MSME Connect</p>
            <p className="text-label-sm text-on-surface-variant leading-tight">Buyer · {session?.email}</p>
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 rounded-full hover:bg-surface-container text-on-surface-variant"
            title="Cart"
          >
            <span className="material-symbols-outlined">shopping_cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { clearSession(); onLogout(); }}
            className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant"
            title="Logout"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>

        <nav className="max-w-max-width mx-auto px-4 lg:px-10 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-label-md font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-on-surface-variant hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-max-width mx-auto px-4 lg:px-10 py-6 pb-24 sm:pb-6">
        {activeTab === 'home' && <HomePage onOpenProduct={setSelectedProduct} onGoToCatalogue={() => setActiveTab('discover')} />}
        {activeTab === 'discover' && <DiscoverPage onOpenProduct={setSelectedProduct} />}
        {activeTab === 'inbox' && <BuyerInbox key={inboxKey} buyerId={session?.buyerId} onToast={showToast} />}
        {activeTab === 'orders' && <OrdersPage key={ordersKey} onToast={showToast} />}
        {activeTab === 'profile' && <BuyerProfilePage onToast={showToast} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant z-50 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around items-center h-16">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col items-center justify-center w-16 py-1 ${activeTab === tab.key ? 'text-primary' : 'text-on-surface-variant'}`}
            >
              <span className={`material-symbols-outlined ${activeTab === tab.key ? 'filled' : ''}`}>{tab.icon}</span>
              <span className="text-label-sm">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {selectedProduct && (
        <ProductDetail
          productId={selectedProduct.id}
          sellerId={selectedProduct.seller_id}
          onClose={() => setSelectedProduct(null)}
          onChatOpened={handleChatOpened}
          onToast={showToast}
          onCartUpdate={handleCartUpdate}
          onOrderPlaced={handleOrderPlaced}
        />
      )}

      {cartOpen && (
        <CartDrawer
          onClose={() => setCartOpen(false)}
          onToast={showToast}
          onCartUpdate={handleCartUpdate}
          onOrderPlaced={handleOrderPlaced}
        />
      )}

      <Toast message={toast.message} type={toast.type} onDismiss={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
}