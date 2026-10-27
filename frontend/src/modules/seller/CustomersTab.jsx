/** Seller customers (PRD §29/§37): buyers who ordered from or messaged the shop. */
import { useState, useEffect, useCallback } from 'react';
import { sellerCustomers, openConversationWithBuyer } from '../../services/smb';
import { PageHeader, Card, Loading, LoadError, Empty, Button, Badge } from '../../components/ui';
import { inr, dateShort } from '../../utils/format';
import { t } from '../../i18n';
import { TAB_KEYS } from '../MODULES';

export default function CustomersTab({ go, onToast }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    sellerCustomers().then(setRows).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const message = async (c) => {
    try {
      await openConversationWithBuyer(c.buyer_id);
      go(TAB_KEYS.INBOX);
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  return (
    <div>
      <PageHeader title={t('Customers')} subtitle={t('People who bought from you or asked you something.')} />
      {error ? <LoadError message={error} onRetry={load} /> : rows === null ? <Loading /> : rows.length === 0 ? <Empty icon="group" title={t('No customers yet')} /> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((c) => (
            <Card key={c.buyer_id} className="p-4 flex flex-col gap-1">
              <p className="text-title-sm font-semibold text-on-surface">{c.name}{c.orders >= 2 && <Badge tone="green" className="ml-2">{t('Comes back')}</Badge>}</p>
              <p className="text-body-md text-on-surface-variant">
                {[c.city, t('{n} orders', { n: c.orders }), inr(c.total_spent)].filter(Boolean).join(' · ')}
              </p>
              {c.last_order_at && <p className="text-label-md text-on-surface-variant">{t('Last order')}: {dateShort(c.last_order_at)}</p>}
              <Button variant="secondary" icon="chat" className="mt-2 self-start" onClick={() => message(c)}>{t('Message')}</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
