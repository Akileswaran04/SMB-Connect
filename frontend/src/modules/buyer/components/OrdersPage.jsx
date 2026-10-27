/**
 * My Orders (PRD §23): All / Active / Delivered / Cancelled, each order with
 * product, seller, amount, date, status and delivery estimate, and the
 * actions that apply: track, details, contact seller, reorder, return, cancel.
 */
import { useState, useEffect, useCallback } from 'react';
import { listOrders, reorder, cancelOrder, openConversationWithSeller } from '../../../services/smb';
import { Tabs, StatusBadge, Button, Loading, LoadError, Empty, Card, Icon, Modal, Textarea, QuickReasons } from '../../../components/ui';
import { inr, dateShort, dayDate, REASONS } from '../../../utils/format';
import { t } from '../../../i18n';

const TABS = [{ key: 'all', label: 'All' }, { key: 'active', label: 'On the way' }, { key: 'delivered', label: 'Delivered' }, { key: 'cancelled', label: 'Cancelled' }];

export default function OrdersPage({ onOpenOrder, onOpenCart, onChatOpened, onToast, onShop }) {
  const [tab, setTab] = useState('all');
  const [orders, setOrders] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setOrders(null);
    setError('');
    try { setOrders((await listOrders(tab)).items); } catch (err) { setError(err.message); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const buyAgain = async (o) => {
    try {
      const r = await reorder(o.id);
      onToast?.(r.added_to_cart ? t('Added to your cart') : t('These items are not available now'), r.added_to_cart ? 'success' : 'error');
      if (r.added_to_cart) onOpenCart({ addressId: r.address_id, deliveryOption: r.delivery_option, paymentMethod: r.payment_method });
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  const contact = async (o) => {
    try { onChatOpened((await openConversationWithSeller(o.seller_id)).id); } catch (err) { onToast?.(err.message, 'error'); }
  };

  const confirmCancel = async () => {
    try {
      await cancelOrder(cancelling.id, reason || 'Changed my mind');
      onToast?.(cancelling.payment_status === 'completed' ? t('Order cancelled — your money will come back') : t('Order cancelled'));
      setCancelling(null);
      setReason('');
      load();
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  return (
    <div>
      <h1 className="text-headline-md text-on-surface font-semibold mb-3">{t('My Orders')}</h1>
      <Tabs tabs={TABS.map((x) => ({ ...x, label: t(x.label) }))} value={tab} onChange={setTab} />
      {error ? <LoadError message={error} onRetry={load} /> : orders === null ? <Loading /> : orders.length === 0 ? (
        <Empty icon="receipt_long" title={t('No orders here yet')} action={onShop && <Button size="lg" icon="storefront" onClick={onShop}>{t('Start shopping')}</Button>} />
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
                  <p className="text-label-sm text-on-surface-variant">{o.seller_name} · {dateShort(o.created_at)}</p>
                  <p className="text-label-md text-on-surface mt-1">
                    <strong>{inr(o.total_amount)}</strong>
                    {!['delivered', 'cancelled', 'returned', 'refunded'].includes(o.status) && o.expected_delivery && (
                      <span className="text-on-surface-variant"> · {t('arrives by')} {dayDate(o.expected_delivery)}</span>
                    )}
                  </p>
                </div>
              </div>
              {o.delivery_otp && (
                <p className="mt-3 flex items-center gap-3 bg-primary-container/10 border border-primary/30 rounded-lg px-3 py-2">
                  <Icon name="password" className="text-primary" />
                  <span className="text-label-md">{t('Delivery code — tell the courier only when you have the parcel:')} <strong className="text-title-md tracking-[0.25em] text-primary">{o.delivery_otp}</strong></span>
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <Button icon="local_shipping" onClick={() => onOpenOrder(o.id)}>
                  {['delivered', 'cancelled', 'returned', 'refunded'].includes(o.status) ? t('See details') : t('Where is my order?')}
                </Button>
                <Button variant="secondary" icon="chat" onClick={() => contact(o)}>{t('Message seller')}</Button>
                {['delivered', 'return_requested', 'returned', 'refunded', 'cancelled'].includes(o.status) && (
                  <Button variant="secondary" icon="replay" onClick={() => buyAgain(o)}>{t('Buy again')}</Button>
                )}
                {o.can_return && <Button variant="secondary" icon="assignment_return" onClick={() => onOpenOrder(o.id, 'return')}>{t('Return')}</Button>}
                {o.can_cancel && <Button variant="ghost" icon="cancel" onClick={() => setCancelling(o)}>{t('Cancel')}</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!cancelling} onClose={() => setCancelling(null)} title={t('Cancel this order?')}
        footer={<><Button variant="secondary" onClick={() => setCancelling(null)}>{t('Keep order')}</Button><Button variant="danger" onClick={confirmCancel}>{t('Yes, cancel order')}</Button></>}>
        <p className="text-body-md text-on-surface mb-3">
          {cancelling?.payment_status === 'completed' ? t('You will get all your money back: {amount}.', { amount: inr(cancelling?.total_amount) }) : t('You have not paid anything yet.')}
        </p>
        <p className="text-label-md text-on-surface-variant mb-2">{t('Why? (optional)')}</p>
        <QuickReasons options={REASONS.cancel} value={reason} onPick={setReason} />
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Or write your reason')} />
      </Modal>
    </div>
  );
}
