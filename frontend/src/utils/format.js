/** Shared formatting — every price in the app is Indian rupees. */
import { t } from '../i18n';

export function inr(value, { decimals } = {}) {
  const n = Number(value || 0);
  const digits = decimals ?? (Number.isInteger(n) ? 0 : 2);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function dateShort(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dayDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function dateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(value) {
  if (!value) return '';
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return t('just now');
  if (diff < 3600) return t('{n} min ago', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('{n} hours ago', { n: Math.floor(diff / 3600) });
  return dateShort(value);
}

export function titleCase(status) {
  return (status || '').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function deliveryText(days) {
  if (days == null) return '';
  return days <= 1 ? t('Delivery tomorrow') : t('Delivery in {n} days', { n: days });
}

const STATUS_TONE = {
  payment_pending: 'amber', paid: 'blue', seller_confirmed: 'blue', processing: 'indigo', packed: 'indigo',
  ready_for_pickup: 'purple', picked_up: 'purple', in_transit: 'purple', out_for_delivery: 'purple',
  delivered: 'green', cancelled: 'red', delivery_failed: 'red', return_requested: 'amber', returned: 'slate',
  refunded: 'slate', created: 'amber', pickup_assigned: 'blue', at_hub: 'purple', returned_to_seller: 'slate',
  open: 'amber', under_review: 'blue', resolved: 'green', rejected: 'red', verified: 'green', draft: 'slate',
  submitted: 'amber', suspended: 'red', published: 'green', archived: 'slate', deleted: 'red', pending: 'amber',
  accepted: 'green', countered: 'blue', completed: 'green', settled: 'green', scheduled: 'blue', unsettled: 'slate',
};

export function statusTone(status) {
  return STATUS_TONE[status] || 'slate';
}

/** Plain-language status for every role. Raw codes never reach the screen. */
const STATUS_TEXT = {
  payment_pending: 'Waiting for payment', paid: 'Paid — waiting for seller', seller_confirmed: 'Seller accepted',
  confirmed: 'Confirmed', processing: 'Being packed', packed: 'Packed', ready_for_pickup: 'Ready for courier',
  picked_up: 'Picked up by courier', in_transit: 'On the way', at_hub: 'At courier centre',
  out_for_delivery: 'Out for delivery today', delivered: 'Delivered', cancelled: 'Cancelled',
  delivery_failed: 'Delivery missed — will retry', return_requested: 'Return requested', returned: 'Returned',
  refunded: 'Money refunded', created: 'Shipment created', pickup_assigned: 'Courier assigned',
  returned_to_seller: 'Sent back to seller', open: 'Open', under_review: 'Being checked', resolved: 'Solved',
  rejected: 'Rejected', verified: 'Verified', draft: 'Not submitted', submitted: 'Waiting for approval',
  suspended: 'Suspended', published: 'Live', archived: 'Hidden', deleted: 'Removed', pending: 'Waiting',
  accepted: 'Accepted', countered: 'Counter offer', completed: 'Done', settled: 'Paid to you',
  scheduled: 'Scheduled', unsettled: 'Not paid yet', failed: 'Failed',
};

export function statusText(status) {
  return t(STATUS_TEXT[status] || titleCase(status));
}

const PAYMENT_TEXT = { cod: 'Cash on delivery', upi: 'UPI', card: 'Card', netbanking: 'Net banking' };
export function paymentText(method) {
  return t(PAYMENT_TEXT[method] || titleCase(method));
}

/** Tap-to-fill reasons so nobody has to type a sentence. */
export const REASONS = {
  return: ['Size does not fit', 'Item is damaged', 'Wrong item received', 'Not as shown in photo', 'Quality is poor'],
  cancel: ['Ordered by mistake', 'Found a better price', 'Delivery is too late', 'Changed my mind'],
  sellerCancel: ['Out of stock', 'Cannot deliver to this address', 'Price was wrong', 'Buyer asked to cancel'],
  report: ['Wrong price', 'Fake or copied product', 'Wrong photos', 'Offensive content'],
  deliveryFailed: ['Customer not available', 'Address not found', 'Customer refused', 'Phone not reachable'],
};

/** Dispute codes the backend expects, with what the buyer actually reads. */
export const DISPUTE_REASONS = [
  ['item_not_received', "I didn't receive it"], ['damaged', 'It arrived damaged'], ['wrong_item', 'Wrong item'],
  ['not_as_described', 'Not as described'], ['refund_issue', "Refund hasn't come"], ['payment_issue', 'Payment problem'],
  ['other', 'Something else'],
];
