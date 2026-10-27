/** "Order placed" (PRD §22): order number, items, seller, amount, delivery date, and what happens next. */
import { Icon, Button } from '../../../components/ui';
import { inr, dayDate } from '../../../utils/format';
import { t } from '../../../i18n';

export default function OrderConfirmation({ orders, onTrack, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 text-center shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <span className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center">
          <Icon name="check" size={36} />
        </span>
        <h2 className="text-headline-sm font-bold text-on-surface mt-3">{t('Your order is placed!')}</h2>
        <p className="text-body-md text-on-surface-variant">{t('Thank you. The seller has been told.')}</p>
        <div className="mt-4 space-y-3 text-left">
          {orders.map((o) => (
            <div key={o.id} className="border border-outline-variant rounded-xl p-3 text-body-md">
              <p className="text-on-surface">{o.items.map((i) => `${i.quantity} × ${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ''}`).join(', ')}</p>
              <p className="text-label-md text-on-surface-variant">{o.seller_name} · {t('Order')} {o.order_number}</p>
              <div className="flex justify-between mt-1.5">
                <span><strong>{inr(o.total_amount)}</strong></span>
                <span>{t('Arrives by')} <strong>{dayDate(o.expected_delivery)}</strong></span>
              </div>
              {o.payment_method === 'cod' && <p className="text-label-md text-amber-800 mt-1">{t('Keep {amount} cash ready for the delivery person.', { amount: inr(o.total_amount) })}</p>}
              <Button className="w-full mt-2" icon="local_shipping" onClick={() => onTrack(o.id)}>{t('Track order')}</Button>
            </div>
          ))}
        </div>
        <div className="mt-4 text-left bg-surface-container-low rounded-xl p-3 text-label-md text-on-surface space-y-1">
          <p className="font-semibold">{t('What happens next')}</p>
          <p>1. {t('The seller packs your order.')}</p>
          <p>2. {t('A courier brings it to you. We will send you updates.')}</p>
          <p>3. {t('When it arrives, show the delivery code from My Orders.')}</p>
        </div>
        <button onClick={onClose} className="h-11 px-4 text-label-md text-primary font-medium mt-3">{t('Continue shopping')}</button>
      </div>
    </div>
  );
}
