/**
 * My Orders (PRD §23): All / Active / Delivered / Cancelled, each order with
 * product, seller, amount, date, status and delivery estimate, and the
 * actions that apply: track, details, contact seller, reorder, return, cancel.
 */
import { useState, useEffect, useCallback } from 'react';
import { listOrders, reorder, cancelOrder, openConversationWithSeller } from '../../../services/smb';
import { Tabs, StatusBadge, Button, Loading, Empty, Card, Icon, Modal, Textarea } from '../../../components/ui';
import { inr, dateShort, dayDate } from '../../../utils/format';

const TABS = [{ key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'delivered', label: 'Delivered' }, { key: 'cancelled', label: 'Cancelled' }];

export default function OrdersPage({ onOpenOrder, onOpenCart, onChatOpened, onToast }) {
  const [tab, setTab] = useState('all');
  const [orders, setOrders] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setOrders(null);
    setOrders((await listOrders(tab).catch(() => ({ items: [] }))).items);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const buyAgain = async (o) => {
    try {
      const r = await reorder(o.id);
      onToast?.(r.added_to_cart ? 'Added to cart — review before paying' : 'These items are unavailable', r.added_to_cart ? 'success' : 'error');
      if (r.added_to_cart) onOpenCart({ addressId: r.address_id, deliveryOption: r.delivery_option, paymentMethod: r.payment_method });
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  const contact = async (o) => {
    try { onChatOpened((await openConversationWithSeller(o.seller_id)).id); } catch (err) { onToast?.(err.message, 'error'); }
  };

  const confirmCancel = async () => {
    try {
      await cancelOrder(cancelling.id, reason || 'Changed my mind');
      onToast?.('Order cancelled' + (cancelling.payment_status === 'completed' ? ' — your refund is on its way' : ''));
      setCancelling(null);
      setReason('');
      load();
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  return (
    <div>
      <h1 className="text-headline-md text-on-surface font-semibold mb-3">My Orders</h1>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {orders === null ? <Loading /> : orders.length === 0 ? (
        <Empty icon="receipt_long" title="No orders here yet" />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-lg bg-surface-container overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {o.items[0]?.image_url ? <img src={o.items[0].image_url} alt="" className="w-full h-full object-cover" /> : <Icon name="inventory_2" className="text-on-surface-variant/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-label-md font-semibold text-on-surface">
                      {o.items.map((i) => `${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ''}`).join(', ')}
                    </p>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="text-label-sm text-on-surface-variant">{o.seller_name} · {dateShort(o.created_at)} · {o.order_number}</p>
                  <p className="text-label-md text-on-surface mt-1">
                    <strong>{inr(o.total_amount)}</strong>
                    {!['delivered', 'cancelled', 'returned', 'refunded'].includes(o.status) && o.expected_delivery && (
                      <span className="text-on-surface-variant"> · arrives by {dayDate(o.expected_delivery)}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" icon="local_shipping" onClick={() => onOpenOrder(o.id)}>
                  {['delivered', 'cancelled', 'returned', 'refunded'].includes(o.status) ? 'View details' : 'Track'}
                </Button>
                <Button size="sm" variant="secondary" icon="chat" onClick={() => contact(o)}>Contact seller</Button>
                {['delivered', 'return_requested', 'returned', 'refunded', 'cancelled'].includes(o.status) && (
                  <Button size="sm" variant="secondary" icon="replay" onClick={() => buyAgain(o)}>Buy again</Button>
                )}
                {o.can_return && <Button size="sm" variant="secondary" icon="assignment_return" onClick={() => onOpenOrder(o.id, 'return')}>Return</Button>}
                {o.can_cancel && <Button size="sm" variant="ghost" icon="cancel" onClick={() => setCancelling(o)}>Cancel</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!cancelling} onClose={() => setCancelling(null)} title="Cancel this order?"
        footer={<><Button variant="secondary" onClick={() => setCancelling(null)}>Keep order</Button><Button variant="danger" onClick={confirmCancel}>Cancel order</Button></>}>
        <p className="text-body-md text-on-surface mb-3">
          {cancelling?.payment_status === 'completed' ? `You'll get a full refund of ${inr(cancelling?.total_amount)}.` : 'Nothing has been charged yet.'}
        </p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
      </Modal>
    </div>
  );
}
