
import { useState, useEffect, useCallback } from 'react';
import { getOrders, reviewOrder, getOrderTracking } from '../../../services/storage';

const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-700',
  returned: 'bg-slate-100 text-slate-700',
  created: 'bg-amber-100 text-amber-800',
  payment_pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-blue-100 text-blue-800',
  seller_confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-indigo-100 text-indigo-800',
  packed: 'bg-indigo-100 text-indigo-800',
  ready_for_pickup: 'bg-indigo-100 text-indigo-800',
  picked_up: 'bg-indigo-100 text-indigo-800',
  in_transit: 'bg-indigo-100 text-indigo-800',
  out_for_delivery: 'bg-indigo-100 text-indigo-800',
  return_requested: 'bg-amber-100 text-amber-800',
  refunded: 'bg-slate-100 text-slate-700',
  delivery_failed: 'bg-red-100 text-red-700',
};

function formatStatus(status) {
  return status.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function OrderTimeline({ orderId }) {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getOrderTracking(orderId).then((data) => { if (!cancelled) setEvents(data); });
    return () => { cancelled = true; };
  }, [orderId]);

  if (events === null) {
    return <p className="text-label-sm text-on-surface-variant py-2">Loading tracking...</p>;
  }
  if (events.length === 0) {
    return <p className="text-label-sm text-on-surface-variant py-2">No tracking updates yet.</p>;
  }

  return (
    <ol className="mt-3 space-y-3">
      {events.map((event, i) => (
        <li key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={`w-2.5 h-2.5 rounded-full ${i === events.length - 1 ? 'bg-primary' : 'bg-outline-variant'}`} />
            {i < events.length - 1 && <span className="w-px flex-1 bg-outline-variant" />}
          </div>
          <div className="pb-1 min-w-0">
            <p className="text-label-md text-on-surface font-medium">{formatStatus(event.status)}</p>
            {event.location && <p className="text-label-sm text-on-surface-variant">{event.location}</p>}
            {event.notes && <p className="text-label-sm text-on-surface-variant">{event.notes}</p>}
            <p className="text-label-sm text-on-surface-variant/70">
              {event.created_at && new Date(event.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function OrdersPage({ onToast }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [trackingOpenId, setTrackingOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getOrders();
    setOrders(data.items);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitReview = async () => {
    if (!reviewing) return;
    try {
      await reviewOrder(reviewing, rating, comment);
      setReviewing(null);
      setComment('');
      onToast?.('Thanks! Your review helps the seller build trust');
      load();
    } catch (err) {
      onToast?.(err.message || 'Review failed', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-headline-md text-on-surface font-semibold">My Orders</h2>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined animate-pulse text-[40px] text-on-surface-variant">sync</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-[56px] opacity-30">receipt_long</span>
          <p className="text-body-md mt-3">No orders yet. Browse Discover to place your first order.</p>
        </div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-label-md text-on-surface font-semibold">{order.orderNumber}</p>
              <span className={`px-2.5 py-1 rounded-full text-label-sm font-medium ${statusColors[order.status] || 'bg-surface-container text-on-surface-variant'}`}>
                {formatStatus(order.status)}
              </span>
            </div>
            <div className="space-y-1">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between text-body-sm text-on-surface-variant">
                  <span>Product #{item.productId} × {item.quantity}</span>
                  <span className="text-on-surface font-medium">${item.totalPrice?.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant">
              <p className="text-label-md text-on-surface font-bold">Total: ${order.totalAmount?.toLocaleString()}</p>
              <p className="text-label-sm text-on-surface-variant">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
            <button
              onClick={() => setTrackingOpenId(trackingOpenId === order.id ? null : order.id)}
              className="mt-3 w-full h-9 rounded-lg border border-outline-variant text-on-surface-variant text-label-sm font-medium flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">local_shipping</span>
              {trackingOpenId === order.id ? 'Hide Tracking' : 'Track Order'}
            </button>
            {trackingOpenId === order.id && <OrderTimeline orderId={order.id} />}

            {order.status === 'delivered' && (
              <button
                onClick={() => { setReviewing(order.id); setRating(5); setComment(''); }}
                className="mt-3 w-full h-10 rounded-lg bg-primary/10 text-primary text-label-md font-semibold hover:bg-primary/20 transition-colors"
              >
                Leave a Review
              </button>
            )}
          </div>
        ))
      )}

      {reviewing && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setReviewing(null)}>
          <div className="bg-surface-container-lowest rounded-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-headline-sm text-on-surface font-semibold mb-3">Rate your order</h3>
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)} className="text-[28px]">
                  <span className={`material-symbols-outlined ${star <= rating ? 'text-amber-500 filled' : 'text-outline-variant'}`}>star</span>
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How was your experience?"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:outline-none resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setReviewing(null)} className="flex-1 h-11 rounded-lg border-2 border-outline-variant text-label-md text-on-surface">
                Cancel
              </button>
              <button onClick={submitReview} className="flex-1 h-11 rounded-lg bg-primary text-on-primary text-label-md font-semibold">
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}