/** Shared formatting — every price in the app is Indian rupees. */

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
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return dateShort(value);
}

export function titleCase(status) {
  return (status || '').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function deliveryText(days) {
  if (days == null) return '';
  return days <= 1 ? 'Delivery tomorrow' : `Delivery in ${days} days`;
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
