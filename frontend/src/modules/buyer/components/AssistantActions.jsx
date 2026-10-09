/**
 * Buttons for actions the assistant proposes. Anything that commits the
 * buyer — sending an offer or a message — asks for explicit confirmation
 * first (PRD §18: the AI never commits the buyer on its own).
 */
import { useState } from 'react';
import { sendOffer, openConversationWithSeller, sendChatMessage, addToCart, reorder } from '../../../services/smb';
import { Button, Modal } from '../../../components/ui';
import { inr } from '../../../utils/format';

const ICONS = { send_offer: 'sell', send_message: 'send', add_to_cart: 'add_shopping_cart', reorder: 'replay',
  track_order: 'local_shipping', view_product: 'visibility' };

export default function AssistantActions({ actions, onToast, onOpenOrder, onOpenCart, onOpenProduct, onOpenChat, onDone }) {
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!actions?.length) return null;

  const execute = async (action) => {
    const p = action.payload || {};
    setBusy(true);
    try {
      if (action.type === 'send_offer') {
        const offer = await sendOffer(p.product_id, p.offered_price, p.quantity || 1);
        const msg = offer.status === 'accepted' ? 'Offer accepted — add it to your cart from the product page.'
          : offer.status === 'countered' ? (offer.message || 'The seller countered your offer.')
            : offer.status === 'rejected' ? (offer.message || 'The seller declined that price.') : 'Offer sent to the seller.';
        onToast?.(msg, offer.status === 'rejected' ? 'error' : 'success');
      } else if (action.type === 'send_message') {
        const convo = await openConversationWithSeller(p.seller_id);
        await sendChatMessage(convo.id, p.text);
        onToast?.('Message sent — it will be translated for the seller.');
        onOpenChat?.(convo.id);
      } else if (action.type === 'add_to_cart') {
        await addToCart({ product_id: p.product_id, variant_id: p.variant_id ?? null, quantity: 1 });
        onToast?.('Added to cart');
        onOpenCart?.();
      } else if (action.type === 'reorder') {
        const r = await reorder(p.order_id);
        onToast?.(r.added_to_cart ? 'Added to your cart — review and check out.' : 'Those items are no longer available.',
          r.added_to_cart ? 'success' : 'error');
        if (r.added_to_cart) onOpenCart?.({ addressId: r.address_id, deliveryOption: r.delivery_option, paymentMethod: r.payment_method });
      } else if (action.type === 'track_order') {
        onOpenOrder?.(p.order_id);
      } else if (action.type === 'view_product') {
        onOpenProduct?.(p.product_id);
      }
      onDone?.(action);
    } catch (err) {
      onToast?.(err.message || 'That did not work', 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const click = (action) => (['send_offer', 'send_message'].includes(action.type) ? setConfirm(action) : execute(action));

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {actions.map((a, i) => (
          <Button key={`${a.type}-${i}`} size="sm" variant={i === 0 ? 'primary' : 'secondary'} icon={ICONS[a.type]} onClick={() => click(a)} disabled={busy}>
            {a.label}
          </Button>
        ))}
      </div>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Please confirm"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button onClick={() => execute(confirm)} disabled={busy}>{busy ? 'Sending…' : 'Yes, send it'}</Button>
        </>}>
        {confirm?.type === 'send_offer' && (
          <p className="text-body-md text-on-surface">Send an offer of <strong>{inr(confirm.payload.offered_price)}</strong> to the seller? If they accept, you can buy at this price.</p>
        )}
        {confirm?.type === 'send_message' && (
          <p className="text-body-md text-on-surface">Send this to the seller?<br /><em>“{confirm.payload.text}”</em></p>
        )}
      </Modal>
    </>
  );
}
