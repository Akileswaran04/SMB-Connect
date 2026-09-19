/** Seller customers (PRD §29/§37): buyers who ordered from or messaged the store. */
import { useState, useEffect } from 'react';
import { sellerCustomers, openConversationWithBuyer } from '../../services/smb';
import { PageHeader, Card, Loading, Empty, Button, Badge } from '../../components/ui';
import { inr, dateShort } from '../../utils/format';
import { TAB_KEYS } from '../MODULES';

export default function CustomersTab({ go, onToast }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { sellerCustomers().then(setRows).catch(() => setRows([])); }, []);

  const message = async (c) => {
    try {
      await openConversationWithBuyer(c.buyer_id);
      go(TAB_KEYS.INBOX);
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Customers" subtitle="People who have bought from you or asked you something." />
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty icon="group" title="No customers yet" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-label-md">
            <thead className="text-left text-on-surface-variant border-b border-outline-variant">
              <tr><th className="p-3">Customer</th><th className="p-3">City</th><th className="p-3 text-right">Orders</th><th className="p-3 text-right">Spent</th><th className="p-3">Last order</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.buyer_id} className="border-b border-outline-variant/60">
                  <td className="p-3 font-semibold text-on-surface">{c.name}{c.orders >= 2 && <Badge tone="green" className="ml-2">Repeat</Badge>}</td>
                  <td className="p-3 text-on-surface-variant">{c.city || '—'}</td>
                  <td className="p-3 text-right">{c.orders}</td>
                  <td className="p-3 text-right">{inr(c.total_spent)}</td>
                  <td className="p-3">{c.last_order_at ? dateShort(c.last_order_at) : '—'}</td>
                  <td className="p-3 text-right"><Button size="sm" variant="secondary" icon="chat" onClick={() => message(c)}>Message</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
