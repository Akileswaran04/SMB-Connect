/**
 * "Try for a better price" (PRD §18–19). The buyer sees a suggested offer
 * (or names a price and learns whether it's within the seller's range) and
 * nothing is sent until they tap Send. Accepted offers go into the cart at
 * the negotiated price; counters can be accepted or countered back.
 */
import { useState, useEffect, useCallback } from 'react';
import { negotiationSuggestion, sendOffer, offerThread, respondOffer, addToCart } from '../../../services/smb';
import { Button, Badge, Icon, inputClass } from '../../../components/ui';
import { inr, titleCase } from '../../../utils/format';

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
      onToast?.(status === 'accepted' ? 'Offer accepted!' : status === 'countered' ? offer.message : status === 'rejected'
        ? (offer.message || 'The seller declined that price') : 'Offer sent — we\'ll notify you when the seller replies.',
      status === 'rejected' ? 'error' : 'success');
      await load();
      setCheck(null);
    } catch (err) {
      onToast?.(err.message || 'Could not send offer', 'error');
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
      onToast?.(err.message || 'Could not respond', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toCart = async (offer) => {
    if (needsVariant && !variantId) return onToast?.('Choose a size/colour first', 'error');
    try {
      await addToCart({ offer_id: offer.id, variant_id: variantId ?? null });
      onToast?.(`Added to cart at ${inr(offer.offered_price)}`);
      onAddedToCart?.();
    } catch (err) {
      onToast?.(err.message || 'Could not add to cart', 'error');
    }
  };

  const latest = thread[thread.length - 1];
  const accepted = [...thread].reverse().find((o) => o.status === 'accepted' && !o.fulfilled_order_id);
  const sellerCounter = latest?.status === 'pending' && latest.offered_by === 'seller' ? latest : null;
  const waiting = latest?.status === 'pending' && latest.offered_by === 'buyer';

  if (!open) {
    return (
      <Button variant="outline" icon="sell" className="w-full" size="lg" onClick={() => setOpen(true)}>Try for a better price</Button>
    );
  }

  return (
    <div className="border border-outline-variant rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-title-sm font-semibold text-on-surface flex items-center gap-1.5"><Icon name="sell" size={18} /> Try for a better price</p>
        <button onClick={() => setOpen(false)} className="text-on-surface-variant" aria-label="Close"><Icon name="close" size={18} /></button>
      </div>
      {!suggestion ? <p className="text-label-md text-on-surface-variant">Checking…</p> : !suggestion.negotiation_enabled ? (
        <p className="text-label-md text-on-surface-variant">{suggestion.message || 'This seller has a fixed price for this item.'}</p>
      ) : (
        <>
          {accepted ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-label-md text-emerald-900">Deal agreed at <strong>{inr(accepted.offered_price)}</strong> × {accepted.quantity}</p>
              <Button size="sm" className="mt-2" icon="add_shopping_cart" onClick={() => toCart(accepted)}>Add to cart at this price</Button>
            </div>
          ) : sellerCounter ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <p className="text-label-md text-blue-900">The seller offers <strong>{inr(sellerCounter.offered_price)}</strong>.{sellerCounter.message ? ` ${sellerCounter.message}` : ''}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => respond(sellerCounter, 'accept')} disabled={busy}>Accept {inr(sellerCounter.offered_price)}</Button>
                <Button size="sm" variant="secondary" onClick={() => respond(sellerCounter, 'reject')} disabled={busy}>Decline</Button>
              </div>
              {suggestion.rounds_left > 0 && (
                <div className="flex gap-2">
                  <input type="number" value={counter} onChange={(e) => setCounter(e.target.value)} placeholder="Your counter (₹)" className={`${inputClass} h-9`} />
                  <Button size="sm" variant="outline" disabled={!counter || busy} onClick={() => respond(sellerCounter, 'counter')}>Counter</Button>
                </div>
              )}
            </div>
          ) : waiting ? (
            <p className="text-label-md text-on-surface-variant">Your offer of {inr(latest.offered_price)} is with the seller. We'll notify you when they reply.</p>
          ) : suggestion.rounds_left === 0 ? (
            <p className="text-label-md text-on-surface-variant">You've used all your offers on this item. You can still buy it at {inr(suggestion.listed_price)}.</p>
          ) : (
            <>
              <p className="text-label-md text-on-surface-variant">
                Listed at {inr(suggestion.listed_price)}. Suggested offer: <strong className="text-on-surface">{inr(suggestion.suggested_price)}</strong>
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2 text-on-surface-variant">₹</span>
                  <input type="number" min="1" value={price} onChange={(e) => checkPrice(e.target.value)} aria-label="Your offer"
                    className={`${inputClass} pl-7`} />
                </div>
                <Button onClick={() => submit(price)} disabled={!price || busy || check?.within_range === false}>
                  {busy ? 'Sending…' : `Send ${price ? inr(Number(price)) : ''}`}
                </Button>
              </div>
              {check?.message && (
                <div className={`text-label-md rounded-lg px-3 py-2 ${check.within_range === false ? 'bg-amber-50 text-amber-900' : 'bg-surface-container text-on-surface'}`}>
                  {check.message}
                  {check.within_range === false && (
                    <Button size="sm" variant="outline" className="ml-2" onClick={() => checkPrice(String(check.suggested_price))}>
                      Try {inr(check.suggested_price)}
                    </Button>
                  )}
                </div>
              )}
              <p className="text-label-sm text-on-surface-variant">Nothing is sent until you tap Send. {suggestion.rounds_left != null && `${suggestion.rounds_left} offer${suggestion.rounds_left === 1 ? '' : 's'} left.`}</p>
            </>
          )}
          {thread.length > 0 && (
            <details className="text-label-sm">
              <summary className="text-primary cursor-pointer">Offer history ({thread.length})</summary>
              <ul className="mt-2 space-y-1">
                {thread.map((o) => (
                  <li key={o.id} className="flex justify-between gap-2 text-on-surface-variant">
                    <span>{o.offered_by === 'buyer' ? 'You' : 'Seller'} offered {inr(o.offered_price)}</span>
                    <Badge tone={o.status === 'accepted' ? 'green' : o.status === 'rejected' ? 'red' : 'slate'}>{titleCase(o.status)}</Badge>
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
