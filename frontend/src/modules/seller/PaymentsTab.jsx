/** Seller money (PRD §39): what each order pays you after the fee, and whether it has reached your bank. */
import { useState, useEffect, useCallback } from 'react';
import { sellerPayments } from '../../services/smb';
import { PageHeader, Stat, Card, Loading, LoadError, Empty, StatusBadge } from '../../components/ui';
import { inr, dateShort, paymentText } from '../../utils/format';
import { t } from '../../i18n';

export default function PaymentsTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    sellerPayments().then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <LoadError message={error} onRetry={load} />;
  if (!data) return <Loading />;
  const tot = data.totals;
  return (
    <div>
      <PageHeader title={t('Payments')} subtitle={t('What each order pays you after the SMBConnect fee, and when it reaches your bank.')} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat icon="account_balance" tone="green" label={t('Paid to your bank')} value={inr(tot.settled || 0)} />
        <Stat icon="schedule" tone="blue" label={t('Coming to you')} value={inr((tot.scheduled || 0) + (tot.not_yet_due || 0))} note={t('Paid after the buyer receives the order')} />
        <Stat icon="payments" label={t('Total sales')} value={inr(tot.gross || 0)} />
        <Stat icon="receipt_long" tone="slate" label={t('SMBConnect fees')} value={inr(tot.platform_fees || 0)} />
      </div>
      {data.items.length === 0 ? <Empty icon="payments" title={t('No payments yet')}>{t('Money from your orders will show here.')}</Empty> : (
        <div className="space-y-2">
          {data.items.map((r) => (
            <Card key={r.order_id} className="p-4">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="text-title-sm font-semibold">{t('Order')} {r.order_number}</p>
                  <p className="text-label-md text-on-surface-variant">{dateShort(r.created_at)} · {paymentText(r.payment_method)}</p>
                </div>
                <div className="text-right">
                  <p className="text-title-md font-bold">{inr(r.net_amount)}</p>
                  <p className="text-label-sm text-on-surface-variant">{t('you get')}</p>
                </div>
              </div>
              <p className="text-label-md text-on-surface-variant mt-1">
                {t('Order')} {inr(r.order_amount)}
                {r.discount ? ` · ${t('Discount')} −${inr(r.discount)}` : ''}
                {r.delivery_charge ? ` · ${t('Delivery')} ${inr(r.delivery_charge)}` : ''}
                {r.platform_fee ? ` · ${t('Fee')} −${inr(r.platform_fee)}` : ''}
              </p>
              <div className="flex flex-wrap gap-2 mt-2 items-center">
                {r.payment_status && <StatusBadge status={r.payment_status} />}
                {r.settlement_status && <StatusBadge status={r.settlement_status} />}
                {r.settled_at && <span className="text-label-sm text-on-surface-variant">{t('on {date}', { date: dateShort(r.settled_at) })}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
