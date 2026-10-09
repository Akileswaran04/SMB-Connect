/**
 * Logistics partner application (PRD §40–45): dashboard, pickups,
 * deliveries with proof of delivery (buyer OTP, recipient name, photo,
 * time), tracking with location updates, and profile. Partners only ever
 * see shipments assigned to them.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  logisticsDashboard, listShipments, acceptPickup, advanceShipment, updateShipmentLocation, deliverShipment,
  getShipment, getLogisticsProfile, updateLogisticsProfile,
} from '../../services/smb';
import NotificationBell from '../../components/NotificationBell';
import Toast from '../../components/shared/Toast';
import {
  Icon, Card, Stat, Button, StatusBadge, Loading, Empty, Modal, Field, Input, Toggle, PageHeader, ErrorNote,
} from '../../components/ui';
import { inr, dateTime, dayDate, titleCase } from '../../utils/format';

const TABS = [
  { key: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { key: 'pickups', icon: 'inventory', label: 'Pickups' },
  { key: 'deliveries', icon: 'local_shipping', label: 'Deliveries' },
  { key: 'tracking', icon: 'route', label: 'Tracking' },
  { key: 'profile', icon: 'badge', label: 'Profile' },
];

/** Shrink a photo to ~800px JPEG so proof-of-delivery uploads stay small. */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 800 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function ShipmentCard({ s, children, showBuyer, showSeller }) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <p className="text-label-md font-semibold text-on-surface">{s.shipment_number} · order {s.order_number}</p>
          <p className="text-label-sm text-on-surface-variant">{s.package_count} package(s){s.weight_kg ? ` · ${s.weight_kg} kg` : ''}</p>
        </div>
        <StatusBadge status={s.status} />
      </div>
      {showSeller && (
        <div className="text-label-md">
          <p><Icon name="storefront" size={16} className="align-middle mr-1 text-on-surface-variant" />Pick up from <strong>{s.seller.name}</strong></p>
          <p className="text-on-surface-variant pl-5">{s.pickup_address}</p>
          {s.seller.phone && <a href={`tel:${s.seller.phone}`} className="text-primary pl-5 text-label-sm">Call {s.seller.phone}</a>}
          {s.scheduled_pickup_at && <p className="text-label-sm text-on-surface-variant pl-5">Pickup time {dateTime(s.scheduled_pickup_at)}</p>}
        </div>
      )}
      {showBuyer && (
        <div className="text-label-md">
          <p><Icon name="person_pin_circle" size={16} className="align-middle mr-1 text-on-surface-variant" />Deliver to <strong>{s.buyer.name}</strong></p>
          <p className="text-on-surface-variant pl-5">{s.delivery_address}</p>
          {s.buyer.phone && <a href={`tel:${s.buyer.phone}`} className="text-primary pl-5 text-label-sm">Call {s.buyer.phone}</a>}
          <p className="text-label-sm text-on-surface-variant pl-5">Expected {dayDate(s.expected_delivery_at)}{s.current_location ? ` · now at ${s.current_location}` : ''}</p>
          {s.cash_to_collect > 0 && <p className="text-label-md font-semibold text-amber-800 pl-5">Collect {inr(s.cash_to_collect)} in cash</p>}
          {s.failure_reason && s.status === 'delivery_failed' && <p className="text-label-sm text-error pl-5">Last attempt: {s.failure_reason}</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">{children}</div>
    </Card>
  );
}

export default function LogisticsApp({ session, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  const [dash, setDash] = useState(null);
  const [rows, setRows] = useState(null);
  const [profile, setProfile] = useState(null);
  const [modal, setModal] = useState(null); // { kind, shipment }
  const [form, setForm] = useState({ location: '', reason: '', otp: '', signature: '', photo: '' });
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const load = useCallback(async () => {
    setRows(null);
    if (tab === 'dashboard') {
      setDash(await logisticsDashboard().catch(() => null));
      setRows(await listShipments().catch(() => []));
    } else if (tab === 'profile') {
      setProfile(await getLogisticsProfile().catch(() => null));
    } else {
      setRows(await listShipments(tab === 'tracking' ? {} : { view: tab }).catch(() => []));
    }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, msg) => {
    setError('');
    try {
      await fn();
      showToast(msg);
      setModal(null);
      setForm({ location: '', reason: '', otp: '', signature: '', photo: '' });
      load();
    } catch (err) {
      setError(err.message || 'That did not work');
      if (!modal) showToast(err.message || 'That did not work', 'error');
    }
  };

  const step = (s, status, extra = {}) => run(() => advanceShipment(s.id, status, extra), `Marked ${titleCase(status).toLowerCase()}`);
  const open = (kind, shipment) => { setError(''); setModal({ kind, shipment }); };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, photo: '…' })); // '…' = still processing
    try {
      const photo = await compressImage(file);
      setForm((f) => ({ ...f, photo }));
    } catch {
      setForm((f) => ({ ...f, photo: '' }));
      showToast('Could not read that photo', 'error');
    }
  };

  const content = () => {
    if (tab === 'profile') {
      if (!profile) return <Loading />;
      return (
        <Card className="p-5 max-w-xl space-y-3">
          {[['company_name', 'Company'], ['contact_name', 'Contact person'], ['phone', 'Phone'], ['vehicle_type', 'Vehicle type'], ['vehicle_number', 'Vehicle number'], ['service_city', 'Service city']].map(([k, l]) => (
            <Field key={k} label={l}><Input value={profile[k] || ''} onChange={(e) => setProfile({ ...profile, [k]: e.target.value })} /></Field>
          ))}
          <Toggle label="Available for new pickups" checked={profile.is_available} onChange={(v) => setProfile({ ...profile, is_available: v })} />
          <div className="flex justify-end">
            <Button onClick={() => run(async () => { const { id: _id, ...body } = profile; setProfile(await updateLogisticsProfile(body)); }, 'Profile saved')}>Save</Button>
          </div>
        </Card>
      );
    }
    if (rows === null) return <Loading />;
    if (tab === 'dashboard') {
      const todo = rows.filter((s) => ['pickup_assigned', 'out_for_delivery', 'delivery_failed'].includes(s.status)).slice(0, 5);
      return (
        <div className="space-y-4">
          {dash && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Stat icon="inventory" label="Assigned pickups" value={dash.assigned_pickups} onClick={() => setTab('pickups')} />
              <Stat icon="local_shipping" tone="indigo" label="Active deliveries" value={dash.active_deliveries} onClick={() => setTab('deliveries')} />
              <Stat icon="task_alt" tone="green" label="Completed deliveries" value={dash.completed_deliveries} note={`${dash.delivered_today} today`} />
              <Stat icon="error" tone="red" label="Failed deliveries" value={dash.failed_deliveries} onClick={() => setTab('deliveries')} />
              <Stat icon="work" tone="amber" label="Today's workload" value={dash.todays_workload} note="Parcels still to move" />
            </div>
          )}
          <h2 className="text-title-md font-semibold">Next up</h2>
          {todo.length === 0 ? <Empty icon="task_alt" title="Nothing waiting — you're all caught up" /> : todo.map((s) => (
            <ShipmentCard key={s.id} s={s} showSeller={s.status === 'pickup_assigned'} showBuyer={s.status !== 'pickup_assigned'}>
              <Button size="sm" onClick={() => setTab(s.status === 'pickup_assigned' ? 'pickups' : 'deliveries')}>Open</Button>
            </ShipmentCard>
          ))}
        </div>
      );
    }
    if (rows.length === 0) return <Empty icon="local_shipping" title={tab === 'pickups' ? 'No pickups assigned' : tab === 'deliveries' ? 'No deliveries in progress' : 'No shipments yet'} />;
    return (
      <div className="space-y-3">
        {rows.map((s) => (
          <ShipmentCard key={s.id} s={s} showSeller={tab === 'pickups'} showBuyer={tab !== 'pickups'}>
            {tab === 'pickups' && (
              <>
                {!s.accepted_at && <Button size="sm" variant="secondary" onClick={() => run(() => acceptPickup(s.id), 'Pickup accepted')}>Accept pickup</Button>}
                <Button size="sm" icon="inventory" onClick={() => step(s, 'picked_up', { location: s.seller.name })}>Picked up</Button>
              </>
            )}
            {tab !== 'pickups' && (
              <>
                {['picked_up', 'in_transit'].includes(s.status) && <Button size="sm" variant="secondary" onClick={() => open('hub', s)}>At hub</Button>}
                {['picked_up', 'at_hub'].includes(s.status) && <Button size="sm" variant="secondary" onClick={() => open('transit', s)}>In transit</Button>}
                {['in_transit', 'delivery_failed'].includes(s.status) && <Button size="sm" onClick={() => step(s, 'out_for_delivery')}>{s.status === 'delivery_failed' ? 'Retry delivery' : 'Out for delivery'}</Button>}
                {s.status === 'out_for_delivery' && <Button size="sm" icon="task_alt" onClick={() => open('deliver', s)}>Delivered</Button>}
                {s.status === 'out_for_delivery' && <Button size="sm" variant="ghost" onClick={() => open('fail', s)}>Delivery failed</Button>}
                {s.status === 'delivery_failed' && <Button size="sm" variant="ghost" onClick={() => step(s, 'returned_to_seller', { notes: 'Returned to seller after failed delivery' })}>Return to seller</Button>}
                {!['delivered', 'returned_to_seller'].includes(s.status) && <Button size="sm" variant="ghost" icon="my_location" onClick={() => open('location', s)}>Update location</Button>}
              </>
            )}
            <Button size="sm" variant="ghost" onClick={async () => setDetail(await getShipment(s.id))}>Events</Button>
          </ShipmentCard>
        ))}
      </div>
    );
  };

  const m = modal?.shipment;
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-surface-container-lowest border-b border-outline-variant">
        <div className="max-w-max-width mx-auto px-4 lg:px-10 h-14 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center"><Icon name="local_shipping" size={18} /></span>
          <span className="text-title-md font-bold text-on-surface mr-auto">SMBConnect Delivery <span className="text-label-sm text-on-surface-variant font-normal hidden sm:inline">· {session.fullName || session.email}</span></span>
          <nav className="hidden lg:flex gap-1 mr-2">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 h-9 rounded-lg text-label-md flex items-center gap-1.5 ${tab === t.key ? 'bg-primary-container/15 text-primary font-semibold' : 'text-on-surface-variant'}`}>
                <Icon name={t.icon} size={18} />{t.label}
              </button>
            ))}
          </nav>
          <NotificationBell onOpen={(n) => n.data?.shipment_id && setTab('pickups')} />
          <button onClick={onLogout} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant" aria-label="Log out"><Icon name="logout" /></button>
        </div>
      </header>
      <main className="max-w-max-width mx-auto px-4 lg:px-10 py-6 pb-24 lg:pb-8">
        <PageHeader title={TABS.find((t) => t.key === tab).label} actions={tab !== 'profile' && <Button variant="secondary" size="sm" icon="refresh" onClick={load}>Refresh</Button>} />
        {content()}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant z-30 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around items-center h-16">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex flex-col items-center w-16 ${tab === t.key ? 'text-primary' : 'text-on-surface-variant'}`}>
              <Icon name={t.icon} filled={tab === t.key} /><span className="text-label-sm">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <Modal open={!!modal && ['hub', 'transit', 'location'].includes(modal.kind)} onClose={() => setModal(null)}
        title={modal?.kind === 'hub' ? 'Arrived at hub' : modal?.kind === 'transit' ? 'In transit' : 'Update location'}
        footer={<Button disabled={!form.location.trim() && modal?.kind === 'location'} onClick={() => (modal.kind === 'location'
          ? run(() => updateShipmentLocation(m.id, form.location.trim()), 'Location updated')
          : step(m, modal.kind === 'hub' ? 'at_hub' : 'in_transit', { location: form.location.trim() || undefined }))}>Save</Button>}>
        <ErrorNote>{error}</ErrorNote>
        <Field label="Current location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Guindy hub, Chennai" autoFocus /></Field>
      </Modal>

      <Modal open={modal?.kind === 'fail'} onClose={() => setModal(null)} title="Delivery failed"
        footer={<Button variant="danger" disabled={!form.reason.trim()} onClick={() => step(m, 'delivery_failed', { notes: form.reason.trim() })}>Record failed attempt</Button>}>
        <Field label="What happened?"><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Customer not available" /></Field>
      </Modal>

      <Modal open={modal?.kind === 'deliver'} onClose={() => setModal(null)} title="Proof of delivery"
        footer={<Button icon="task_alt" disabled={form.otp.length !== 6 || form.signature.trim().length < 2 || form.photo === '…'}
          onClick={() => run(() => deliverShipment(m.id, { otp: form.otp, signature_name: form.signature.trim(), photo_url: form.photo || null }), 'Delivered — buyer and seller notified')}>Confirm delivery</Button>}>
        <div className="space-y-3">
          <ErrorNote>{error}</ErrorNote>
          {m?.cash_to_collect > 0 && <p className="text-label-md font-semibold text-amber-800">Collect {inr(m.cash_to_collect)} in cash before handing over.</p>}
          <Field label="Delivery code from the buyer" hint="The buyer sees this 6-digit code on their order page.">
            <Input inputMode="numeric" maxLength={6} value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '') })} autoFocus />
          </Field>
          <Field label="Received by (name as signature)"><Input value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} placeholder={m?.buyer.name} /></Field>
          <Field label="Photo (optional)">
            <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="text-label-md" />
            {form.photo && form.photo !== '…' && <img src={form.photo} alt="Proof of delivery" className="mt-2 h-24 rounded-lg" />}
          </Field>
          <p className="text-label-sm text-on-surface-variant">The time is recorded automatically.</p>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Events — ${detail?.shipment_number || ''}`}>
        <ol className="space-y-1.5 text-label-md">
          {detail?.events.map((e, i) => <li key={i}><strong>{titleCase(e.status)}</strong>{e.location ? ` · ${e.location}` : ''} · {dateTime(e.created_at)}{e.notes ? ` — ${e.notes}` : ''}</li>)}
        </ol>
      </Modal>
      <Toast message={toast.message} type={toast.type} onDismiss={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
}
