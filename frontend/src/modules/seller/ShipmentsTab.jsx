/** Seller deliveries (PRD §38): where each parcel is, which courier has it, its label, and changing the courier. */
import { useState, useEffect, useCallback } from 'react';
import { listShipments, getShipment, shippingLabel, assignPartner, listPartners } from '../../services/smb';
import { PageHeader, Tabs, Card, StatusBadge, Loading, LoadError, Empty, Button, Modal, Select, Field } from '../../components/ui';
import { dateTime, statusText, inr } from '../../utils/format';
import { t } from '../../i18n';

export default function ShipmentsTab({ onToast }) {
  const [view, setView] = useState('');
  const [rows, setRows] = useState(null);
  const [detail, setDetail] = useState(null);
  const [label, setLabel] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [partners, setPartners] = useState([]);
  const [partnerId, setPartnerId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setRows(await listShipments(view ? { view } : {})); } catch (err) { setError(err.message); }
  }, [view]);
  const show = async (fn, set) => { try { set(await fn()); } catch (err) { onToast?.(err.message, 'error'); } };
  useEffect(() => { load(); }, [load]);

  const openAssign = async (s) => {
    setAssigning(s);
    setPartnerId('');
    setPartners(await listPartners().catch(() => []));
  };

  const assign = async () => {
    try {
      await assignPartner(assigning.id, Number(partnerId));
      onToast?.(t('Courier changed'));
      setAssigning(null);
      load();
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  return (
    <div>
      <PageHeader title={t('Deliveries')} subtitle={t('Book a courier from the Orders page once an order is packed.')} />
      <Tabs value={view} onChange={setView} tabs={[{ key: '', label: t('All') }, { key: 'pickups', label: t('Waiting for courier') }, { key: 'deliveries', label: t('On the way') }, { key: 'completed', label: t('Done') }]} />
      {error ? <LoadError message={error} onRetry={load} /> : rows === null ? <Loading /> : rows.length === 0 ? <Empty icon="local_shipping" title={t('No parcels here')} /> : (
        <div className="space-y-2">
          {rows.map((s) => (
            <Card key={s.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <p className="text-label-md font-semibold text-on-surface">{t('To')} {s.buyer.name} · {t('Order')} {s.order_number}</p>
                <p className="text-label-sm text-on-surface-variant">{s.partner?.company_name || t('No courier yet')}{s.current_location ? ` · ${t('now at {place}', { place: s.current_location })}` : ''}</p>
              </div>
              <StatusBadge status={s.status} />
              <Button size="sm" variant="secondary" icon="location_on" onClick={() => show(() => getShipment(s.id), setDetail)}>{t('Where is it?')}</Button>
              <Button size="sm" variant="secondary" icon="print" onClick={() => show(() => shippingLabel(s.id), setLabel)}>{t('Label')}</Button>
              {['created', 'pickup_assigned'].includes(s.status) && <Button size="sm" variant="ghost" onClick={() => openAssign(s)}>{s.partner ? t('Change courier') : t('Choose courier')}</Button>}
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={t('Where is the parcel?')}>
        {detail && (
          <div className="text-label-md space-y-2">
            <p>{t('{n} parcels', { n: detail.package_count })}{detail.weight_kg ? ` · ${detail.weight_kg} kg` : ''} · {detail.partner?.company_name || t('No courier yet')}</p>
            <p className="text-on-surface-variant">{t('Pick up from')}: {detail.pickup_address}</p>
            <p className="text-on-surface-variant">{t('Deliver to')}: {detail.delivery_address}</p>
            {detail.proof_of_delivery && <p className="text-emerald-700">{t('Given to {name}', { name: detail.proof_of_delivery.signature_name })}{detail.proof_of_delivery.otp_verified ? ` (${t('code checked')})` : ''}</p>}
            <ol className="border-t border-outline-variant pt-2 space-y-1">
              {detail.events.map((e, i) => <li key={i}><strong>{statusText(e.status)}</strong>{e.location ? ` · ${e.location}` : ''} · {dateTime(e.created_at)}{e.notes ? ` — ${e.notes}` : ''}</li>)}
            </ol>
          </div>
        )}
      </Modal>
      <Modal open={!!label} onClose={() => setLabel(null)} title={t('Shipping label')} footer={<Button icon="print" onClick={() => window.print()}>{t('Print')}</Button>}>
        {label && (
          <div className="border-2 border-dashed border-on-surface rounded-lg p-4 text-label-md space-y-1">
            <p className="text-title-md font-bold">{label.shipment_number}</p>
            <p>{t('From')}: {label.from.name}, {label.from.address}</p>
            <p>{t('To')}: <strong>{label.to.name}</strong>, {label.to.address} {label.to.phone && `· ${label.to.phone}`}</p>
            {label.cash_to_collect > 0 && <p className="font-bold">{t('COLLECT CASH')}: {inr(label.cash_to_collect)}</p>}
          </div>
        )}
      </Modal>
      <Modal open={!!assigning} onClose={() => setAssigning(null)} title={t('Choose courier')} footer={<Button disabled={!partnerId} onClick={assign}>{t('Save')}</Button>}>
        <Field label={t('Courier')}>
          <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">{t('Choose one')}</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.company_name}{p.service_city ? ` (${p.service_city})` : ''}</option>)}
          </Select>
        </Field>
      </Modal>
    </div>
  );
}
