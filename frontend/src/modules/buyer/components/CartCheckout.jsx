/**
 * Cart (PRD §20) and checkout (PRD §21): address → delivery option →
 * payment → order summary → final confirmation with BUY NOW. Buy Again can
 * prefill the address, delivery option and payment method.
 */
import { useState, useEffect, useCallback } from 'react';
import { getCart, updateCartItem, removeCartItem, checkout, getAddresses, createAddress } from '../../../services/smb';
import { Icon, Button, Badge, Loading, ErrorNote, Input } from '../../../components/ui';
import { inr, dayDate, titleCase } from '../../../utils/format';

const PAYMENTS = [
  { key: 'upi', label: 'UPI', icon: 'qr_code_2', note: 'GPay, PhonePe, Paytm' },
  { key: 'card', label: 'Card', icon: 'credit_card', note: 'Debit or credit card' },
  { key: 'netbanking', label: 'Net Banking', icon: 'account_balance', note: 'All major banks' },
  { key: 'cod', label: 'Cash on Delivery', icon: 'payments', note: 'Pay when it arrives' },
];

function Section({ n, title, children }) {
  return (
    <section className="border border-outline-variant rounded-xl p-4">
      <h3 className="text-title-sm font-semibold text-on-surface flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-label-sm flex items-center justify-center">{n}</span>{title}
      </h3>
      {children}
    </section>
  );
}

export default function CartCheckout({ prefill, onClose, onCartChanged, onOrderPlaced }) {
  const [step, setStep] = useState(prefill?.startAtCheckout ? 'checkout' : 'cart');
  const [option, setOption] = useState(prefill?.deliveryOption || 'standard');
  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(prefill?.addressId || null);
  const [payment, setPayment] = useState(prefill?.paymentMethod || 'upi');
  const [adding, setAdding] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: 'Home', line1: '', city: '', state: '', postal_code: '', country: 'India' });
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);

  const load = useCallback(async () => {
    const c = await getCart(option).catch(() => null);
    setCart(c);
    onCartChanged?.(c);
  }, [option, onCartChanged]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getAddresses().then((list) => {
      setAddresses(list);
      setAddressId((cur) => cur || list.find((a) => a.is_default)?.id || list[0]?.id || null);
    }).catch(() => {});
  }, []);

  const change = async (fn) => {
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message || 'Could not update the cart');
    }
  };

  const saveAddress = async () => {
    if (!newAddr.line1.trim() || !newAddr.city.trim()) return setError('Address line and city are required');
    try {
      const a = await createAddress({ ...newAddr, is_default: addresses.length === 0 });
      setAddresses((prev) => [...prev, a]);
      setAddressId(a.id);
      setAdding(false);
    } catch (err) {
      setError(err.message || 'Could not save the address');
    }
  };

  const place = async () => {
    if (!addressId) return setError('Choose a delivery address');
    setPlacing(true);
    setError('');
    try {
      const orders = await checkout({ address_id: addressId, payment_method: payment, delivery_option: option });
      onCartChanged?.({ item_count: 0 });
      onOrderPlaced(orders);
    } catch (err) {
      setError(err.message || 'Checkout failed');
    } finally {
      setPlacing(false);
    }
  };

  const items = cart?.items || [];
  const unavailable = items.some((i) => !i.available);
  const expressOk = (cart?.groups || []).length > 0 && cart.groups.every((g) => g.delivery.express_available);
  const address = addresses.find((a) => a.id === addressId);

  const summary = () => (
    <dl className="space-y-1 text-body-md">
      <div className="flex justify-between"><dt className="text-on-surface-variant">Items ({cart.item_count})</dt><dd>{inr(cart.subtotal)}</dd></div>
      {cart.discount_total > 0 && <div className="flex justify-between text-emerald-700"><dt>Discounts & negotiated savings</dt><dd>−{inr(cart.discount_total)}</dd></div>}
      <div className="flex justify-between"><dt className="text-on-surface-variant">Delivery</dt><dd>{cart.delivery_total ? inr(cart.delivery_total) : 'Free'}</dd></div>
      <div className="flex justify-between text-title-md font-bold pt-1 border-t border-outline-variant"><dt>Total</dt><dd>{inr(cart.total)}</dd></div>
    </dl>
  );

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-surface-container-lowest flex flex-col animate-slide-in" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-2 px-4 h-14 border-b border-outline-variant">
          {step === 'checkout' && <button onClick={() => setStep('cart')} aria-label="Back to cart" className="p-1.5 rounded-full hover:bg-surface-container"><Icon name="arrow_back" /></button>}
          <h2 className="text-title-lg font-semibold text-on-surface flex-1">{step === 'cart' ? 'Your cart' : 'Checkout'}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-surface-container"><Icon name="close" /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <ErrorNote>{error}</ErrorNote>
          {!cart ? <Loading /> : items.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant">
              <Icon name="shopping_cart" size={48} className="opacity-30" />
              <p className="text-body-md mt-2">Your cart is empty.</p>
            </div>
          ) : step === 'cart' ? (
            <>
              {items.map((i) => (
                <div key={i.id} className="flex gap-3 border-b border-outline-variant/60 pb-3">
                  <div className="w-16 h-16 rounded-lg bg-surface-container overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {i.product_image_url ? <img src={i.product_image_url} alt="" className="w-full h-full object-cover" /> : <Icon name="inventory_2" className="text-on-surface-variant/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-label-md font-semibold text-on-surface truncate">{i.product_name}</p>
                    <p className="text-label-sm text-on-surface-variant">{[i.variant_label, i.seller_name].filter(Boolean).join(' · ')}</p>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-label-md font-bold">{inr(i.unit_price)}</span>
                      {i.listed_unit_price > i.unit_price && <span className="text-label-sm line-through text-on-surface-variant">{inr(i.listed_unit_price)}</span>}
                      {i.price_reason && <Badge tone={i.price_reason === 'negotiated' ? 'blue' : 'green'}>{titleCase(i.price_reason)}</Badge>}
                    </div>
                    {!i.available && <p className="text-label-sm text-error">Only {i.available_stock} available — reduce the quantity</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <button disabled={!!i.offer_id || i.quantity <= 1} onClick={() => change(() => updateCartItem(i.id, i.quantity - 1))} className="w-8 h-8 rounded-lg border border-outline-variant disabled:opacity-30" aria-label="Less">−</button>
                      <span className="w-8 text-center text-label-md">{i.quantity}</span>
                      <button disabled={!!i.offer_id} onClick={() => change(() => updateCartItem(i.id, i.quantity + 1))} className="w-8 h-8 rounded-lg border border-outline-variant disabled:opacity-30" aria-label="More">+</button>
                      <button onClick={() => change(() => removeCartItem(i.id))} className="ml-auto text-on-surface-variant hover:text-error" aria-label="Remove"><Icon name="delete" /></button>
                    </div>
                  </div>
                </div>
              ))}
              {summary()}
            </>
          ) : (
            <>
              <Section n={1} title="Delivery address">
                <div className="space-y-2">
                  {addresses.map((a) => (
                    <label key={a.id} className={`flex gap-2 p-3 rounded-lg border cursor-pointer ${addressId === a.id ? 'border-primary bg-primary-container/10' : 'border-outline-variant'}`}>
                      <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="accent-primary mt-1" />
                      <span className="text-label-md">
                        <strong>{a.label}</strong><br />
                        <span className="text-on-surface-variant">{[a.line1, a.line2, a.city, a.state, a.postal_code].filter(Boolean).join(', ')}</span>
                      </span>
                    </label>
                  ))}
                  {adding ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2"><Input placeholder="House / street" value={newAddr.line1} onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })} /></div>
                      <Input placeholder="City" value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} />
                      <Input placeholder="PIN code" value={newAddr.postal_code} onChange={(e) => setNewAddr({ ...newAddr, postal_code: e.target.value })} />
                      <Input placeholder="State" value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} />
                      <Input placeholder="Label (Home, Work)" value={newAddr.label} onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })} />
                      <div className="col-span-2 flex gap-2 justify-end">
                        <Button variant="secondary" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                        <Button size="sm" onClick={saveAddress}>Save address</Button>
                      </div>
                    </div>
                  ) : <Button variant="ghost" size="sm" icon="add" onClick={() => setAdding(true)}>Add a new address</Button>}
                </div>
              </Section>

              <Section n={2} title="Delivery option">
                {[{ key: 'standard', label: 'Standard' }, { key: 'express', label: 'Express (next day)' }].map((o) => (
                  <label key={o.key} className={`flex items-center gap-2 p-3 rounded-lg border mb-2 ${o.key === 'express' && !expressOk ? 'opacity-40' : 'cursor-pointer'} ${option === o.key ? 'border-primary bg-primary-container/10' : 'border-outline-variant'}`}>
                    <input type="radio" name="delivery" disabled={o.key === 'express' && !expressOk} checked={option === o.key} onChange={() => setOption(o.key)} className="accent-primary" />
                    <span className="text-label-md flex-1">{o.label}{o.key === 'express' && !expressOk && ' — not available for every item'}</span>
                  </label>
                ))}
                {cart.groups.map((g) => (
                  <p key={g.seller_id} className="text-label-sm text-on-surface-variant">
                    {g.seller_name}: arrives by <strong className="text-on-surface">{dayDate(g.delivery.expected_date)}</strong> · {g.delivery.charge ? inr(g.delivery.charge) : 'free delivery'}
                  </p>
                ))}
              </Section>

              <Section n={3} title="Payment">
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENTS.map((pm) => (
                    <button key={pm.key} onClick={() => setPayment(pm.key)} aria-pressed={payment === pm.key}
                      className={`text-left p-3 rounded-lg border ${payment === pm.key ? 'border-primary bg-primary-container/10' : 'border-outline-variant'}`}>
                      <Icon name={pm.icon} className="text-primary" />
                      <p className="text-label-md font-semibold text-on-surface">{pm.label}</p>
                      <p className="text-label-sm text-on-surface-variant">{pm.note}</p>
                    </button>
                  ))}
                </div>
                <p className="text-label-sm text-on-surface-variant mt-2">Payments are simulated in this environment — no money moves.</p>
              </Section>

              <Section n={4} title="Order summary">{summary()}</Section>

              <Section n={5} title="Confirm">
                <ul className="space-y-2">
                  {items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2 text-label-md">
                      <span className="min-w-0">
                        <span className="block text-on-surface truncate">{i.product_name}{i.variant_label ? ` (${i.variant_label})` : ''} × {i.quantity}</span>
                        <span className="block text-label-sm text-on-surface-variant">{i.seller_name}</span>
                      </span>
                      <span className="font-semibold">{inr(i.line_total)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-label-sm text-on-surface-variant mt-2">
                  Delivering to {address ? `${address.line1}, ${address.city}` : '—'} · {PAYMENTS.find((pm) => pm.key === payment)?.label}
                </p>
              </Section>
            </>
          )}
        </div>

        {cart && items.length > 0 && (
          <footer className="border-t border-outline-variant p-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-label-sm text-on-surface-variant">Total</p>
              <p className="text-title-lg font-bold text-on-surface">{inr(cart.total)}</p>
              {step === 'checkout' && !addressId && <p className="text-label-sm text-error">Add a delivery address to continue</p>}
              {unavailable && <p className="text-label-sm text-error">Some items are no longer available in that quantity</p>}
            </div>
            {step === 'cart' ? (
              <Button size="lg" disabled={unavailable} onClick={() => setStep('checkout')}>Proceed to checkout</Button>
            ) : (
              <Button size="lg" icon="lock" disabled={placing || !addressId || unavailable} onClick={place}>{placing ? 'Placing order…' : 'Buy now'}</Button>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}
