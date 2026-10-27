/**
 * "Try for a better price" (PRD §18–19). The buyer sees a suggested offer
 * (or names a price and learns whether it's within the seller's range) and
 * nothing is sent until they tap Send. Accepted offers go into the cart at
 * the negotiated price; counters can be accepted or countered back.
 */
import { useState, useEffect, useCallback } from 'react';
import { negotiationSuggestion, sendOffer, offerThread, respondOffer, addToCart } from '../../../services/smb';
import { Button, Badge, Icon, inputClass } from '../../../components/ui';
import { inr, statusText } from '../../../utils/format';
import { t } from '../../../i18n';

export default function NegotiationPanel({ product, variantId, needsVariant, quantity, onToast, onAddedToCart }) {
  const [open, setOpen] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [price, setPrice] = useState('');
  const [check, setCheck] = useState(null);
  const [thread, setThread] = useState([]);
  const [busy, setBusy] = useState(false);
  const [counter, setCounter] = useState('');

  const load = useCallback(async () => {
    const [s, t] = await Promise.all([
      negotiationSuggestion(product.id, quantity).catch(() => null),
      offerThread(product.id).catch(() => []),
    ]);
    setSuggestion(s);
    setThread(t);
    if (s?.negotiation_enabled) setPrice(String(s.suggested_price));
  }, [product.id, quantity]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const checkPrice = async (value) => {
    setPrice(value);
    setCheck(null);
    const n = Number(value);
    if (!n) return;
    setCheck(await negotiationSuggestion(product.id, quantity, n).catch(() => null));
  };

  const submit = async (amount) => {
    setBusy(true);
    try {
      const offer = await sendOffer(product.id, Number(amount), quantity);
      const status = offer.status;
      onToast?.(status === 'accepted' ? t('Your price was accepted!') : status === 'countered' ? offer.message : status === 'rejected'
        ? (offer.message || t('The seller said no to that price')) : t('Sent — we will tell you when the seller replies.'),
      status === 'rejected' ? 'error' : 'success');
      await load();
      setCheck(null);
    } catch (err) {
      onToast?.(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const respond = async (offer, action) => {
    setBusy(true);
    try {
      await respondOffer(offer.id, action, action === 'counter' ? Number(counter) : undefined);
      setCounter('');
      await load();
    } catch (err) {
      onToast?.(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toCart = async (offer) => {
    if (needsVariant && !variantId) return onToast?.(t('Please choose a size / colour first'), 'error');
    try {
      await addToCart({ offer_id: offer.id, variant_id: variantId ?? null });
      onToast?.(t('Added to cart at {price}', { price: inr(offer.offered_price) }));
      onAddedToCart?.();
    } catch (err) {
      onToast?.(err.message, 'error');
    }
  };

  const latest = thread[thread.length - 1];
  const accepted = [...thread].reverse().find((o) => o.status === 'accepted' && !o.fulfilled_order_id);
  const sellerCounter = latest?.status === 'pending' && latest.offered_by === 'seller' ? latest : null;
  const waiting = latest?.status === 'pending' && latest.offered_by === 'buyer';

  if (!open) {
    return (
      <Button variant="outline" icon="sell" className="w-full" size="lg" onClick={() => setOpen(true)}>{t('Ask for a lower price')}</Button>
    );
  }

  return (
    <div className="border border-outline-variant rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-title-sm font-semibold text-on-surface flex items-center gap-1.5"><Icon name="sell" size={18} /> {t('Ask for a lower price')}</p>
        <button onClick={() => setOpen(false)} className="w-10 h-10 flex items-center justify-center text-on-surface-variant" aria-label={t('Close')}><Icon name="close" size={20} /></button>
      </div>
      {!suggestion ? <p className="text-label-md text-on-surface-variant">{t('Please wait…')}</p> : !suggestion.negotiation_enabled ? (
        <p className="text-label-md text-on-surface-variant">{suggestion.message || t('This seller does not bargain on this item.')}</p>
      ) : (
        <>
          {accepted ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-label-md text-emerald-900">{t('Deal done at')} <strong>{inr(accepted.offered_price)}</strong> × {accepted.quantity}</p>
              <Button size="sm" className="mt-2" icon="add_shopping_cart" onClick={() => toCart(accepted)}>{t('Add to cart at this price')}</Button>
            </div>
          ) : sellerCounter ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <p className="text-label-md text-blue-900">{t('The seller says')} <strong>{inr(sellerCounter.offered_price)}</strong>.{sellerCounter.message ? ` ${sellerCounter.message}` : ''}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => respond(sellerCounter, 'accept')} disabled={busy}>{t('Accept {price}', { price: inr(sellerCounter.offered_price) })}</Button>
                <Button size="sm" variant="secondary" onClick={() => respond(sellerCounter, 'reject')} disabled={busy}>{t('Say no')}</Button>
              </div>
              {suggestion.rounds_left > 0 && (
                <div className="flex gap-2">
                  <input type="number" value={counter} onChange={(e) => setCounter(e.target.value)} inputMode="decimal" placeholder={t('Your price (₹)')} className={inputClass} />
                  <Button size="sm" variant="outline" disabled={!counter || busy} onClick={() => respond(sellerCounter, 'counter')}>{t('Offer this price')}</Button>
                </div>
              )}
            </div>
          ) : waiting ? (
            <p className="text-label-md text-on-surface-variant">{t('You offered {price}. We will tell you when the seller replies.', { price: inr(latest.offered_price) })}</p>
          ) : suggestion.rounds_left === 0 ? (
            <p className="text-label-md text-on-surface-variant">{t('You have no more tries for this item. You can still buy it at {price}.', { price: inr(suggestion.listed_price) })}</p>
          ) : (
            <>
              <p className="text-label-md text-on-surface-variant">
                {t('Price {price}. Try offering', { price: inr(suggestion.listed_price) })} <strong className="text-on-surface">{inr(suggestion.suggested_price)}</strong>
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2 text-on-surface-variant">₹</span>
                  <input type="number" inputMode="decimal" min="1" value={price} onChange={(e) => checkPrice(e.target.value)} aria-label={t('Your price (₹)')}
                    className={`${inputClass} pl-7`} />
                </div>
                <Button onClick={() => submit(price)} disabled={!price || busy || check?.within_range === false}>
                  {busy ? t('Please wait…') : `${t('Send')} ${price ? inr(Number(price)) : ''}`}
                </Button>
              </div>
              {check?.message && (
                <div className={`text-label-md rounded-lg px-3 py-2 ${check.within_range === false ? 'bg-amber-50 text-amber-900' : 'bg-surface-container text-on-surface'}`}>
                  {check.message}
                  {check.within_range === false && (
                    <Button size="sm" variant="outline" className="ml-2" onClick={() => checkPrice(String(check.suggested_price))}>
                      {t('Try {price}', { price: inr(check.suggested_price) })}
                    </Button>
                  )}
                </div>
              )}
              <p className="text-label-sm text-on-surface-variant">{t('Nothing is sent until you tap Send.')} {suggestion.rounds_left != null && t('{n} tries left.', { n: suggestion.rounds_left })}</p>
            </>
          )}
          {thread.length > 0 && (
            <details className="text-label-sm">
              <summary className="text-primary cursor-pointer min-h-10 flex items-center">{t('Past offers')} ({thread.length})</summary>
              <ul className="mt-2 space-y-1">
                {thread.map((o) => (
                  <li key={o.id} className="flex justify-between gap-2 text-on-surface-variant">
                    <span>{o.offered_by === 'buyer' ? t('You') : t('Seller')}: {inr(o.offered_price)}</span>
                    <Badge tone={o.status === 'accepted' ? 'green' : o.status === 'rejected' ? 'red' : 'slate'}>{statusText(o.status)}</Badge>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
