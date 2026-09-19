/** Seller dashboard (PRD §31) — today's work at a glance, each tile linking to its page. */
import { useEffect, useState } from 'react';
import { sellerDashboard } from '../../services/smb';
import { Stat, Card, PageHeader, Loading, Icon, Button, ErrorNote } from '../../components/ui';
import { inr, titleCase } from '../../utils/format';
import { TAB_KEYS } from '../MODULES';

const TONE = { error: 'bg-red-50 border-red-200 text-red-900', warning: 'bg-amber-50 border-amber-200 text-amber-900', info: 'bg-blue-50 border-blue-200 text-blue-900' };

export default function DashboardTab({ seller, go }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    sellerDashboard().then(setD).catch((e) => setError(e.message || 'Could not load the dashboard'));
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!d) return <Loading />;

  return (
    <div className="space-y-5">
      <PageHeader title={`Hello, ${seller.business_name}`} subtitle="Here's what needs your attention today." />

      {d.alerts.length > 0 && (
        <div className="space-y-2">
          {d.alerts.map((a) => (
            <div key={a.message} className={`border rounded-xl px-4 py-3 text-label-md flex items-center gap-2 ${TONE[a.level] || TONE.info}`}>
              <Icon name={a.level === 'info' ? 'info' : 'warning'} size={18} />{a.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon="today" label="Today's orders" value={d.todays_orders} onClick={() => go(TAB_KEYS.ORDERS)} />
        <Stat icon="pending_actions" label="Pending orders" value={d.pending_orders} tone="amber" onClick={() => go(TAB_KEYS.ORDERS)}
          note={Object.entries(d.pending_by_status).map(([s, n]) => `${n} ${titleCase(s).toLowerCase()}`).join(' · ') || null} />
        <Stat icon="currency_rupee" label="Revenue today" value={inr(d.revenue_today)} tone="green" onClick={() => go(TAB_KEYS.PAYMENTS)}
          note={`${inr(d.revenue_30_days)} in the last 30 days`} />
        <Stat icon="sell" label="Negotiation requests" value={d.negotiation_requests} tone="purple" onClick={() => go(TAB_KEYS.NEGOTIATION)} />
        <Stat icon="chat" label="Unread customer messages" value={d.customer_messages} tone="blue" onClick={() => go(TAB_KEYS.INBOX)} />
        <Stat icon="local_shipping" label="Awaiting pickup" value={d.shipments.awaiting_pickup} tone="indigo" onClick={() => go(TAB_KEYS.SHIPMENTS)} />
        <Stat icon="conveyor_belt" label="In transit" value={d.shipments.in_transit} tone="indigo" onClick={() => go(TAB_KEYS.SHIPMENTS)} />
        <Stat icon="error" label="Failed deliveries" value={d.shipments.failed} tone="red" onClick={() => go(TAB_KEYS.SHIPMENTS)} />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-title-md font-semibold">Low-stock alerts</h2>
          <Button variant="ghost" size="sm" onClick={() => go(TAB_KEYS.INVENTORY)}>Open inventory</Button>
        </div>
        {d.low_stock.length === 0 ? (
          <p className="text-label-md text-on-surface-variant mt-2">All products are well stocked.</p>
        ) : (
          <ul className="mt-2 divide-y divide-outline-variant/60">
            {d.low_stock.map((p) => (
              <li key={p.id} className="py-2 flex justify-between text-label-md">
                <span className="text-on-surface">{p.name}</span>
                <span className={p.stock === 0 ? 'text-error font-semibold' : 'text-amber-700 font-semibold'}>{p.stock === 0 ? 'Out of stock' : `${p.stock} left`}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
