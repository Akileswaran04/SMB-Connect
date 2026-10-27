/**
 * Seller home (PRD §31) — what to do right now, in order: orders waiting,
 * a setup checklist for new shops, then today's numbers. Every tile opens
 * its page.
 */
import { useEffect, useState, useCallback } from 'react';
import { sellerDashboard, listMyProducts } from '../../services/smb';
import { Stat, Card, PageHeader, Loading, LoadError, Icon, Button } from '../../components/ui';
import { inr, statusText } from '../../utils/format';
import { t } from '../../i18n';
import { TAB_KEYS } from '../MODULES';

const TONE = { error: 'bg-red-50 border-red-200 text-red-900', warning: 'bg-amber-50 border-amber-200 text-amber-900', info: 'bg-blue-50 border-blue-200 text-blue-900' };

function Checklist({ seller, productCount, go }) {
  const steps = [
    { done: productCount > 0, label: 'Add your first product', tab: TAB_KEYS.PRODUCTS },
    { done: !!(seller.bank_account_last4 || seller.upi_id), label: 'Add your bank account or UPI to get paid', tab: TAB_KEYS.PROFILE },
    { done: ['submitted', 'under_review', 'verified'].includes(seller.verification_status), label: 'Send your shop for verification', tab: TAB_KEYS.PROFILE },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  return (
    <Card className="p-4 border-primary/40">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title-md font-semibold text-on-surface">{t('Get your shop ready')}</h2>
        <span className="text-label-md text-on-surface-variant">{t('{done} of {total} done', { done: doneCount, total: steps.length })}</span>
      </div>
      <div className="h-2 bg-surface-container rounded mt-2"><div className="h-full bg-primary rounded" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
      <ol className="mt-3 space-y-1">
        {steps.map((s, i) => (
          <li key={s.label}>
            <button onClick={() => !s.done && go(s.tab)} disabled={s.done}
              className="w-full min-h-12 flex items-center gap-3 px-2 rounded-lg text-left hover:bg-surface-container disabled:hover:bg-transparent">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-emerald-600 text-white' : 'border-2 border-primary text-primary font-bold'}`}>
                {s.done ? <Icon name="check" size={18} /> : i + 1}
              </span>
              <span className={`flex-1 text-body-md ${s.done ? 'text-on-surface-variant line-through' : 'text-on-surface font-medium'}`}>{t(s.label)}</span>
              {!s.done && <Icon name="chevron_right" className="text-primary" />}
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function DashboardTab({ seller, go }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [productCount, setProductCount] = useState(null);

  const load = useCallback(() => {
    setError('');
    sellerDashboard().then(setD).catch((e) => setError(e.message));
    listMyProducts().then((r) => setProductCount(r.items.length)).catch(() => setProductCount(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <LoadError message={error} onRetry={load} />;
  if (!d) return <Loading />;

  return (
    <div className="space-y-5">
      <PageHeader title={t('Hello, {name}', { name: seller.business_name })} subtitle={t("Here's what needs your attention today.")} />

      {d.pending_orders > 0 && (
        <button onClick={() => go(TAB_KEYS.ORDERS)}
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-primary text-on-primary text-left shadow-sm active:scale-[0.99]">
          <span className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"><Icon name="notifications_active" size={26} /></span>
          <span className="flex-1">
            <span className="block text-title-lg font-bold">{t('{n} orders are waiting for you', { n: d.pending_orders })}</span>
            <span className="block text-body-md opacity-90">
              {Object.entries(d.pending_by_status).map(([s, n]) => `${n} ${statusText(s)}`).join(' · ') || t('Tap to open your orders')}
            </span>
          </span>
          <Icon name="arrow_forward" size={26} />
        </button>
      )}

      {productCount !== null && <Checklist seller={seller} productCount={productCount} go={go} />}

      {d.alerts.length > 0 && (
        <div className="space-y-2">
          {d.alerts.map((a) => (
            <div key={a.message} className={`border rounded-xl px-4 py-3 text-body-md flex items-center gap-2 ${TONE[a.level] || TONE.info}`}>
              <Icon name={a.level === 'info' ? 'info' : 'warning'} size={20} />{t(a.message)}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon="today" label={t("Today's orders")} value={d.todays_orders} onClick={() => go(TAB_KEYS.ORDERS)} />
        <Stat icon="currency_rupee" label={t('Sales today')} value={inr(d.revenue_today)} tone="green" onClick={() => go(TAB_KEYS.PAYMENTS)}
          note={t('{amount} in the last 30 days', { amount: inr(d.revenue_30_days) })} />
        <Stat icon="sell" label={t('Price offers from buyers')} value={d.negotiation_requests} tone="purple" onClick={() => go(TAB_KEYS.NEGOTIATION)} />
        <Stat icon="chat" label={t('Unread messages')} value={d.customer_messages} tone="blue" onClick={() => go(TAB_KEYS.INBOX)} />
        <Stat icon="local_shipping" label={t('Waiting for courier')} value={d.shipments.awaiting_pickup} tone="indigo" onClick={() => go(TAB_KEYS.SHIPMENTS)} />
        <Stat icon="conveyor_belt" label={t('On the way')} value={d.shipments.in_transit} tone="indigo" onClick={() => go(TAB_KEYS.SHIPMENTS)} />
        <Stat icon="error" label={t('Missed deliveries')} value={d.shipments.failed} tone="red" onClick={() => go(TAB_KEYS.SHIPMENTS)} />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-title-md font-semibold">{t('Running out of stock')}</h2>
          <Button variant="ghost" size="sm" onClick={() => go(TAB_KEYS.INVENTORY)}>{t('Open stock')}</Button>
        </div>
        {d.low_stock.length === 0 ? (
          <p className="text-body-md text-on-surface-variant mt-2">{t('All products have enough stock.')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-outline-variant/60">
            {d.low_stock.map((p) => (
              <li key={p.id} className="py-2.5 flex justify-between gap-2 text-body-md">
                <span className="text-on-surface">{p.name}</span>
                <span className={p.stock === 0 ? 'text-error font-semibold' : 'text-amber-700 font-semibold'}>{p.stock === 0 ? t('Out of stock') : t('{n} left', { n: p.stock })}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
