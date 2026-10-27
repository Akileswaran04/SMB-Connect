/**
 * Seller orders (PRD §36). Each order says in one line what to do next and
 * shows that step as the big button: Accept → Mark packed → Book courier.
 * Also: print label and bill, contact the buyer, returns and refunds.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listOrders, setOrderStatus, cancelOrder, createShipment, listPartners, shippingLabel, getInvoice, getTracking,
  openConversationWithBuyer,
} from '../../services/smb';
import {
  PageHeader, Tabs, Card, StatusBadge, Button, Loading, LoadError, Empty, Modal, Field, Input, Select, Textarea, Timeline, QuickReasons, Icon,
} from '../../components/ui';
import { inr, dateTime, dayDate, statusText, paymentText, REASONS } from '../../utils/format';
import { t } from '../../i18n';
import { TAB_KEYS } from '../MODULES';

const CLOSED = ['delivered', 'cancelled', 'refunded', 'returned'];

/** The one thing the seller should do next, and the button that does it. */
function nextStep(o) {
  if (['paid', 'payment_pending'].includes(o.status)) {
    return { hint: 'New order. Check you have the item, then tap "Accept order".', label: 'Accept order', icon: 'check', steps: ['seller_confirmed'] };
  }
  if (o.status === 'seller_confirmed') {
    return { hint: 'Pack the item, then tap "Mark packed".', label: 'Mark packed', icon: 'inventory_2', steps: ['processing', 'packed'] };
  }
  if (o.status === 'processing') {
    return { hint: 'Pack the item, then tap "Mark packed".', label: 'Mark packed', icon: 'inventory_2', steps: ['packed'] };
  }
  if (o.status === 'packed' && !o.shipment) return { hint: 'Book a courier to pick up the parcel.', ship: true };
  if (['packed', 'ready_for_pickup'].includes(o.status) && o.shipment) return { hint: 'Print the label, stick it on the parcel and keep it ready for the courier.' };
  if (o.status === 'return_requested') {
    return { hint: 'The buyer wants to return this. When the item reaches you, tap "Return received".', label: 'Return received', icon: 'assignment_return', steps: ['returned'], notes: 'Return received', done: 'Return received — stock added back' };
  }
  if (o.status === 'returned') {
    return { hint: "The item is back. Tap \"Send refund\" to return the buyer's money.", label: 'Send refund', icon: 'currency_rupee', steps: ['refunded'], notes: 'Refund issued', done: 'Refund sent' };
  }
  return null;
}

const EMPTY_SHIP = { package_count: 1, weight_kg: '', length_cm: '', width_cm: '', height_cm: '', logistics_partner_id: '', scheduled_pickup_at: '' };

export default function OrdersTab({ onToast, go, focus }) {
  const [group, setGroup] = useState('active');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [expanded, setExpanded] = useState(focus?.orderId || null);
  const [events, setEvents] = useState({});
  const [shipFor, setShipFor] = useState(null);
  const [ship, setShip] = useState(EMPTY_SHIP);
  const [partners, setPartners] = useState([]);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [doc, setDoc] = useState(null); // { kind: 'label'|'invoice', data }

  const load = useCallback(async () => {
    setError('');
    try { setOrders((await listOrders(group)).items); } catch (err) { setError(err.message); }
  }, [group]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (focus?.orderId) setGroup('all'); }, [focus]);

  const toggle = async (id) => {
    setExpanded(expanded === id ? null : id);
    if (!events[id]) setEvents({ ...events, [id]: await getTracking(id).catch(() => []) });
  };

  const run = async (fn, msg, id = null) => {
    setBusy(id);
    try {
      await fn();
      onToast?.(t(msg));
      setEvents({});
      load();
    } catch (err) {
      onToast?.(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const advance = (o, step) => run(async () => {
    for (const status of step.steps) await setOrderStatus(o.id, status, step.notes ? { notes: step.notes } : {});
  }, step.done || 'Done', o.id);

  const showDoc = async (kind, fn) => {
    try { setDoc({ kind, data: await fn() }); } catch (err) { onToast?.(err.message, 'error'); }
  };

  const openShip = async (o) => {
    setShip(EMPTY_SHIP);
    setShipFor(o);
    setPartners(await listPartners().catch(() => []));
  };

  const submitShipment = () => run(async () => {
    const body = { order_id: shipFor.id, package_count: Number(ship.package_count || 1) };
    ['weight_kg', 'length_cm', 'width_cm', 'height_cm'].forEach((k) => { if (ship[k]) body[k] = Number(ship[k]); });
    if (ship.logistics_partner_id) body.logistics_partner_id = Number(ship.logistics_partner_id);
    if (ship.scheduled_pickup_at) body.scheduled_pickup_at = new Date(ship.scheduled_pickup_at).toISOString();
    const s = await createShipment(body);
    setShipFor(null);
    setDoc({ kind: 'label', data: await shippingLabel(s.id) });
  }, 'Courier booked — print the label and keep the parcel ready');

  const contact = async (o) => {
    try {
      await openConversationWithBuyer(o.buyer_id);
      go(TAB_KEYS.INBOX);
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  const confirmCancel = () => run(async () => {
    await cancelOrder(rejecting.id, reason || 'Cancelled by seller');
    setRejecting(null);
    setReason('');
  }, 'Order cancelled — stock added back, buyer refunded if paid');

  return (
    <div>
      <PageHeader title={t('Orders')} subtitle={t('Accept, pack and hand over to the courier.')} />
      <Tabs value={group} onChange={setGroup} tabs={[{ key: 'active', label: t('To do') }, { key: 'delivered', label: t('Delivered & returns') }, { key: 'cancelled', label: t('Cancelled') }, { key: 'all', label: t('All') }]} />
      {error ? <LoadError message={error} onRetry={load} /> : orders === null ? <Loading /> : orders.length === 0 ? (
        <Empty icon="receipt_long" title={group === 'active' ? t('No orders to work on right now') : t('No orders here')} />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const step = nextStep(o);
            return (
              <Card key={o.id} className={`p-4 ${focus?.orderId === o.id ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-title-sm font-semibold text-on-surface">{o.buyer_name}</p>
                    <p className="text-label-sm text-on-surface-variant">{t('Order')} {o.order_number} · {dateTime(o.created_at)}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <ul className="mt-2 text-body-md space-y-0.5">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2">
                      <span><strong>{i.quantity} ×</strong> {i.product_name}{i.variant_label ? ` (${i.variant_label})` : ''}{i.listed_unit_price > i.unit_price ? ` · ${t('discounted')}` : ''}</span>
                      <span>{inr(i.total_price)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-body-md mt-1.5">
                  {t('You get')} <strong>{inr(o.total_amount - (o.platform_fee || 0))}</strong>
                  <span className="text-on-surface-variant"> ({t('order {total}, fee {fee}', { total: inr(o.total_amount), fee: inr(o.platform_fee || 0) })})</span>
                </p>
                <p className="text-label-md text-on-surface-variant">
                  {paymentText(o.payment_method)} · {statusText(o.payment_status)}
                  {o.delivery_option === 'express' && ` · ${t('Next-day delivery')}`}
                  {!CLOSED.includes(o.status) && o.expected_delivery && ` · ${t('deliver by {date}', { date: dayDate(o.expected_delivery) })}`}
                </p>
                {o.return_reason && <p className="text-label-md text-amber-800 mt-1">{t('Return reason')}: {o.return_reason}</p>}
                {o.cancel_reason && <p className="text-label-md text-on-surface-variant mt-1">{t('Cancelled')}: {o.cancel_reason}</p>}
                {o.shipment && <p className="text-label-md text-on-surface-variant mt-1">{t('Courier')}: {o.shipment.partner_name || t('being assigned')} · {statusText(o.shipment.status)}</p>}

                {step && (
                  <p className="mt-3 flex items-start gap-2 bg-primary-container/10 border border-primary/20 rounded-lg px-3 py-2 text-body-md text-on-surface">
                    <Icon name="lightbulb" className="text-primary mt-0.5" size={20} />{t(step.hint)}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mt-3">
                  {step?.label && <Button size="lg" icon={step.icon} disabled={busy === o.id} onClick={() => advance(o, step)}>{busy === o.id ? t('Please wait…') : t(step.label)}</Button>}
                  {step?.ship && <Button size="lg" icon="local_shipping" onClick={() => openShip(o)}>{t('Book courier')}</Button>}
                  {o.shipment && <Button variant="secondary" icon="print" onClick={() => showDoc('label', () => shippingLabel(o.shipment.id))}>{t('Print label')}</Button>}
                  <Button variant="secondary" icon="receipt" onClick={() => showDoc('invoice', () => getInvoice(o.id))}>{t('Bill')}</Button>
                  <Button variant="secondary" icon="chat" onClick={() => contact(o)}>{t('Message buyer')}</Button>
                  <Button variant="ghost" icon={expanded === o.id ? 'expand_less' : 'history'} onClick={() => toggle(o.id)}>{t('History')}</Button>
                  {o.can_cancel && <Button variant="ghost" icon="cancel" onClick={() => setRejecting(o)}>{['paid', 'payment_pending'].includes(o.status) ? t('Reject') : t('Cancel')}</Button>}
                </div>
                {expanded === o.id && events[o.id] && (
                  <div className="mt-3 border-t border-outline-variant pt-3">
                    <Timeline steps={events[o.id].map((e) => ({ label: statusText(e.status), done: true, time: dateTime(e.created_at), note: [e.location, e.notes].filter(Boolean).join(' · ') }))} />
                    <p className="text-label-md text-on-surface-variant mt-2">{t('Deliver to')}: {o.shipping_address}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!shipFor} onClose={() => setShipFor(null)} title={t('Book courier')}
        footer={<><Button variant="secondary" onClick={() => setShipFor(null)}>{t('Cancel')}</Button><Button size="lg" icon="local_shipping" onClick={submitShipment}>{t('Book courier & print label')}</Button></>}>
        <div className="space-y-3">
          <p className="text-body-md text-on-surface-variant">{t('Deliver to')}: {shipFor?.shipping_address}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Number of parcels')}><Input type="number" inputMode="numeric" min="1" value={ship.package_count} onChange={(e) => setShip({ ...ship, package_count: e.target.value })} /></Field>
            <Field label={t('Weight in kg (optional)')}><Input type="number" inputMode="decimal" step="0.1" value={ship.weight_kg} onChange={(e) => setShip({ ...ship, weight_kg: e.target.value })} /></Field>
          </div>
          <p className="text-label-md text-on-surface-variant">{t('We will pick the nearest free courier for you.')}</p>
          <details className="border border-outline-variant rounded-lg px-3 py-2">
            <summary className="text-label-md text-primary font-medium cursor-pointer py-1">{t('More options')}</summary>
            <div className="space-y-3 mt-2">
              <Field label={t('Box size in cm — length, width, height')}>
                <div className="flex gap-2">
                  {['length_cm', 'width_cm', 'height_cm'].map((k) => <Input key={k} type="number" inputMode="numeric" value={ship[k]} onChange={(e) => setShip({ ...ship, [k]: e.target.value })} />)}
                </div>
              </Field>
              <Field label={t('Choose courier')}>
                <Select value={ship.logistics_partner_id} onChange={(e) => setShip({ ...ship, logistics_partner_id: e.target.value })}>
                  <option value="">{t('Nearest free courier (recommended)')}</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.company_name}{p.service_city ? ` (${p.service_city})` : ''}</option>)}
                </Select>
              </Field>
              <Field label={t('Pickup time')}><Input type="datetime-local" value={ship.scheduled_pickup_at} onChange={(e) => setShip({ ...ship, scheduled_pickup_at: e.target.value })} /></Field>
            </div>
          </details>
        </div>
      </Modal>

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={t('Cancel this order?')}
        footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>{t('Keep order')}</Button><Button variant="danger" onClick={confirmCancel}>{t('Yes, cancel order')}</Button></>}>
        <p className="text-body-md text-on-surface mb-3">{t('Why? The buyer will see this.')}</p>
        <QuickReasons options={REASONS.sellerCancel} value={reason} onPick={setReason} />
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Or write your own reason')} />
      </Modal>

      <Modal open={!!doc} onClose={() => setDoc(null)} title={doc?.kind === 'label' ? t('Shipping label') : `${t('Bill')} ${doc?.data.invoice_number || ''}`}
        footer={<Button size="lg" icon="print" onClick={() => window.print()}>{t('Print')}</Button>}>
        {doc?.kind === 'label' && (
          <div className="border-2 border-dashed border-on-surface rounded-lg p-4 text-body-md space-y-2">
            <p className="text-title-md font-bold tracking-wider">{doc.data.shipment_number}</p>
            <p><span className="text-on-surface-variant">{t('From')}:</span> {doc.data.from.name}, {doc.data.from.address} {doc.data.from.phone && `· ${doc.data.from.phone}`}</p>
            <p><span className="text-on-surface-variant">{t('To')}:</span> <strong>{doc.data.to.name}</strong>, {doc.data.to.address} {doc.data.to.phone && `· ${doc.data.to.phone}`}</p>
            <p>{t('Order')} {doc.data.order_number} · {t('{n} parcels', { n: doc.data.package_count })}{doc.data.weight_kg ? ` · ${doc.data.weight_kg} kg` : ''}</p>
            {doc.data.partner && <p>{t('Courier')}: {doc.data.partner.company_name}</p>}
            {doc.data.cash_to_collect > 0 && <p className="font-bold">{t('COLLECT CASH')}: {inr(doc.data.cash_to_collect)}</p>}
            <div className="h-12 bg-[repeating-linear-gradient(90deg,#000_0_2px,transparent_2px_5px)]" aria-hidden="true" />
          </div>
        )}
        {doc?.kind === 'invoice' && (
          <div className="text-body-md space-y-2">
            <p><strong>{doc.data.seller.name}</strong><br />{doc.data.seller.address}</p>
            <p>{t('Bill to')}: {doc.data.buyer.name}, {doc.data.buyer.address}</p>
            {doc.data.items.map((i) => <p key={i.id} className="flex justify-between"><span>{i.product_name}{i.variant_label ? ` (${i.variant_label})` : ''} × {i.quantity}</span><span>{inr(i.total_price)}</span></p>)}
            <p className="text-right">{t('Discount')} −{inr(doc.data.discount_amount)} · {t('Delivery')} {inr(doc.data.delivery_charge)}</p>
            <p className="text-right font-bold">{t('Total')} {inr(doc.data.total_amount)}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
