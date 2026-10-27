/**
 * Seller stock (PRD §33), one card per product or size: how many are free
 * to sell and how many are on hold for orders. Changing stock is "Add",
 * "Remove" or "I now have…" — no negative numbers to type. Stock arriving
 * from a supplier and the change history sit behind "More".
 */
import { useState, useEffect, useCallback } from 'react';
import { getInventory, adjustInventory, setIncoming, receiveIncoming, inventoryLog } from '../../services/smb';
import { PageHeader, Stat, Tabs, Loading, LoadError, Empty, Badge, Button, Modal, Field, Input, Card } from '../../components/ui';
import { dateTime, titleCase } from '../../utils/format';
import { t } from '../../i18n';

const STATE = { out_of_stock: ['red', 'Out of stock'], low_stock: ['amber', 'Running low'], in_stock: ['green', 'In stock'] };
const TITLES = { add: 'Add stock', remove: 'Remove stock', set: 'Count your stock', incoming: 'Stock on the way' };

export default function InventoryTab({ onToast }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [edit, setEdit] = useState(null); // { row, mode: 'add'|'remove'|'set'|'incoming' }
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [log, setLog] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try { setData(await getInventory(filter === 'all' ? undefined : filter)); } catch (err) { setError(err.message); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const key = (r) => ({ product_id: r.product_id, variant_id: r.variant_id });
  const open = (row, mode) => { setAmount(''); setNote(''); setEdit({ row, mode }); };

  const submit = async () => {
    const n = Number(amount);
    const { row, mode } = edit;
    try {
      if (mode === 'incoming') {
        await setIncoming({ ...key(row), quantity: n });
      } else {
        const delta = mode === 'add' ? n : mode === 'remove' ? -n : n - row.on_hand;
        if (delta === 0) { setEdit(null); return; }
        await adjustInventory({ ...key(row), delta, note: note || (mode === 'set' ? 'Stock count' : null) });
      }
      onToast?.(mode === 'incoming' ? t('Saved') : t('Stock updated'));
      setEdit(null);
      load();
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  const receive = async (row) => {
    try {
      const r = await receiveIncoming(key(row));
      onToast?.(t('{n} added to your stock', { n: r.received }));
      load();
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  const showLog = async (row) => {
    try { setLog({ row, items: await inventoryLog(row.product_id) }); } catch (err) { onToast?.(err.message, 'error'); }
  };

  const s = data?.summary || {};
  const mode = edit?.mode;
  return (
    <div>
      <PageHeader title={t('Stock')} subtitle={t('Items in open orders are kept on hold, so you never sell more than you have.')} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat icon="error" tone="red" label={t('Out of stock')} value={s.out_of_stock ?? '—'} onClick={() => setFilter('out_of_stock')} />
        <Stat icon="warning" tone="amber" label={t('Running low')} value={s.low_stock ?? '—'} onClick={() => setFilter('low_stock')} />
        <Stat icon="lock" tone="blue" label={t('On hold for orders')} value={s.reserved_units ?? '—'} />
        <Stat icon="local_shipping" tone="indigo" label={t('On the way from supplier')} value={s.incoming_units ?? '—'} />
      </div>
      <Tabs value={filter} onChange={setFilter} tabs={[{ key: 'all', label: t('All') }, { key: 'low_stock', label: t('Running low') }, { key: 'out_of_stock', label: t('Out of stock') }, { key: 'in_stock', label: t('In stock') }]} />
      {error ? <LoadError message={error} onRetry={load} /> : !data ? <Loading /> : data.items.length === 0 ? <Empty icon="shelves" title={t('Nothing here')} /> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.items.map((r) => (
            <Card key={`${r.product_id}-${r.variant_id}`} className="p-4 flex flex-col gap-2">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-title-sm font-semibold text-on-surface">{r.name}</p>
                  {r.variant_label && <p className="text-label-md text-on-surface-variant">{r.variant_label}</p>}
                </div>
                <Badge tone={STATE[r.state][0]}>{t(STATE[r.state][1])}</Badge>
              </div>
              <p className="text-body-md">
                <span className="text-headline-sm font-bold text-on-surface">{r.available_to_sell}</span> {t('free to sell')}
                {r.reserved > 0 && <span className="text-on-surface-variant"> · {t('{n} on hold', { n: r.reserved })}</span>}
                {r.incoming > 0 && <span className="text-on-surface-variant"> · {t('{n} on the way', { n: r.incoming })}</span>}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button icon="add" onClick={() => open(r, 'add')}>{t('Add stock')}</Button>
                <Button variant="secondary" icon="remove" onClick={() => open(r, 'remove')}>{t('Remove stock')}</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" icon="calculate" onClick={() => open(r, 'set')}>{t('I now have…')}</Button>
                <Button variant="ghost" size="sm" icon="history" onClick={() => showLog(r)}>{t('History')}</Button>
                <Button variant="ghost" size="sm" icon="local_shipping" onClick={() => open(r, 'incoming')}>{t('Stock on the way')}</Button>
                {r.incoming > 0 && <Button variant="ghost" size="sm" icon="move_to_inbox" onClick={() => receive(r)}>{t('It arrived')}</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={t(TITLES[mode] || '')}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>{t('Cancel')}</Button><Button size="lg" onClick={submit} disabled={amount === '' || Number(amount) < 0 || (mode !== 'set' && !Number(amount))}>{t('Save')}</Button></>}>
        <p className="text-body-md text-on-surface-variant mb-3">{edit?.row.name}{edit?.row.variant_label ? ` — ${edit.row.variant_label}` : ''} · {t('you have {n} now', { n: edit?.row.on_hand })}</p>
        <Field label={mode === 'add' ? t('How many to add?') : mode === 'remove' ? t('How many to remove?') : mode === 'set' ? t('How many do you have in the shop right now?') : t('How many are coming from your supplier?')}>
          <Input type="number" inputMode="numeric" min="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} autoFocus className="text-title-lg h-14" />
        </Field>
        {['add', 'remove'].includes(mode) && (
          <Field label={t('Reason (optional)')} className="mt-3">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'add' ? t('e.g. New stock from supplier') : t('e.g. Damaged pieces')} />
          </Field>
        )}
      </Modal>

      <Modal open={!!log} onClose={() => setLog(null)} title={`${t('Stock history')} — ${log?.row.name || ''}`} wide>
        {log?.items.length === 0 ? <Empty title={t('No changes yet')} /> : (
          <ul className="divide-y divide-outline-variant/60">
            {log?.items.map((x) => (
              <li key={x.id} className="py-2.5 flex justify-between gap-3 text-body-md">
                <span>
                  <span className="block text-on-surface">{titleCase(x.reason)}{x.order_id ? ` (${t('order')} #${x.order_id})` : ''}{x.note ? ` — ${x.note}` : ''}</span>
                  <span className="block text-label-sm text-on-surface-variant">{dateTime(x.created_at)}</span>
                </span>
                <span className={`font-semibold ${x.stock_change < 0 ? 'text-error' : x.stock_change > 0 ? 'text-emerald-700' : 'text-on-surface-variant'}`}>
                  {x.stock_change > 0 ? '+' : ''}{x.stock_change || (x.reserved_change ? `${x.reserved_change > 0 ? '+' : ''}${x.reserved_change} ${t('on hold')}` : 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
