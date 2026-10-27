/**
 * Cart (PRD §20) and checkout (PRD §21): address → delivery → payment →
 * summary → "Place order". A 6-digit PIN code fills in city and state; the
 * payment method starts on the buyer's saved choice (Cash on Delivery for a
 * first order). Buy Again can prefill the address, delivery and payment.
 */
import { useState, useEffect, useCallback } from 'react';
import { getCart, updateCartItem, removeCartItem, checkout, getAddresses, createAddress, getBuyerProfile } from '../../../services/smb';
import { Icon, Button, Badge, Loading, ErrorNote, Empty } from '../../../components/ui';
import AddressForm, { EMPTY_ADDRESS } from '../../../components/AddressForm';
import { inr, dayDate, titleCase, paymentText } from '../../../utils/format';
import { t } from '../../../i18n';

const PAYMENTS = [
  { key: 'cod', label: 'Cash on delivery', icon: 'payments', note: 'Pay when it arrives' },
  { key: 'upi', label: 'UPI', icon: 'qr_code_2', note: 'GPay, PhonePe, Paytm' },
  { key: 'card', label: 'Card', icon: 'credit_card', note: 'Debit or credit card' },
  { key: 'netbanking', label: 'Net banking', icon: 'account_balance', note: 'All major banks' },
];
function Section({ n, title, children }) {
  return (
    <section className="border border-outline-variant rounded-xl p-4">
      <h3 className="text-title-sm font-semibold text-on-surface flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-full bg-primary text-on-primary text-label-md flex items-center justify-center">{n}</span>{title}
      </h3>
      {children}
    </section>
  );
}

export default function CartCheckout({ prefill, onClose, onCartChanged, onOrderPlaced, onShop }) {
  const [step, setStep] = useState(prefill?.startAtCheckout ? 'checkout' : 'cart');
  const [option, setOption] = useState(prefill?.deliveryOption || 'standard');
  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(prefill?.addressId || null);
  const [payment, setPayment] = useState(prefill?.paymentMethod || null);
  const [adding, setAdding] = useState(false);
  const [newAddr, setNewAddr] = useState(EMPTY_ADDRESS);
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);

  const load = useCallback(async () => {
    try {
      const c = await getCart(option);
      setCart(c);
      onCartChanged?.(c);
    } catch (err) {
      setError(err.message);
      setCart((c) => c || { items: [], groups: [] });
    }
  }, [option, onCartChanged]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getAddresses().then((list) => {
      setAddresses(list);
      setAddressId((cur) => cur || list.find((a) => a.is_default)?.id || list[0]?.id || null);
      if (!list.length) setAdding(true);
    }).catch(() => {});
    getBuyerProfile().then((p) => setPayment((cur) => cur || p.preferred_payment_method || 'cod')).catch(() => setPayment((cur) => cur || 'cod'));
  }, []);

  const change = async (fn) => {
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveAddress = async () => {
    if (!newAddr.line1.trim() || !newAddr.city.trim()) return setError(t('Please fill in the house/street and city'));
    if (newAddr.postal_code && newAddr.postal_code.length !== 6) return setError(t('PIN code must be 6 digits'));
    try {
      const a = await createAddress({ ...newAddr, is_default: addresses.length === 0 });
      setAddresses((prev) => [...prev, a]);
      setAddressId(a.id);
      setAdding(false);
      setNewAddr(EMPTY_ADDRESS);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const place = async () => {
    if (!addressId) return setError(t('Please add a delivery address'));
    setPlacing(true);
    setError('');
    try {
      const orders = await checkout({ address_id: addressId, payment_method: payment || 'cod', delivery_option: option });
      onCartChanged?.({ item_count: 0 });
      onOrderPlaced(orders);
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacing(false);
    }
  };

  const items = cart?.items || [];
  const unavailable = items.some((i) => !i.available);
  const expressOk = (cart?.groups || []).length > 0 && cart.groups.every((g) => g.delivery.express_available);
  const address = addresses.find((a) => a.id === addressId);
  const qtyBtn = 'w-11 h-11 rounded-lg border border-outline-variant text-title-md disabled:opacity-30';

  const summary = () => (
    <dl className="space-y-1 text-body-md">
      <div className="flex justify-between"><dt className="text-on-surface-variant">{t('Items')} ({cart.item_count})</dt><dd>{inr(cart.subtotal)}</dd></div>
      {cart.discount_total > 0 && <div className="flex justify-between text-emerald-700"><dt>{t('You save')}</dt><dd>−{inr(cart.discount_total)}</dd></div>}
      <div className="flex justify-between"><dt className="text-on-surface-variant">{t('Delivery')}</dt><dd>{cart.delivery_total ? inr(cart.delivery_total) : t('Free')}</dd></div>
      <div className="flex justify-between text-title-md font-bold pt-1 border-t border-outline-variant"><dt>{t('Total')}</dt><dd>{inr(cart.total)}</dd></div>
    </dl>
  );

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-surface-container-lowest flex flex-col animate-slide-in" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-2 px-4 h-16 border-b border-outline-variant">
          {step === 'checkout' && <button onClick={() => setStep('cart')} aria-label={t('Back to cart')} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container"><Icon name="arrow_back" /></button>}
          <h2 className="text-title-lg font-semibold text-on-surface flex-1">{step === 'cart' ? t('Your cart') : t('Place your order')}</h2>
          <button onClick={onClose} aria-label={t('Close')} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container"><Icon name="close" /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <ErrorNote>{error}</ErrorNote>
          {!cart ? <Loading /> : items.length === 0 ? (
            <Empty icon="shopping_cart" title={t('Your cart is empty')}
              action={onShop && <Button size="lg" icon="storefront" onClick={onShop}>{t('Start shopping')}</Button>} />
          ) : step === 'cart' ? (
            <>
              {items.map((i) => (
                <div key={i.id} className="flex gap-3 border-b border-outline-variant/60 pb-3">
                  <div className="w-16 h-16 rounded-lg bg-surface-container overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {i.product_image_url ? <img src={i.product_image_url} alt="" className="w-full h-full object-cover" /> : <Icon name="inventory_2" className="text-on-surface-variant/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-label-md font-semibold text-on-surface">{i.product_name}</p>
                    <p className="text-label-sm text-on-surface-variant">{[i.variant_label, i.seller_name].filter(Boolean).join(' · ')}</p>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-label-md font-bold">{inr(i.unit_price)}</span>
                      {i.listed_unit_price > i.unit_price && <span className="text-label-sm line-through text-on-surface-variant">{inr(i.listed_unit_price)}</span>}
                      {i.price_reason && <Badge tone={i.price_reason === 'negotiated' ? 'blue' : 'green'}>{i.price_reason === 'negotiated' ? t('Your bargained price') : t(titleCase(i.price_reason))}</Badge>}
                    </div>
                    {!i.available && <p className="text-label-md text-error">{t('Only {n} left — please reduce the quantity', { n: i.available_stock })}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <button disabled={!!i.offer_id || i.quantity <= 1} onClick={() => change(() => updateCartItem(i.id, i.quantity - 1))} className={qtyBtn} aria-label={t('One less')}>−</button>
                      <span className="w-8 text-center text-title-sm font-semibold">{i.quantity}</span>
                      <button disabled={!!i.offer_id} onClick={() => change(() => updateCartItem(i.id, i.quantity + 1))} className={qtyBtn} aria-label={t('One more')}>+</button>
                      <button onClick={() => window.confirm(t('Remove {name} from your cart?', { name: i.product_name })) && change(() => removeCartItem(i.id))}
                        className="ml-auto h-11 px-3 rounded-lg inline-flex items-center gap-1 text-label-md text-on-surface-variant hover:text-error" aria-label={t('Remove')}>
                        <Icon name="delete" />{t('Remove')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {summary()}
            </>
          ) : (
            <>
              <Section n={1} title={t('Where should we deliver?')}>
                <div className="space-y-2">
                  {addresses.map((a) => (
                    <label key={a.id} className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${addressId === a.id ? 'border-primary bg-primary-container/10' : 'border-outline-variant'}`}>
                      <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="w-5 h-5 accent-primary mt-0.5" />
                      <span className="text-label-md">
                        <strong>{t(a.label)}</strong><br />
                        <span className="text-on-surface-variant">{[a.line1, a.line2, a.city, a.state, a.postal_code].filter(Boolean).join(', ')}</span>
                      </span>
                    </label>
                  ))}
                  {adding ? (
                    <div className="space-y-2">
                      <AddressForm value={newAddr} onChange={setNewAddr} />
                      <div className="flex gap-2 justify-end">
                        {addresses.length > 0 && <Button variant="secondary" onClick={() => setAdding(false)}>{t('Cancel')}</Button>}
                        <Button onClick={saveAddress}>{t('Save address')}</Button>
                      </div>
                    </div>
                  ) : <Button variant="ghost" icon="add" onClick={() => setAdding(true)}>{t('Add a new address')}</Button>}
                </div>
              </Section>

              <Section n={2} title={t('How fast?')}>
                {[{ key: 'standard', label: 'Normal delivery' }, { key: 'express', label: 'Next-day delivery' }].map((o) => (
                  <label key={o.key} className={`flex items-center gap-3 p-3 rounded-lg border mb-2 ${o.key === 'express' && !expressOk ? 'opacity-40' : 'cursor-pointer'} ${option === o.key ? 'border-primary bg-primary-container/10' : 'border-outline-variant'}`}>
                    <input type="radio" name="delivery" disabled={o.key === 'express' && !expressOk} checked={option === o.key} onChange={() => setOption(o.key)} className="w-5 h-5 accent-primary" />
                    <span className="text-label-md flex-1">{t(o.label)}{o.key === 'express' && !expressOk && ` — ${t('not possible for every item')}`}</span>
                  </label>
                ))}
                {cart.groups.map((g) => (
                  <p key={g.seller_id} className="text-label-md text-on-surface-variant">
                    {g.seller_name}: {t('arrives by')} <strong className="text-on-surface">{dayDate(g.delivery.expected_date)}</strong> · {g.delivery.charge ? inr(g.delivery.charge) : t('free delivery')}
                  </p>
                ))}
              </Section>

              <Section n={3} title={t('How will you pay?')}>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENTS.map((pm) => (
                    <button key={pm.key} onClick={() => setPayment(pm.key)} aria-pressed={payment === pm.key}
                      className={`text-left p-3 rounded-lg border-2 ${payment === pm.key ? 'border-primary bg-primary-container/10' : 'border-outline-variant'}`}>
                      <Icon name={pm.icon} className="text-primary" />
                      <p className="text-label-md font-semibold text-on-surface">{t(pm.label)}</p>
                      <p className="text-label-sm text-on-surface-variant">{t(pm.note)}</p>
                    </button>
                  ))}
                </div>
                {import.meta.env.DEV && <p className="text-label-sm text-on-surface-variant mt-2">Development: payments are simulated — no money moves.</p>}
              </Section>

              <Section n={4} title={t('Check your order')}>
                <ul className="space-y-2 mb-3">
                  {items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2 text-label-md">
                      <span className="min-w-0">
                        <span className="block text-on-surface">{i.quantity} × {i.product_name}{i.variant_label ? ` (${i.variant_label})` : ''}</span>
                        <span className="block text-label-sm text-on-surface-variant">{i.seller_name}</span>
                      </span>
                      <span className="font-semibold">{inr(i.line_total)}</span>
                    </li>
                  ))}
                </ul>
                {summary()}
                <p className="text-label-md text-on-surface-variant mt-2">
                  {t('Delivering to')} {address ? `${address.line1}, ${address.city}` : '—'} · {paymentText(payment)}
                </p>
              </Section>
            </>
          )}
        </div>

        {cart && items.length > 0 && (
          <footer className="border-t border-outline-variant p-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-label-sm text-on-surface-variant">{t('Total')}</p>
              <p className="text-title-lg font-bold text-on-surface">{inr(cart.total)}</p>
              {step === 'checkout' && !addressId && <p className="text-label-sm text-error">{t('Add a delivery address to continue')}</p>}
              {unavailable && <p className="text-label-sm text-error">{t('Some items are not available in that quantity')}</p>}
            </div>
            {step === 'cart' ? (
              <Button size="lg" icon="arrow_forward" disabled={unavailable} onClick={() => setStep('checkout')}>{t('Continue')}</Button>
            ) : (
              <Button size="lg" icon="check" disabled={placing || !addressId || unavailable} onClick={place}>{placing ? t('Please wait…') : t('Place order')}</Button>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}
