/** Seller payments (PRD §39): per order amount, discount, delivery, platform fee, net, payment and settlement status. */
import { useState, useEffect } from 'react';
import { sellerPayments } from '../../services/smb';
import { PageHeader, Stat, Card, Loading, Empty, StatusBadge } from '../../components/ui';
import { inr, dateShort, titleCase } from '../../utils/format';

export default function PaymentsTab() {
  const [data, setData] = useState(null);
  useEffect(() => { sellerPayments().then(setData).catch(() => setData({ items: [], totals: {} })); }, []);
  if (!data) return <Loading />;
  const t = data.totals;
  return (
    <div>
      <PageHeader title="Payments" subtitle="What each order earns you after the platform fee, and when it's paid out." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat icon="payments" label="Gross sales" value={inr(t.gross || 0)} />
        <Stat icon="receipt_long" tone="slate" label="Platform fees" value={inr(t.platform_fees || 0)} />
        <Stat icon="account_balance" tone="green" label="Settled to you" value={inr(t.settled || 0)} />
        <Stat icon="schedule" tone="blue" label="Scheduled / not yet due" value={inr((t.scheduled || 0) + (t.not_yet_due || 0))} note={`${inr(t.scheduled || 0)} scheduled after delivery`} />
      </div>
      {data.items.length === 0 ? <Empty icon="payments" title="No payments yet" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-label-md">
            <thead className="text-left text-on-surface-variant border-b border-outline-variant">
              <tr><th className="p-3">Order</th><th className="p-3 text-right">Order amount</th><th className="p-3 text-right">Discount</th><th className="p-3 text-right">Delivery</th>
                <th className="p-3 text-right">Platform fee</th><th className="p-3 text-right">Net</th><th className="p-3">Payment</th><th className="p-3">Settlement</th></tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.order_id} className="border-b border-outline-variant/60">
                  <td className="p-3"><span className="font-semibold">{r.order_number}</span><span className="block text-label-sm text-on-surface-variant">{dateShort(r.created_at)} · {titleCase(r.order_status)}</span></td>
                  <td className="p-3 text-right">{inr(r.order_amount)}</td>
                  <td className="p-3 text-right text-emerald-700">{r.discount ? `−${inr(r.discount)}` : '—'}</td>
                  <td className="p-3 text-right">{r.delivery_charge ? inr(r.delivery_charge) : '—'}</td>
                  <td className="p-3 text-right">{r.platform_fee ? `−${inr(r.platform_fee)}` : '—'}</td>
                  <td className="p-3 text-right font-semibold">{inr(r.net_amount)}</td>
                  <td className="p-3">{r.payment_status ? <StatusBadge status={r.payment_status} /> : '—'}<span className="block text-label-sm text-on-surface-variant">{titleCase(r.payment_method)}</span></td>
                  <td className="p-3">{r.settlement_status ? <StatusBadge status={r.settlement_status} /> : '—'}{r.settled_at && <span className="block text-label-sm text-on-surface-variant">{dateShort(r.settled_at)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
