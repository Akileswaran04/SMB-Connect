/**
 * NegotiationPanel — "Try for a better price" (PRD §18). Shows an
 * AI-suggested opening offer the buyer must explicitly approve before it's
 * sent, the running thread, and — once an offer is accepted — a minimal
 * checkout at the negotiated price.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  getNegotiationSuggestion, createNegotiationOffer, respondToOffer,
  getNegotiationThread, getAddresses, createAddress, checkoutOffer,
} from '../../../services/storage';

export default function NegotiationPanel({ product, quantity, onToast, onOrderPlaced }) {
  const [suggestion, setSuggestion] = useState(null);
  const [open, setOpen] = useState(false);
  const [customOffer, setCustomOffer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [thread, setThread] = useState([]);

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: 'Home', line1: '', city: '' });
  const [placingOrder, setPlacingOrder] = useState(false);

  const refreshThread = useCallback(async () => {
    const t = await getNegotiationThread(product.id);
    setThread(t);
    return t;
  }, [product.id]);

  useEffect(() => {
    let cancelled = false;
    getNegotiationSuggestion(product.id, quantity).then((s) => {
      if (!cancelled) setSuggestion(s);
    });
    return () => { cancelled = true; };
  }, [product.id, quantity]);

  if (!suggestion?.negotiation_enabled) return null;

  const latest = thread[thread.length - 1];
  const awaitingSeller = latest?.status === 'pending' && latest.offered_by === 'buyer';
  const awaitingBuyer = latest?.status === 'pending' && latest.offered_by === 'seller';
  const accepted = latest?.status === 'accepted' && !latest.fulfilled_order_id;

  const handleOpen = async () => {
    setOpen(true);
    setCustomOffer(String(suggestion.suggested_price));
    await refreshThread();
  };

  const submitOffer = async (price) => {
    setSubmitting(true);
    try {
      await createNegotiationOffer(product.id, quantity, price);
      await refreshThread();
      onToast?.('Offer sent to the seller');
    } catch (err) {
      onToast?.(err.message || 'Could not send offer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const acceptCounter = async () => {
    setSubmitting(true);
    try {
      await respondToOffer(latest.id, 'accept');
      await refreshThread();
      onToast?.('Offer accepted — ready to check out');
    } catch (err) {
      onToast?.(err.message || 'Could not accept offer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const loadAddressesForCheckout = async () => {
    const list = await getAddresses();
    setAddresses(list);
    const preferred = list.find((a) => a.isDefault) || list[0] || null;
    setSelectedAddressId(preferred?.id || null);
    setAddingAddress(list.length === 0);
  };

  const handleSaveAddress = async () => {
    if (!newAddress.line1 || !newAddress.city) {
      onToast?.('Address line and city are required', 'error');
      return;
    }
    const saved = await createAddress(newAddress);
    const list = await getAddresses();
    setAddresses(list);
    setSelectedAddressId(saved.id);
    setAddingAddress(false);
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      onToast?.('Select a delivery address', 'error');
      return;
    }
    setPlacingOrder(true);
    try {
      const order = await checkoutOffer(latest.id, selectedAddressId);
      onToast?.(`Order placed at the negotiated price of $${latest.offered_price}`);
      onOrderPlaced?.(order);
    } catch (err) {
      onToast?.(err.message || 'Checkout failed', 'error');
    } finally {
      setPlacingOrder(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="w-full h-11 rounded-lg border-2 border-dashed border-primary/50 text-primary text-label-md font-medium flex items-center justify-center gap-2 hover:bg-primary-container/10 transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]">sell</span>
        Try for a Better Price
      </button>
    );
  }

  return (
    <div className="border border-outline-variant rounded-xl p-4 space-y-3 bg-surface-container-low">
      <div className="flex items-center justify-between">
        <h3 className="text-label-md text-on-surface font-semibold">Negotiate</h3>
        <button onClick={() => setOpen(false)} className="text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {thread.length > 0 && (
        <div className="space-y-1.5">
          {thread.map((o) => (
            <div key={o.id} className={`text-label-sm flex items-center justify-between px-2.5 py-1.5 rounded-lg ${o.offered_by === 'buyer' ? 'bg-primary-container/20' : 'bg-surface-container'}`}>
              <span className="text-on-surface-variant">{o.offered_by === 'buyer' ? 'You offered' : 'Seller offered'}</span>
              <span className="font-semibold text-on-surface">${o.offered_price.toLocaleString()}</span>
              <span className="text-on-surface-variant capitalize">{o.status}</span>
            </div>
          ))}
        </div>
      )}

      {accepted ? (
        <div className="space-y-3 pt-1">
          <p className="text-label-md text-emerald-700 font-medium flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Accepted at ${latest.offered_price.toLocaleString()} — choose a delivery address to complete your order.
          </p>
          {addresses.length === 0 && !addingAddress ? (
            <button onClick={loadAddressesForCheckout} className="h-10 px-4 rounded-lg bg-primary text-on-primary text-label-md font-medium">
              Continue to Checkout
            </button>
          ) : (
            <>
              <div className="space-y-1.5">
                {addresses.map((a) => (
                  <label key={a.id} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer text-label-sm ${selectedAddressId === a.id ? 'border-primary bg-primary-container/20' : 'border-outline-variant'}`}>
                    <input type="radio" checked={selectedAddressId === a.id} onChange={() => setSelectedAddressId(a.id)} className="mt-0.5" />
                    <span>{a.label}: {[a.line1, a.city].filter(Boolean).join(', ')}</span>
                  </label>
                ))}
              </div>
              {addingAddress ? (
                <div className="space-y-2">
                  <input placeholder="Address line" value={newAddress.line1} onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-outline-variant text-body-sm" />
                  <input placeholder="City" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-outline-variant text-body-sm" />
                  <button onClick={handleSaveAddress} className="h-9 px-3 rounded-lg bg-primary text-on-primary text-label-sm font-medium">Save Address</button>
                </div>
              ) : (
                <button onClick={() => setAddingAddress(true)} className="text-label-sm text-primary font-medium">+ Add new address</button>
              )}
              <button
                onClick={handlePlaceOrder}
                disabled={placingOrder || !selectedAddressId}
                className="w-full h-11 rounded-lg bg-primary text-on-primary text-label-md font-medium disabled:opacity-50"
              >
                {placingOrder ? 'Placing...' : `Place Order · $${latest.offered_price.toLocaleString()}`}
              </button>
            </>
          )}
        </div>
      ) : awaitingSeller ? (
        <p className="text-label-sm text-on-surface-variant">Waiting for the seller to respond...</p>
      ) : awaitingBuyer ? (
        <div className="space-y-2">
          <p className="text-label-sm text-on-surface-variant">The seller countered at ${latest.offered_price.toLocaleString()}.</p>
          <button onClick={acceptCounter} disabled={submitting} className="w-full h-10 rounded-lg bg-primary text-on-primary text-label-md font-medium disabled:opacity-50">
            Accept ${latest.offered_price.toLocaleString()}
          </button>
        </div>
      ) : latest?.status === 'rejected' ? (
        <p className="text-label-sm text-on-surface-variant">That offer wasn't accepted. You can try again below.</p>
      ) : null}

      {!accepted && !awaitingSeller && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-label-sm text-on-surface-variant">Suggested: ${suggestion.suggested_price.toLocaleString()}</span>
          <input
            type="number"
            value={customOffer}
            onChange={(e) => setCustomOffer(e.target.value)}
            className="flex-1 h-9 px-3 rounded-lg border border-outline-variant text-body-sm"
          />
          <button
            onClick={() => submitOffer(Number(customOffer))}
            disabled={submitting || !customOffer}
            className="h-9 px-4 rounded-lg bg-primary text-on-primary text-label-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Sending...' : `Try $${customOffer || 0}`}
          </button>
        </div>
      )}
    </div>
  );
}
