/**
 * Buyer application (PRD §5): Home ("help me buy"), Shop ("let me
 * explore"), My Orders, Ask and Profile, with messages, cart and
 * notifications in the header.
 *
 * The phone's Back button works like people expect: it closes the product,
 * cart or order that is open (or returns to Home) instead of leaving the
 * site. Every screen that opens pushes a history entry; closing goes back.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
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
import { t } from '../../i18n';

const TABS = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'catalogue', icon: 'storefront', label: 'Shop' },
  { key: 'orders', icon: 'receipt_long', label: 'My Orders' },
  { key: 'assistant', icon: 'mic', label: 'Ask' },
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

  // Back button: close the topmost open thing.
  const layers = useRef({});
  useEffect(() => { layers.current = { productId, cart, confirmed, orderView, tab }; });
  useEffect(() => {
    const onPop = () => {
      const l = layers.current;
      if (l.confirmed) setConfirmed(null);
      else if (l.cart) setCart(null);
      else if (l.productId) setProductId(null);
      else if (l.orderView) setOrderView(null);
      else if (l.tab !== 'home') setTab('home');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const push = () => window.history.pushState({ smb: true }, '');
  const back = useCallback(() => window.history.back(), []);

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const refreshCart = useCallback(() => getCart().then((c) => setCartCount(c.item_count)).catch(() => {}), []);
  const handleCartChanged = useCallback((c) => setCartCount(c?.item_count || 0), []);

  useEffect(() => {
    refreshCart();
    getPreferences().then(setPrefs).catch(() => {});
  }, [refreshCart]);

  const go = (key) => {
    if (key !== layers.current.tab) push();
    setTab(key);
    setOrderView(null);
  };
  const openProduct = useCallback((p) => { push(); setProductId(p.id); }, []);
  const openOrder = useCallback((id, action) => {
    push();
    setProductId(null);
    setCart(null);
    setConfirmed(null);
    setTab('orders');
    setOrderView({ id, action });
  }, []);
  const openCart = useCallback((prefill = {}) => {
    push();
    setProductId(null);
    setCart({ ...prefill });
    refreshCart();
  }, [refreshCart]);
  const openChat = useCallback((conversationId) => {
    push();
    setProductId(null);
    setChatId(conversationId);
    setTab('inbox');
  }, []);
  const askAssistant = useCallback((context, message) => {
    push();
    setProductId(null);
    setAssistantInit({ context, message, key: Date.now() });
    setTab('assistant');
  }, []);

  const handleNotification = (n) => {
    const d = n.data || {};
    if (d.order_id) openOrder(d.order_id);
    else if (d.product_id) openProduct({ id: d.product_id });
  };

  const headerBtn = 'relative flex flex-col items-center justify-center min-w-12 h-12 px-1 rounded-xl hover:bg-surface-container text-on-surface-variant';

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-surface-container-lowest border-b border-outline-variant">
        <div className="max-w-max-width mx-auto px-3 lg:px-10 h-16 flex items-center gap-1">
          <button onClick={() => go('home')} className="flex items-center gap-2 mr-auto" aria-label={t('Home')}>
            <span className="w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center"><Icon name="handshake" size={20} /></span>
            <span className="text-title-md font-bold text-on-surface hidden sm:inline">SMBConnect</span>
          </button>
          <nav className="hidden lg:flex gap-1 mr-4">
            {TABS.map((x) => (
              <button key={x.key} onClick={() => go(x.key)}
                className={`flex items-center gap-1.5 px-3 h-10 rounded-lg text-label-md ${tab === x.key ? 'bg-primary-container/15 text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'}`}>
                <Icon name={x.icon} size={20} filled={tab === x.key} />{t(x.label)}
              </button>
            ))}
          </nav>
          <button onClick={() => { setChatId(null); go('inbox'); }} className={headerBtn}>
            <Icon name="chat" filled={tab === 'inbox'} /><span className="text-[11px] leading-tight">{t('Chats')}</span>
          </button>
          <NotificationBell onOpen={handleNotification} />
          <button onClick={() => openCart()} className={headerBtn} aria-label={t('Cart ({n} items)', { n: cartCount })}>
            <Icon name="shopping_cart" /><span className="text-[11px] leading-tight">{t('Cart')}</span>
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 min-w-[20px] h-[20px] px-1 rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center">{cartCount > 99 ? '99+' : cartCount}</span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-max-width mx-auto px-4 lg:px-10 py-6 pb-24 lg:pb-8">
        {tab === 'home' && (
          <HomePage session={session} prefs={prefs} onOpenProduct={openProduct} onGoToCatalogue={() => go('catalogue')}
            onOpenOrder={openOrder} onOpenCart={openCart} onOpenChat={openChat} onAskAssistant={askAssistant} onToast={showToast} />
        )}
        {tab === 'catalogue' && <CataloguePage onOpenProduct={openProduct} />}
        {tab === 'orders' && (orderView ? (
          <OrderDetail key={orderView.id} orderId={orderView.id} initialAction={orderView.action} onBack={back}
            onToast={showToast} onOpenCart={openCart} onChatOpened={openChat} />
        ) : (
          <OrdersPage onOpenOrder={openOrder} onOpenCart={openCart} onChatOpened={openChat} onToast={showToast} onShop={() => go('home')} />
        ))}
        {tab === 'assistant' && (
          <AssistantPage key={assistantInit?.key || 'assistant'} session={session} prefs={prefs} initial={assistantInit}
            onOpenProduct={openProduct} onOpenOrder={openOrder} onOpenCart={openCart} onChatOpened={openChat} onToast={showToast} />
        )}
        {tab === 'profile' && <ProfilePage onToast={showToast} onPrefsChanged={setPrefs} onLogout={onLogout} />}
        {tab === 'inbox' && <BuyerInbox key={chatId || 'inbox'} openConversationId={chatId} onToast={showToast} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant z-30 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around items-center h-16">
          {TABS.map((x) => (
            <button key={x.key} onClick={() => go(x.key)} className={`flex flex-col items-center justify-center flex-1 h-14 ${tab === x.key ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>
              <Icon name={x.icon} filled={tab === x.key} />
              <span className="text-label-sm">{t(x.label)}</span>
            </button>
          ))}
        </div>
      </nav>

      {productId && (
        <ProductPage productId={productId} prefs={prefs} onClose={back} onToast={showToast}
          onCartChanged={refreshCart} onBuyNow={() => { setProductId(null); setCart({ startAtCheckout: true }); refreshCart(); }}
          onChatOpened={openChat} onAskAssistant={askAssistant} />
      )}
      {cart && (
        <CartCheckout prefill={cart} onClose={back} onToast={showToast} onShop={() => { setCart(null); setTab('catalogue'); }}
          onCartChanged={handleCartChanged}
          onOrderPlaced={(orders) => { setCart(null); setConfirmed(orders); }} />
      )}
      {confirmed && <OrderConfirmation orders={confirmed} onTrack={(id) => openOrder(id)} onClose={back} />}

      <Toast message={toast.message} type={toast.type} onDismiss={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
}
