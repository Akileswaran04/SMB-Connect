/** Seller shipments (PRD §38): status, courier, label, reassigning a partner, and tracking events. */
import { useState, useEffect, useCallback } from 'react';
import { listShipments, getShipment, shippingLabel, assignPartner, listPartners } from '../../services/smb';
import { PageHeader, Tabs, Card, StatusBadge, Loading, Empty, Button, Modal, Select, Field } from '../../components/ui';
import { dateTime, titleCase, inr } from '../../utils/format';

export default function ShipmentsTab({ onToast }) {
  const [view, setView] = useState('');
  const [rows, setRows] = useState(null);
  const [detail, setDetail] = useState(null);
  const [label, setLabel] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [partners, setPartners] = useState([]);
  const [partnerId, setPartnerId] = useState('');

  const load = useCallback(async () => setRows(await listShipments(view ? { view } : {}).catch(() => [])), [view]);
  useEffect(() => { load(); }, [load]);

  const openAssign = async (s) => {
    setAssigning(s);
    setPartnerId('');
    setPartners(await listPartners().catch(() => []));
  };

  const assign = async () => {
    try {
      await assignPartner(assigning.id, Number(partnerId));
      onToast?.('Partner assigned');
      setAssigning(null);
      load();
    } catch (err) { onToast?.(err.message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Shipments" subtitle="Create shipments from packed orders on the Orders page." />
      <Tabs value={view} onChange={setView} tabs={[{ key: '', label: 'All' }, { key: 'pickups', label: 'Awaiting pickup' }, { key: 'deliveries', label: 'On the way' }, { key: 'completed', label: 'Completed' }]} />
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty icon="local_shipping" title="No shipments here" /> : (
        <div className="space-y-2">
          {rows.map((s) => (
            <Card key={s.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <p className="text-label-md font-semibold text-on-surface">{s.shipment_number} · order {s.order_number}</p>
                <p className="text-label-sm text-on-surface-variant">To {s.buyer.name} · {s.partner?.company_name || 'No partner assigned'}{s.current_location ? ` · at ${s.current_location}` : ''}</p>
              </div>
              <StatusBadge status={s.status} />
              <Button size="sm" variant="secondary" onClick={async () => setDetail(await getShipment(s.id))}>Track</Button>
              <Button size="sm" variant="secondary" onClick={async () => setLabel(await shippingLabel(s.id))}>Label</Button>
              {['created', 'pickup_assigned'].includes(s.status) && <Button size="sm" variant="ghost" onClick={() => openAssign(s)}>{s.partner ? 'Reassign' : 'Assign partner'}</Button>}
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Shipment ${detail?.shipment_number || ''}`}>
        {detail && (
          <div className="text-label-md space-y-2">
            <p>{detail.package_count} package(s){detail.weight_kg ? ` · ${detail.weight_kg} kg` : ''} · {detail.partner?.company_name || 'unassigned'}</p>
            <p className="text-on-surface-variant">Pickup: {detail.pickup_address}</p>
            <p className="text-on-surface-variant">Deliver: {detail.delivery_address}</p>
            {detail.proof_of_delivery && <p className="text-emerald-700">Delivered to {detail.proof_of_delivery.signature_name}{detail.proof_of_delivery.otp_verified ? ' (OTP verified)' : ''}</p>}
            <ol className="border-t border-outline-variant pt-2 space-y-1">
              {detail.events.map((e, i) => <li key={i}><strong>{titleCase(e.status)}</strong>{e.location ? ` · ${e.location}` : ''} · {dateTime(e.created_at)}{e.notes ? ` — ${e.notes}` : ''}</li>)}
            </ol>
          </div>
        )}
      </Modal>
      <Modal open={!!label} onClose={() => setLabel(null)} title="Shipping label" footer={<Button icon="print" onClick={() => window.print()}>Print</Button>}>
        {label && (
          <div className="border-2 border-dashed border-on-surface rounded-lg p-4 text-label-md space-y-1">
            <p className="text-title-md font-bold">{label.shipment_number}</p>
            <p>From: {label.from.name}, {label.from.address}</p>
            <p>To: <strong>{label.to.name}</strong>, {label.to.address} {label.to.phone && `· ${label.to.phone}`}</p>
            {label.cash_to_collect > 0 && <p className="font-bold">COLLECT CASH: {inr(label.cash_to_collect)}</p>}
          </div>
        )}
      </Modal>
      <Modal open={!!assigning} onClose={() => setAssigning(null)} title="Assign logistics partner" footer={<Button disabled={!partnerId} onClick={assign}>Assign</Button>}>
        <Field label="Partner">
          <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">Choose…</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.company_name}{p.service_city ? ` (${p.service_city})` : ''}</option>)}
          </Select>
        </Field>
      </Modal>
    </div>
  );
}
