/**
 * Seller orders (PRD §36): accept or reject, process, pack, create the
 * shipment (package details + logistics partner), print label and invoice,
 * contact the buyer, and handle returns and refunds.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  listOrders, setOrderStatus, cancelOrder, createShipment, listPartners, shippingLabel, getInvoice, getTracking,
  openConversationWithBuyer,
} from '../../services/smb';
import { PageHeader, Tabs, Card, StatusBadge, Button, Loading, Empty, Modal, Field, Input, Select, Textarea, Timeline } from '../../components/ui';
import { inr, dateTime, dayDate, titleCase } from '../../utils/format';
import { TAB_KEYS } from '../MODULES';

const NEXT = {
  payment_pending: { status: 'seller_confirmed', label: 'Accept order' },
  paid: { status: 'seller_confirmed', label: 'Accept order' },
  seller_confirmed: { status: 'processing', label: 'Start processing' },
  processing: { status: 'packed', label: 'Mark packed' },
};

export default function OrdersTab({ onToast, go, focus }) {
  const [group, setGroup] = useState('active');
  const [orders, setOrders] = useState(null);
  const [expanded, setExpanded] = useState(focus?.orderId || null);
  const [events, setEvents] = useState({});
  const [shipFor, setShipFor] = useState(null);
  const [ship, setShip] = useState({ package_count: 1, weight_kg: '', length_cm: '', width_cm: '', height_cm: '', logistics_partner_id: '', scheduled_pickup_at: '' });
  const [partners, setPartners] = useState([]);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [doc, setDoc] = useState(null); // { kind: 'label'|'invoice', data }

  const load = useCallback(async () => setOrders((await listOrders(group).catch(() => ({ items: [] }))).items), [group]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (focus?.orderId) setGroup('all'); }, [focus]);

  const toggle = async (id) => {
    setExpanded(expanded === id ? null : id);
    if (!events[id]) setEvents({ ...events, [id]: await getTracking(id).catch(() => []) });
  };

  const run = async (fn, msg) => {
    try {
      await fn();
      onToast?.(msg);
      setEvents({});
      load();
    } catch (err) { onToast?.(err.message || 'That did not work', 'error'); }
  };

  const openShip = async (o) => {
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
  }, 'Shipment created — the courier has been notified');

  const contact = async (o) => {
    try {
      await openConversationWithBuyer(o.buyer_id);
      go(TAB_KEYS.INBOX);
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Orders" subtitle="Accept, pack and ship. Couriers take over from pickup." />
      <Tabs value={group} onChange={setGroup} tabs={[{ key: 'active', label: 'Active' }, { key: 'delivered', label: 'Delivered & returns' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'all', label: 'All' }]} />
      {orders === null ? <Loading /> : orders.length === 0 ? <Empty icon="receipt_long" title="No orders here" /> : (
        <div className="space-y-3">
          {orders.map((o) => {
            const next = NEXT[o.status];
            return (
              <Card key={o.id} className={`p-4 ${focus?.orderId === o.id ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-label-md font-semibold text-on-surface">{o.order_number} · {o.buyer_name}</p>
                    <p className="text-label-sm text-on-surface-variant">{dateTime(o.created_at)} · {titleCase(o.payment_method)} ({titleCase(o.payment_status)}) · {o.delivery_option}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <ul className="mt-2 text-label-md space-y-0.5">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2">
                      <span>{i.product_name}{i.variant_label ? ` (${i.variant_label})` : ''} × {i.quantity}{i.listed_unit_price > i.unit_price ? ' · negotiated/discounted' : ''}</span>
                      <span>{inr(i.total_price)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-label-md mt-1">Total <strong>{inr(o.total_amount)}</strong> · you receive <strong>{inr(o.total_amount - (o.platform_fee || 0))}</strong> after the platform fee
                  {!['delivered', 'cancelled', 'refunded', 'returned'].includes(o.status) && <> · deliver by {dayDate(o.expected_delivery)}</>}</p>
                {o.return_reason && <p className="text-label-sm text-amber-800 mt-1">Return reason: {o.return_reason}</p>}
                {o.cancel_reason && <p className="text-label-sm text-on-surface-variant mt-1">Cancelled: {o.cancel_reason}</p>}
                {o.shipment && <p className="text-label-sm text-on-surface-variant mt-1">Shipment {o.shipment.shipment_number} · {titleCase(o.shipment.status)}{o.shipment.partner_name ? ` · ${o.shipment.partner_name}` : ''}</p>}

                <div className="flex flex-wrap gap-2 mt-3">
                  {next && <Button size="sm" onClick={() => run(() => setOrderStatus(o.id, next.status), `Order ${titleCase(next.status).toLowerCase()}`)}>{next.label}</Button>}
                  {o.status === 'packed' && !o.shipment && <Button size="sm" icon="local_shipping" onClick={() => openShip(o)}>Create shipment</Button>}
                  {o.shipment && <Button size="sm" variant="secondary" icon="label" onClick={async () => setDoc({ kind: 'label', data: await shippingLabel(o.shipment.id) })}>Label</Button>}
                  {o.status === 'return_requested' && <Button size="sm" onClick={() => run(() => setOrderStatus(o.id, 'returned', { notes: 'Return received' }), 'Return received — stock restored')}>Mark return received</Button>}
                  {o.status === 'returned' && <Button size="sm" onClick={() => run(() => setOrderStatus(o.id, 'refunded', { notes: 'Refund issued' }), 'Refund issued')}>Issue refund</Button>}
                  {o.can_cancel && <Button size="sm" variant="ghost" onClick={() => setRejecting(o)}>{['paid', 'payment_pending'].includes(o.status) ? 'Reject' : 'Cancel'}</Button>}
                  <Button size="sm" variant="secondary" icon="receipt" onClick={async () => setDoc({ kind: 'invoice', data: await getInvoice(o.id) })}>Invoice</Button>
                  <Button size="sm" variant="secondary" icon="chat" onClick={() => contact(o)}>Contact buyer</Button>
                  <Button size="sm" variant="ghost" icon={expanded === o.id ? 'expand_less' : 'timeline'} onClick={() => toggle(o.id)}>Timeline</Button>
                </div>
                {expanded === o.id && events[o.id] && (
                  <div className="mt-3 border-t border-outline-variant pt-3">
                    <Timeline steps={events[o.id].map((e) => ({ label: titleCase(e.status), done: true, time: dateTime(e.created_at), note: [e.actor_role, e.location, e.notes].filter(Boolean).join(' · ') }))} />
                    <p className="text-label-sm text-on-surface-variant mt-2">Deliver to: {o.shipping_address}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!shipFor} onClose={() => setShipFor(null)} title={`Create shipment — ${shipFor?.order_number || ''}`}
        footer={<><Button variant="secondary" onClick={() => setShipFor(null)}>Cancel</Button><Button onClick={submitShipment}>Create shipment & label</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Packages"><Input type="number" min="1" value={ship.package_count} onChange={(e) => setShip({ ...ship, package_count: e.target.value })} /></Field>
          <Field label="Weight (kg)"><Input type="number" step="0.1" value={ship.weight_kg} onChange={(e) => setShip({ ...ship, weight_kg: e.target.value })} /></Field>
          <Field label="Length × width × height (cm)" className="col-span-2">
            <div className="flex gap-2">
              {['length_cm', 'width_cm', 'height_cm'].map((k) => <Input key={k} type="number" value={ship[k]} onChange={(e) => setShip({ ...ship, [k]: e.target.value })} />)}
            </div>
          </Field>
          <Field label="Logistics partner" className="col-span-2" hint="Leave on automatic to pick the least busy partner near you.">
            <Select value={ship.logistics_partner_id} onChange={(e) => setShip({ ...ship, logistics_partner_id: e.target.value })}>
              <option value="">Automatic</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.company_name}{p.service_city ? ` (${p.service_city})` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Pickup time" className="col-span-2"><Input type="datetime-local" value={ship.scheduled_pickup_at} onChange={(e) => setShip({ ...ship, scheduled_pickup_at: e.target.value })} /></Field>
          <p className="col-span-2 text-label-sm text-on-surface-variant">Deliver to: {shipFor?.shipping_address}</p>
        </div>
      </Modal>

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Cancel this order?"
        footer={<Button variant="danger" onClick={() => run(async () => { await cancelOrder(rejecting.id, reason || 'Cancelled by seller'); setRejecting(null); setReason(''); }, 'Order cancelled — stock returned and buyer refunded if paid')}>Cancel order</Button>}>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason shown to the buyer (e.g. out of stock)" />
      </Modal>

      <Modal open={!!doc} onClose={() => setDoc(null)} title={doc?.kind === 'label' ? 'Shipping label' : `Invoice ${doc?.data.invoice_number || ''}`}
        footer={<Button icon="print" onClick={() => window.print()}>Print</Button>}>
        {doc?.kind === 'label' && (
          <div className="border-2 border-dashed border-on-surface rounded-lg p-4 text-label-md space-y-2">
            <p className="text-title-md font-bold tracking-wider">{doc.data.shipment_number}</p>
            <p><span className="text-on-surface-variant">From:</span> {doc.data.from.name}, {doc.data.from.address} {doc.data.from.phone && `· ${doc.data.from.phone}`}</p>
            <p><span className="text-on-surface-variant">To:</span> <strong>{doc.data.to.name}</strong>, {doc.data.to.address} {doc.data.to.phone && `· ${doc.data.to.phone}`}</p>
            <p>Order {doc.data.order_number} · {doc.data.package_count} package(s){doc.data.weight_kg ? ` · ${doc.data.weight_kg} kg` : ''}</p>
            {doc.data.partner && <p>Courier: {doc.data.partner.company_name}</p>}
            {doc.data.cash_to_collect > 0 && <p className="font-bold">COLLECT CASH: {inr(doc.data.cash_to_collect)}</p>}
            <div className="h-12 bg-[repeating-linear-gradient(90deg,#000_0_2px,transparent_2px_5px)]" aria-hidden="true" />
          </div>
        )}
        {doc?.kind === 'invoice' && (
          <div className="text-label-md space-y-2">
            <p><strong>{doc.data.seller.name}</strong><br />{doc.data.seller.address}</p>
            <p>Bill to: {doc.data.buyer.name}, {doc.data.buyer.address}</p>
            {doc.data.items.map((i) => <p key={i.id} className="flex justify-between"><span>{i.product_name}{i.variant_label ? ` (${i.variant_label})` : ''} × {i.quantity}</span><span>{inr(i.total_price)}</span></p>)}
            <p className="text-right">Discount −{inr(doc.data.discount_amount)} · Delivery {inr(doc.data.delivery_charge)}</p>
            <p className="text-right font-bold">Total {inr(doc.data.total_amount)}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
