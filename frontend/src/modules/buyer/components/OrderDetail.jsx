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
import { Icon, Button, Card, StatusBadge, LoadError, Loading, Timeline, Modal, Select, Field, QuickReasons } from '../../../components/ui';
import VoiceField from '../../../components/VoiceField';
import { inr, dateTime, dayDate, statusText, paymentText, REASONS, DISPUTE_REASONS } from '../../../utils/format';
import { t } from '../../../i18n';

const ORDER_STEPS = [
  { label: 'Order placed', statuses: ['paid', 'payment_pending', 'created', 'pending'] },
  { label: 'Seller accepted', statuses: ['seller_confirmed', 'confirmed'] },
  { label: 'Packed', statuses: ['packed', 'ready_for_pickup'] },
  { label: 'Picked up by courier', statuses: ['picked_up'] },
  { label: 'On the way', statuses: ['in_transit'] },
  { label: 'Out for delivery today', statuses: ['out_for_delivery'] },
  { label: 'Delivered', statuses: ['delivered'] },
];

function buildTimeline(events, status) {
  const reached = new Map();
  events.forEach((e) => {
    const idx = ORDER_STEPS.findIndex((s) => s.statuses.includes(e.status));
    if (idx >= 0 && !reached.has(idx)) reached.set(idx, e);
  });
  const lastIdx = Math.max(-1, ...reached.keys());
  const steps = ORDER_STEPS.map((s, i) => ({
    label: t(s.label), done: i <= lastIdx, current: i === lastIdx + 1 && !['cancelled', 'refunded'].includes(status),
    time: reached.get(i) ? dateTime(reached.get(i).created_at) : null,
  }));
  const extra = events.filter((e) => ['cancelled', 'delivery_failed', 'return_requested', 'returned', 'refunded'].includes(e.status))
    .map((e) => ({ label: statusText(e.status), done: true, time: dateTime(e.created_at), note: e.notes }));
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
      setError(err.message);
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
      onToast?.(err.message, 'error');
    }
  };
  // Buttons that fetch something: show the reason if it fails instead of doing nothing.
  const tryDo = (fn) => async () => { try { await fn(); } catch (err) { onToast?.(err.message, 'error'); } };

  if (error) return <LoadError message={error} onRetry={load} />;
  if (!order) return <Loading />;

  const open = !['delivered', 'cancelled', 'refunded', 'returned'].includes(order.status);

  return (
    <div className="space-y-4 max-w-4xl">
      <button onClick={onBack} className="h-11 text-label-md text-primary inline-flex items-center gap-1"><Icon name="arrow_back" size={20} />{t('My Orders')}</button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-headline-sm font-semibold text-on-surface">{order.items.map((i) => i.product_name).join(', ')}</h1>
          <p className="text-label-md text-on-surface-variant">{order.seller_name} · {t('ordered on {date}', { date: dateTime(order.created_at) })} · {t('Order')} {order.order_number}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {order.delivery_otp && (
        <Card className="p-4 bg-primary-container/10 border-primary/30 flex items-center gap-4">
          <Icon name="password" size={32} className="text-primary" />
          <div>
            <p className="text-label-md text-on-surface">{t('Delivery code — tell the courier only when you have the parcel in your hand')}</p>
            <p className="text-headline-md font-bold tracking-[0.3em] text-primary">{order.delivery_otp}</p>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-5 gap-4">
        <div className="md:col-span-3 space-y-4">
          <Card className="p-4">
            <h2 className="text-title-sm font-semibold mb-3">{t('Where is my order?')}</h2>
            <Timeline steps={buildTimeline(events, order.status)} />
          </Card>

          {shipment && (
            <Card className="p-4">
              <h2 className="text-title-sm font-semibold">{t('Courier updates')}</h2>
              <p className="text-label-md text-on-surface-variant mt-0.5">
                {shipment.partner?.company_name || t('Courier being assigned')} · {t('Tracking number')} <strong className="text-on-surface">{shipment.tracking_id}</strong>
              </p>
              {shipment.current_location && open && (
                <p className="text-label-md text-on-surface mt-2 flex items-center gap-1.5"><Icon name="location_on" size={18} className="text-primary" />{t('now at {place}', { place: shipment.current_location })}</p>
              )}
              <ol className="mt-3 space-y-2">
                {[...shipment.events].reverse().map((e, i) => (
                  <li key={i} className="flex gap-3 text-label-md">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? 'bg-primary' : 'bg-outline-variant'}`} />
                    <span>
                      <span className="text-on-surface font-medium">{statusText(e.status)}</span>
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
              <div className="flex justify-between"><dt className="text-on-surface-variant">{t('Items')}</dt><dd>{inr(order.subtotal)}</dd></div>
              {order.discount_amount > 0 && <div className="flex justify-between text-emerald-700"><dt>{t('You save')}</dt><dd>−{inr(order.discount_amount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-on-surface-variant">{t('Delivery')}</dt><dd>{order.delivery_charge ? inr(order.delivery_charge) : t('Free')}</dd></div>
              <div className="flex justify-between font-bold text-body-md"><dt>{t('Total')}</dt><dd>{inr(order.total_amount)}</dd></div>
            </dl>
          </Card>
          <Card className="p-4 text-label-md space-y-1.5">
            <p><span className="text-on-surface-variant">{t('Payment')}:</span> {paymentText(order.payment_method)} · {statusText(order.payment_status)}</p>
            <p><span className="text-on-surface-variant">{t('Deliver to')}:</span> {order.shipping_address}</p>
            {open && <p><span className="text-on-surface-variant">{t('Arrives by')}:</span> {dayDate(order.expected_delivery)}</p>}
            {order.cancel_reason && <p><span className="text-on-surface-variant">{t('Cancelled')}:</span> {order.cancel_reason}</p>}
            {order.return_reason && <p><span className="text-on-surface-variant">{t('Return reason')}:</span> {order.return_reason}</p>}
          </Card>
          <div className="flex flex-wrap gap-2">
            {order.can_review && <Button icon="star" onClick={() => setModal('review')}>{t('Rate this order')}</Button>}
            <Button variant="secondary" icon="chat" onClick={tryDo(async () => onChatOpened((await openConversationWithSeller(order.seller_id)).id))}>{t('Message seller')}</Button>
            <Button variant="secondary" icon="receipt" onClick={tryDo(async () => setInvoice(await getInvoice(order.id)))}>{t('Bill')}</Button>
            {!open && (
              <Button variant="secondary" icon="replay" onClick={tryDo(async () => {
                const r = await reorder(order.id);
                if (r.added_to_cart) onOpenCart({ addressId: r.address_id, deliveryOption: r.delivery_option, paymentMethod: r.payment_method });
                else onToast?.(t('These items are not available now'), 'error');
              })}>{t('Buy again')}</Button>
            )}
            {order.can_return && <Button variant="secondary" icon="assignment_return" onClick={() => setModal('return')}>{t('Return')}</Button>}
            {order.can_cancel && <Button variant="ghost" icon="cancel" onClick={() => setModal('cancel')}>{t('Cancel order')}</Button>}
            <Button variant="ghost" icon="support_agent" onClick={() => setModal('dispute')}>{t('Report a problem')}</Button>
          </div>
        </div>
      </div>

      <Modal open={modal === 'cancel'} onClose={() => setModal(null)} title={t('Cancel this order?')}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>{t('Keep order')}</Button><Button variant="danger" onClick={() => act(() => cancelOrder(order.id, form.reason || 'Changed my mind'), t('Order cancelled'))}>{t('Yes, cancel order')}</Button></>}>
        <p className="text-label-md text-on-surface-variant mb-2">{t('Why? (optional)')}</p>
        <QuickReasons options={REASONS.cancel} value={form.reason} onPick={(r) => setForm({ ...form, reason: r })} />
        <VoiceField value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t('Or write your reason')} />
      </Modal>
      <Modal open={modal === 'return'} onClose={() => setModal(null)} title={t('Return this order')}
        footer={<Button size="lg" disabled={form.reason.trim().length < 3} onClick={() => act(() => requestReturn(order.id, form.reason), t('Return requested — the seller will arrange pickup'))}>{t('Ask for return')}</Button>}>
        <p className="text-label-md text-on-surface-variant mb-2">{t('What is the problem?')}</p>
        <QuickReasons options={REASONS.return} value={form.reason} onPick={(r) => setForm({ ...form, reason: r })} />
        <VoiceField value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t('Or tell us in your own words')} />
      </Modal>
      <Modal open={modal === 'review'} onClose={() => setModal(null)} title={t('How was your order?')}
        footer={<Button size="lg" onClick={() => act(() => reviewOrder(order.id, { rating: form.rating, comment: form.comment }), t('Thank you for your review!'))}>{t('Send')}</Button>}>
        <div className="flex gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setForm({ ...form, rating: s })} aria-label={t('{n} stars', { n: s })} className="w-12 h-12 flex items-center justify-center">
              <Icon name="star" filled={s <= form.rating} size={36} className={s <= form.rating ? 'text-amber-500' : 'text-outline-variant'} />
            </button>
          ))}
        </div>
        <VoiceField value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder={t('Tell other buyers about it (optional). You can speak.')} />
      </Modal>
      <Modal open={modal === 'dispute'} onClose={() => setModal(null)} title={t('Report a problem')}
        footer={<Button size="lg" onClick={() => act(() => raiseDispute({ order_id: order.id, reason: form.disputeReason, description: form.reason }), t('Our support team will look into it'))}>{t('Send')}</Button>}>
        <Field label={t('What went wrong?')}>
          <Select value={form.disputeReason} onChange={(e) => setForm({ ...form, disputeReason: e.target.value })}>
            {DISPUTE_REASONS.map(([code, label]) => <option key={code} value={code}>{t(label)}</option>)}
          </Select>
        </Field>
        <div className="mt-3"><VoiceField value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t('Tell us more (optional). You can speak.')} /></div>
      </Modal>
      <Modal open={!!invoice} onClose={() => setInvoice(null)} title={`${t('Bill')} ${invoice?.invoice_number || ''}`}
        footer={<Button icon="print" onClick={() => window.print()}>{t('Print')}</Button>}>
        {invoice && (
          <div className="text-label-md space-y-2">
            <p><strong>{invoice.seller.name}</strong><br />{invoice.seller.address}{invoice.seller.license_number ? ` · Lic. ${invoice.seller.license_number}` : ''}</p>
            <p>{t('Bill to')}: {invoice.buyer.name}<br />{invoice.buyer.address}</p>
            <table className="w-full text-left"><tbody>
              {invoice.items.map((i) => (
                <tr key={i.id} className="border-b border-outline-variant"><td className="py-1">{i.product_name}{i.variant_label ? ` (${i.variant_label})` : ''} × {i.quantity}</td><td className="text-right">{inr(i.total_price)}</td></tr>
              ))}
            </tbody></table>
            <p className="text-right">{t('Discount')} −{inr(invoice.discount_amount)} · {t('Delivery')} {inr(invoice.delivery_charge)}</p>
            <p className="text-right font-bold text-body-md">{t('Total')} {inr(invoice.total_amount)} ({statusText(invoice.payment_status)})</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
