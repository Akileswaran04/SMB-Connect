/** "ORDER CONFIRMED" (PRD §22): order id, product, seller, amount, expected delivery, Track Order. */
import { Icon, Button } from '../../../components/ui';
import { inr, dayDate } from '../../../utils/format';

export default function OrderConfirmation({ orders, onTrack, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <span className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center">
          <Icon name="check" size={36} />
        </span>
        <h2 className="text-headline-sm font-bold text-on-surface mt-3">ORDER CONFIRMED</h2>
        <p className="text-body-md text-on-surface-variant">Thank you! We've let the seller{orders.length > 1 ? 's' : ''} know.</p>
        <div className="mt-4 space-y-3 text-left">
          {orders.map((o) => (
            <div key={o.id} className="border border-outline-variant rounded-xl p-3 text-label-md">
              <p className="text-label-sm text-on-surface-variant">Order ID</p>
              <p className="font-semibold text-on-surface">{o.order_number}</p>
              <p className="mt-1.5 text-on-surface">{o.items.map((i) => `${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ''} × ${i.quantity}`).join(', ')}</p>
              <p className="text-on-surface-variant">Seller: {o.seller_name}</p>
              <div className="flex justify-between mt-1.5">
                <span>Amount <strong>{inr(o.total_amount)}</strong></span>
                <span>Expected <strong>{dayDate(o.expected_delivery)}</strong></span>
              </div>
              {o.payment_method === 'cod' && <p className="text-label-sm text-amber-800 mt-1">Pay {inr(o.total_amount)} in cash on delivery.</p>}
              <Button size="sm" className="w-full mt-2" icon="local_shipping" onClick={() => onTrack(o.id)}>Track order</Button>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="text-label-md text-primary font-medium mt-4">Continue shopping</button>
      </div>
    </div>
  );
}
