/**
 * Order details (PRD §24) and live tracking (PRD §25): everything about one
 * order, the status timeline with timestamps, the parcel's live events and
 * location, the delivery OTP, and cancel / return / review / dispute /
 * invoice / reorder actions.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  getOrder, getTracking, shipmentForOrder, cancelOrder, requestReturn, reviewOrder, raiseDispute, reorder,
  getInvoice, openConversationWithSeller,
} from '../../../services/smb';
import { Icon, Button, Card, StatusBadge, Loading, ErrorNote, Timeline, Modal, Textarea, Select, Field } from '../../../components/ui';
import { inr, dateTime, dayDate, titleCase } from '../../../utils/format';

const ORDER_STEPS = [
  { label: 'Order placed', statuses: ['paid', 'payment_pending', 'created', 'pending'] },
  { label: 'Seller confirmed', statuses: ['seller_confirmed', 'confirmed'] },
  { label: 'Packed', statuses: ['packed', 'ready_for_pickup'] },
  { label: 'Picked up', statuses: ['picked_up'] },
  { label: 'In transit', statuses: ['in_transit'] },
  { label: 'Out for delivery', statuses: ['out_for_delivery'] },
  { label: 'Delivered', statuses: ['delivered'] },
];
const DISPUTE_REASONS = ['item_not_received', 'damaged', 'wrong_item', 'not_as_described', 'refund_issue', 'payment_issue', 'other'];

function buildTimeline(events, status) {
  const reached = new Map();
  events.forEach((e) => {
    const idx = ORDER_STEPS.findIndex((s) => s.statuses.includes(e.status));
    if (idx >= 0 && !reached.has(idx)) reached.set(idx, e);
  });
  const lastIdx = Math.max(-1, ...reached.keys());
  const steps = ORDER_STEPS.map((s, i) => ({
    label: s.label, done: i <= lastIdx, current: i === lastIdx + 1 && !['cancelled', 'refunded'].includes(status),
    time: reached.get(i) ? dateTime(reached.get(i).created_at) : null,
  }));
  const extra = events.filter((e) => ['cancelled', 'delivery_failed', 'return_requested', 'returned', 'refunded'].includes(e.status))
    .map((e) => ({ label: titleCase(e.status), done: true, time: dateTime(e.created_at), note: e.notes }));
  return [...steps, ...extra];
}

export default function OrderDetail({ orderId, initialAction, onBack, onToast, onOpenCart, onChatOpened }) {
  const [order, setOrder] = useState(null);
  const [events, setEvents] = useState([]);
  const [shipment, setShipment] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(initialAction || null);
  const [form, setForm] = useState({ reason: '', rating: 5, comment: '', disputeReason: 'damaged' });
  const [invoice, setInvoice] = useState(null);

  const load = useCallback(async () => {
    try {
      const [o, t, s] = await Promise.all([getOrder(orderId), getTracking(orderId), shipmentForOrder(orderId).catch(() => null)]);
      setOrder(o);
      setEvents(t);
      setShipment(s);
    } catch (err) {
      setError(err.message || 'Could not load this order');
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!order || ['delivered', 'cancelled', 'refunded', 'returned'].includes(order.status)) return undefined;
    const t = setInterval(load, 30000); // live tracking refresh
    return () => clearInterval(t);
  }, [order, load]);

  const act = async (fn, message) => {
    try {
      await fn();
      onToast?.(message);
      setModal(null);
      load();
    } catch (err) {
      onToast?.(err.message || 'That did not work', 'error');
    }
  };

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!order) return <Loading />;

  const open = !['delivered', 'cancelled', 'refunded', 'returned'].includes(order.status);

  return (
    <div className="space-y-4 max-w-4xl">
      <button onClick={onBack} className="text-label-md text-primary inline-flex items-center gap-1"><Icon name="arrow_back" size={18} />My orders</button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-headline-sm font-semibold text-on-surface">Order {order.order_number}</h1>
          <p className="text-label-md text-on-surface-variant">Placed {dateTime(order.created_at)} · {order.seller_name}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {order.delivery_otp && (
        <Card className="p-4 bg-primary-container/10 border-primary/30 flex items-center gap-4">
          <Icon name="password" size={32} className="text-primary" />
          <div>
            <p className="text-label-md text-on-surface">Delivery code — share it with the courier only when you receive your parcel</p>
            <p className="text-headline-md font-bold tracking-[0.3em] text-primary">{order.delivery_otp}</p>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-5 gap-4">
        <div className="md:col-span-3 space-y-4">
          <Card className="p-4">
            <h2 className="text-title-sm font-semibold mb-3">Status</h2>
            <Timeline steps={buildTimeline(events, order.status)} />
          </Card>

          {shipment && (
            <Card className="p-4">
              <h2 className="text-title-sm font-semibold">Live tracking</h2>
              <p className="text-label-md text-on-surface-variant mt-0.5">
                {shipment.partner?.company_name || 'Courier being assigned'} · Tracking ID <strong className="text-on-surface">{shipment.tracking_id}</strong>
              </p>
              {shipment.current_location && open && (
                <p className="text-label-md text-on-surface mt-2 flex items-center gap-1.5"><Icon name="location_on" size={18} className="text-primary" />Now at {shipment.current_location}</p>
              )}
              <ol className="mt-3 space-y-2">
                {[...shipment.events].reverse().map((e, i) => (
                  <li key={i} className="flex gap-3 text-label-md">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? 'bg-primary' : 'bg-outline-variant'}`} />
                    <span>
                      <span className="text-on-surface font-medium">{titleCase(e.status)}</span>
                      {e.location && <span className="text-on-surface-variant"> · {e.location}</span>}
                      {e.notes && <span className="block text-label-sm text-on-surface-variant">{e.notes}</span>}
                      <span className="block text-label-sm text-on-surface-variant">{dateTime(e.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        <div className="md:col-span-2 space-y-4">
          <Card className="p-4 space-y-2">
            {order.items.map((i) => (
              <div key={i.id} className="flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-surface-container overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {i.image_url ? <img src={i.image_url} alt="" className="w-full h-full object-cover" /> : <Icon name="inventory_2" className="text-on-surface-variant/40" />}
                </div>
                <div className="min-w-0 flex-1 text-label-md">
                  <p className="font-semibold text-on-surface">{i.product_name}</p>
                  <p className="text-on-surface-variant">{i.variant_label ? `${i.variant_label} · ` : ''}{i.quantity} × {inr(i.unit_price)}</p>
                </div>
              </div>
            ))}
            <dl className="text-label-md border-t border-outline-variant pt-2 space-y-0.5">
              <div className="flex justify-between"><dt className="text-on-surface-variant">Items</dt><dd>{inr(order.subtotal)}</dd></div>
              {order.discount_amount > 0 && <div className="flex justify-between text-emerald-700"><dt>Savings</dt><dd>−{inr(order.discount_amount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-on-surface-variant">Delivery ({order.delivery_option})</dt><dd>{order.delivery_charge ? inr(order.delivery_charge) : 'Free'}</dd></div>
              <div className="flex justify-between font-bold text-body-md"><dt>Total</dt><dd>{inr(order.total_amount)}</dd></div>
            </dl>
          </Card>
          <Card className="p-4 text-label-md space-y-1.5">
            <p><span className="text-on-surface-variant">Payment:</span> {titleCase(order.payment_method)} · {titleCase(order.payment_status)}</p>
            <p><span className="text-on-surface-variant">Deliver to:</span> {order.shipping_address}</p>
            {open && <p><span className="text-on-surface-variant">Expected:</span> {dayDate(order.expected_delivery)}</p>}
            {order.shipment && <p><span className="text-on-surface-variant">Shipment ID:</span> {order.shipment.shipment_number}</p>}
            {order.cancel_reason && <p><span className="text-on-surface-variant">Cancelled:</span> {order.cancel_reason}</p>}
            {order.return_reason && <p><span className="text-on-surface-variant">Return reason:</span> {order.return_reason}</p>}
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon="chat" onClick={async () => onChatOpened((await openConversationWithSeller(order.seller_id)).id)}>Contact seller</Button>
            <Button size="sm" variant="secondary" icon="receipt" onClick={async () => setInvoice(await getInvoice(order.id))}>Invoice</Button>
            {!open && (
              <Button size="sm" variant="secondary" icon="replay" onClick={async () => {
                const r = await reorder(order.id);
                if (r.added_to_cart) onOpenCart({ addressId: r.address_id, deliveryOption: r.delivery_option, paymentMethod: r.payment_method });
                else onToast?.('These items are unavailable', 'error');
              }}>Buy again</Button>
            )}
            {order.can_cancel && <Button size="sm" variant="ghost" icon="cancel" onClick={() => setModal('cancel')}>Cancel</Button>}
            {order.can_return && <Button size="sm" variant="secondary" icon="assignment_return" onClick={() => setModal('return')}>Return</Button>}
            {order.can_review && <Button size="sm" icon="star" onClick={() => setModal('review')}>Rate & review</Button>}
            <Button size="sm" variant="ghost" icon="report" onClick={() => setModal('dispute')}>Report a problem</Button>
          </div>
        </div>
      </div>

      <Modal open={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel order"
        footer={<Button variant="danger" onClick={() => act(() => cancelOrder(order.id, form.reason || 'Changed my mind'), 'Order cancelled')}>Cancel order</Button>}>
        <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason (optional)" />
      </Modal>
      <Modal open={modal === 'return'} onClose={() => setModal(null)} title="Return this order"
        footer={<Button disabled={form.reason.trim().length < 3} onClick={() => act(() => requestReturn(order.id, form.reason), 'Return requested — the seller will arrange pickup')}>Request return</Button>}>
        <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="What's the problem? (e.g. size too small)" />
      </Modal>
      <Modal open={modal === 'review'} onClose={() => setModal(null)} title="Rate your order"
        footer={<Button onClick={() => act(() => reviewOrder(order.id, { rating: form.rating, comment: form.comment }), 'Thanks for your review!')}>Submit review</Button>}>
        <div className="flex gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setForm({ ...form, rating: s })} aria-label={`${s} stars`}>
              <Icon name="star" filled={s <= form.rating} size={30} className={s <= form.rating ? 'text-amber-500' : 'text-outline-variant'} />
            </button>
          ))}
        </div>
        <Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="How was it?" />
      </Modal>
      <Modal open={modal === 'dispute'} onClose={() => setModal(null)} title="Report a problem"
        footer={<Button onClick={() => act(() => raiseDispute({ order_id: order.id, reason: form.disputeReason, description: form.reason }), 'Our support team will look into it')}>Submit</Button>}>
        <Field label="What went wrong?">
          <Select value={form.disputeReason} onChange={(e) => setForm({ ...form, disputeReason: e.target.value })}>
            {DISPUTE_REASONS.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
          </Select>
        </Field>
        <div className="mt-3"><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Tell us more" /></div>
      </Modal>
      <Modal open={!!invoice} onClose={() => setInvoice(null)} title={`Invoice ${invoice?.invoice_number || ''}`}
        footer={<Button icon="print" onClick={() => window.print()}>Print</Button>}>
        {invoice && (
          <div className="text-label-md space-y-2">
            <p><strong>{invoice.seller.name}</strong><br />{invoice.seller.address}{invoice.seller.license_number ? ` · Lic. ${invoice.seller.license_number}` : ''}</p>
            <p>Billed to: {invoice.buyer.name}<br />{invoice.buyer.address}</p>
            <table className="w-full text-left"><tbody>
              {invoice.items.map((i) => (
                <tr key={i.id} className="border-b border-outline-variant"><td className="py-1">{i.product_name}{i.variant_label ? ` (${i.variant_label})` : ''} × {i.quantity}</td><td className="text-right">{inr(i.total_price)}</td></tr>
              ))}
            </tbody></table>
            <p className="text-right">Discount −{inr(invoice.discount_amount)} · Delivery {inr(invoice.delivery_charge)}</p>
            <p className="text-right font-bold text-body-md">Total {inr(invoice.total_amount)} ({titleCase(invoice.payment_status)})</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
