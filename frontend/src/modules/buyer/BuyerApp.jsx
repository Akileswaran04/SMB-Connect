/**
 * Buyer application (PRD §5): Home ("help me buy"), Catalogue ("let me
 * explore"), Orders, Assistant and Profile, with messages, cart and
 * notifications in the header.
 */
import { useState, useCallback, useEffect } from 'react';
import HomePage from './components/HomePage';
import CataloguePage from './components/CataloguePage';
import ProductPage from './components/ProductPage';
import BuyerInbox from './components/BuyerInbox';
import OrdersPage from './components/OrdersPage';
import OrderDetail from './components/OrderDetail';
import AssistantPage from './components/AssistantPage';
import ProfilePage from './components/ProfilePage';
import CartCheckout from './components/CartCheckout';
import OrderConfirmation from './components/OrderConfirmation';
import NotificationBell from '../../components/NotificationBell';
import Toast from '../../components/shared/Toast';
import { Icon } from '../../components/ui';
import { getCart, getPreferences } from '../../services/smb';

const TABS = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'catalogue', icon: 'storefront', label: 'Catalogue' },
  { key: 'orders', icon: 'receipt_long', label: 'Orders' },
  { key: 'assistant', icon: 'assistant', label: 'Assistant' },
  { key: 'profile', icon: 'person', label: 'Profile' },
];

export default function BuyerApp({ session, onLogout }) {
  const [tab, setTab] = useState('home');
  const [productId, setProductId] = useState(null);
  const [cart, setCart] = useState(null); // null = closed, else prefill object
  const [cartCount, setCartCount] = useState(0);
  const [confirmed, setConfirmed] = useState(null);
  const [orderView, setOrderView] = useState(null); // { id, action }
  const [chatId, setChatId] = useState(null);
  const [assistantInit, setAssistantInit] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'success' });

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const refreshCart = useCallback(() => getCart().then((c) => setCartCount(c.item_count)).catch(() => {}), []);
  const handleCartChanged = useCallback((c) => setCartCount(c?.item_count || 0), []);

  useEffect(() => {
    refreshCart();
    getPreferences().then(setPrefs).catch(() => {});
  }, [refreshCart]);

  const go = (key) => {
    setTab(key);
    setOrderView(null);
  };
  const openProduct = useCallback((p) => setProductId(p.id), []);
  const openOrder = useCallback((id, action) => {
    setProductId(null);
    setCart(null);
    setConfirmed(null);
    setTab('orders');
    setOrderView({ id, action });
  }, []);
  const openCart = useCallback((prefill = {}) => {
    setProductId(null);
    setCart({ ...prefill });
    refreshCart();
  }, [refreshCart]);
  const openChat = useCallback((conversationId) => {
    setProductId(null);
    setChatId(conversationId);
    setTab('inbox');
  }, []);
  const askAssistant = useCallback((context, message) => {
    setProductId(null);
    setAssistantInit({ context, message, key: Date.now() });
    setTab('assistant');
  }, []);

  const handleNotification = (n) => {
    const d = n.data || {};
    if (d.order_id) openOrder(d.order_id);
    else if (d.product_id) setProductId(d.product_id);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-surface-container-lowest border-b border-outline-variant">
        <div className="max-w-max-width mx-auto px-4 lg:px-10 h-14 flex items-center gap-2">
          <button onClick={() => go('home')} className="flex items-center gap-2 mr-auto" aria-label="SMBConnect home">
            <span className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center"><Icon name="handshake" size={18} /></span>
            <span className="text-title-md font-bold text-on-surface hidden sm:inline">SMBConnect</span>
          </button>
          <nav className="hidden lg:flex gap-1 mr-4">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => go(t.key)}
                className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-label-md ${tab === t.key ? 'bg-primary-container/15 text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'}`}>
                <Icon name={t.icon} size={18} filled={tab === t.key} />{t.label}
              </button>
            ))}
          </nav>
          <button onClick={() => { setChatId(null); go('inbox'); }} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant" aria-label="Messages">
            <Icon name="chat" filled={tab === 'inbox'} />
          </button>
          <NotificationBell onOpen={handleNotification} />
          <button onClick={() => openCart()} className="relative p-2 rounded-full hover:bg-surface-container text-on-surface-variant" aria-label={`Cart (${cartCount} items)`}>
            <Icon name="shopping_cart" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center">{cartCount > 99 ? '99+' : cartCount}</span>
            )}
          </button>
          <button onClick={onLogout} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant" aria-label="Log out"><Icon name="logout" /></button>
        </div>
      </header>

      <main className="max-w-max-width mx-auto px-4 lg:px-10 py-6 pb-24 lg:pb-8">
        {tab === 'home' && (
          <HomePage session={session} prefs={prefs} onOpenProduct={openProduct} onGoToCatalogue={() => go('catalogue')}
            onOpenOrder={openOrder} onOpenCart={openCart} onOpenChat={openChat} onAskAssistant={askAssistant} onToast={showToast} />
        )}
        {tab === 'catalogue' && <CataloguePage onOpenProduct={openProduct} />}
        {tab === 'orders' && (orderView ? (
          <OrderDetail key={orderView.id} orderId={orderView.id} initialAction={orderView.action} onBack={() => setOrderView(null)}
            onToast={showToast} onOpenCart={openCart} onChatOpened={openChat} />
        ) : (
          <OrdersPage onOpenOrder={openOrder} onOpenCart={openCart} onChatOpened={openChat} onToast={showToast} />
        ))}
        {tab === 'assistant' && (
          <AssistantPage key={assistantInit?.key || 'assistant'} session={session} prefs={prefs} initial={assistantInit}
            onOpenProduct={openProduct} onOpenOrder={openOrder} onOpenCart={openCart} onChatOpened={openChat} onToast={showToast} />
        )}
        {tab === 'profile' && <ProfilePage onToast={showToast} onPrefsChanged={setPrefs} />}
        {tab === 'inbox' && <BuyerInbox key={chatId || 'inbox'} openConversationId={chatId} onToast={showToast} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant z-30 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around items-center h-16">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => go(t.key)} className={`flex flex-col items-center justify-center w-16 py-1 ${tab === t.key ? 'text-primary' : 'text-on-surface-variant'}`}>
              <Icon name={t.icon} filled={tab === t.key} />
              <span className="text-label-sm">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {productId && (
        <ProductPage productId={productId} prefs={prefs} onClose={() => setProductId(null)} onToast={showToast}
          onCartChanged={refreshCart} onBuyNow={() => openCart({ startAtCheckout: true })} onChatOpened={openChat} onAskAssistant={askAssistant} />
      )}
      {cart && (
        <CartCheckout prefill={cart} onClose={() => setCart(null)} onToast={showToast}
          onCartChanged={handleCartChanged}
          onOrderPlaced={(orders) => { setCart(null); setConfirmed(orders); }} />
      )}
      {confirmed && <OrderConfirmation orders={confirmed} onTrack={(id) => openOrder(id)} onClose={() => setConfirmed(null)} />}

      <Toast message={toast.message} type={toast.type} onDismiss={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
}
