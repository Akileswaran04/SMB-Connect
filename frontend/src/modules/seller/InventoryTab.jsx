/**
 * Seller inventory (PRD §33): per product or variant — on hand, reserved by
 * open orders, available to sell, incoming — with adjustments, incoming
 * stock and a full change log. Stock that reaches zero makes the item
 * unavailable to buyers automatically.
 */
import { useState, useEffect, useCallback } from 'react';
import { getInventory, adjustInventory, setIncoming, receiveIncoming, inventoryLog } from '../../services/smb';
import { PageHeader, Stat, Tabs, Loading, Empty, Badge, Button, Modal, Field, Input, Card } from '../../components/ui';
import { dateTime, titleCase } from '../../utils/format';

const STATE = { out_of_stock: ['red', 'Out of stock'], low_stock: ['amber', 'Low stock'], in_stock: ['green', 'In stock'] };

export default function InventoryTab({ onToast }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [edit, setEdit] = useState(null); // { row, mode: 'adjust'|'incoming' }
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [log, setLog] = useState(null);

  const load = useCallback(async () => setData(await getInventory(filter === 'all' ? undefined : filter).catch(() => ({ items: [], summary: {} }))), [filter]);
  useEffect(() => { load(); }, [load]);

  const key = (r) => ({ product_id: r.product_id, variant_id: r.variant_id });

  const submit = async () => {
    try {
      if (edit.mode === 'adjust') await adjustInventory({ ...key(edit.row), delta: Number(amount), note: note || null });
      else await setIncoming({ ...key(edit.row), quantity: Number(amount) });
      onToast?.(edit.mode === 'adjust' ? 'Stock updated' : 'Incoming stock recorded');
      setEdit(null);
      setAmount('');
      setNote('');
      load();
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  const receive = async (row) => {
    try {
      const r = await receiveIncoming(key(row));
      onToast?.(`${r.received} units added to stock`);
      load();
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  const s = data?.summary || {};
  return (
    <div>
      <PageHeader title="Inventory" subtitle="Stock held for open orders is reserved, so you never oversell." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat icon="error" tone="red" label="Out of stock" value={s.out_of_stock ?? '—'} onClick={() => setFilter('out_of_stock')} />
        <Stat icon="warning" tone="amber" label="Low stock" value={s.low_stock ?? '—'} onClick={() => setFilter('low_stock')} />
        <Stat icon="lock" tone="blue" label="Reserved units" value={s.reserved_units ?? '—'} />
        <Stat icon="local_shipping" tone="indigo" label="Incoming units" value={s.incoming_units ?? '—'} />
      </div>
      <Tabs value={filter} onChange={setFilter} tabs={[{ key: 'all', label: 'All' }, { key: 'low_stock', label: 'Low stock' }, { key: 'out_of_stock', label: 'Out of stock' }, { key: 'in_stock', label: 'In stock' }]} />
      {!data ? <Loading /> : data.items.length === 0 ? <Empty icon="shelves" title="Nothing here" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-label-md">
            <thead className="text-left text-on-surface-variant border-b border-outline-variant">
              <tr><th className="p-3">Product</th><th className="p-3">SKU</th><th className="p-3 text-right">On hand</th><th className="p-3 text-right">Reserved</th>
                <th className="p-3 text-right">Available</th><th className="p-3 text-right">Incoming</th><th className="p-3">Status</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={`${r.product_id}-${r.variant_id}`} className="border-b border-outline-variant/60">
                  <td className="p-3"><span className="font-semibold text-on-surface">{r.name}</span>{r.variant_label && <span className="block text-label-sm text-on-surface-variant">{r.variant_label}</span>}</td>
                  <td className="p-3 text-on-surface-variant">{r.sku || '—'}</td>
                  <td className="p-3 text-right">{r.on_hand}</td>
                  <td className="p-3 text-right">{r.reserved}</td>
                  <td className="p-3 text-right font-semibold">{r.available_to_sell}</td>
                  <td className="p-3 text-right">{r.incoming || '—'}</td>
                  <td className="p-3"><Badge tone={STATE[r.state][0]}>{STATE[r.state][1]}</Badge></td>
                  <td className="p-3 whitespace-nowrap text-right">
                    <Button size="sm" variant="secondary" onClick={() => setEdit({ row: r, mode: 'adjust' })}>Adjust</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEdit({ row: r, mode: 'incoming' })}>Incoming</Button>
                    {r.incoming > 0 && <Button size="sm" variant="ghost" onClick={() => receive(r)}>Receive</Button>}
                    <Button size="sm" variant="ghost" onClick={async () => setLog({ row: r, items: await inventoryLog(r.product_id) })}>Log</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.mode === 'adjust' ? 'Adjust stock' : 'Incoming stock'}
        footer={<Button onClick={submit} disabled={!amount}>Save</Button>}>
        <p className="text-label-md text-on-surface-variant mb-3">{edit?.row.name}{edit?.row.variant_label ? ` — ${edit.row.variant_label}` : ''} · {edit?.row.available_to_sell} available</p>
        <Field label={edit?.mode === 'adjust' ? 'Change (e.g. 10 to add, -2 to remove)' : 'Units on the way'}>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        {edit?.mode === 'adjust' && <Field label="Reason" className="mt-3"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. New batch from supplier, damaged units" /></Field>}
      </Modal>

      <Modal open={!!log} onClose={() => setLog(null)} title={`Stock history — ${log?.row.name || ''}`} wide>
        {log?.items.length === 0 ? <Empty title="No changes yet" /> : (
          <table className="w-full text-label-md">
            <thead className="text-left text-on-surface-variant"><tr><th className="py-1">When</th><th>Change</th><th>Reserved</th><th>Reason</th></tr></thead>
            <tbody>
              {log?.items.map((t) => (
                <tr key={t.id} className="border-t border-outline-variant/60">
                  <td className="py-1.5">{dateTime(t.created_at)}</td>
                  <td className={t.stock_change < 0 ? 'text-error' : t.stock_change > 0 ? 'text-emerald-700' : ''}>{t.stock_change > 0 ? '+' : ''}{t.stock_change}</td>
                  <td>{t.reserved_change > 0 ? '+' : ''}{t.reserved_change}</td>
                  <td>{titleCase(t.reason)}{t.order_id ? ` (order #${t.order_id})` : ''}{t.note ? ` — ${t.note}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
