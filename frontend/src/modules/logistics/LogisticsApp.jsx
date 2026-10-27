/**
 * Delivery partner app (PRD §40–45), built for a rider on a phone: every
 * parcel shows ONE big next step, addresses open in Google Maps, location is
 * shared with one tap, and proof of delivery is the buyer's code + name +
 * optional photo. Partners only ever see parcels assigned to them.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  logisticsDashboard, listShipments, acceptPickup, advanceShipment, updateShipmentLocation, deliverShipment,
  getShipment, getLogisticsProfile, updateLogisticsProfile,
} from '../../services/smb';
import NotificationBell from '../../components/NotificationBell';
import LanguagePicker from '../../components/LanguagePicker';
import Toast from '../../components/shared/Toast';
import {
  Icon, Card, Stat, Button, StatusBadge, Loading, LoadError, Empty, Modal, Field, Input, Toggle, PageHeader, ErrorNote, QuickReasons,
} from '../../components/ui';
import { inr, dateTime, dayDate, statusText, REASONS } from '../../utils/format';
import { compressImage } from '../../utils/image';
import { t } from '../../i18n';

const TABS = [
  { key: 'dashboard', icon: 'home', label: 'Today' },
  { key: 'pickups', icon: 'inventory', label: 'Pickups' },
  { key: 'deliveries', icon: 'local_shipping', label: 'Deliveries' },
  { key: 'profile', icon: 'badge', label: 'Profile' },
];

const mapsLink = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`;

/** Current place as a short name ("Guindy, Chennai"); falls back to coordinates. */
function currentPlace() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error(t('This phone cannot share location. Please type it.')));
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const fallback = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
      try {
        // ponytail: public OpenStreetMap lookup, fine for occasional taps; use a paid geocoder at scale.
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&lat=${coords.latitude}&lon=${coords.longitude}`);
        const a = (await r.json()).address || {};
        resolve([a.suburb || a.neighbourhood || a.village || a.road, a.city || a.town || a.county].filter(Boolean).join(', ') || fallback);
      } catch {
        resolve(fallback);
      }
    }, () => reject(new Error(t('Please allow location, or type the place.'))), { timeout: 15000 });
  });
}

/** The one action that moves this parcel forward. */
function nextAction(s) {
  if (s.status === 'pickup_assigned' && !s.accepted_at) return { kind: 'accept', label: 'Accept pickup', icon: 'check' };
  if (['pickup_assigned', 'created', 'ready_for_pickup'].includes(s.status)) return { kind: 'picked', label: 'I picked it up', icon: 'inventory' };
  if (['picked_up', 'at_hub'].includes(s.status)) return { kind: 'transit', label: 'Start the trip', icon: 'route' };
  if (s.status === 'in_transit') return { kind: 'out', label: 'Out for delivery', icon: 'two_wheeler' };
  if (s.status === 'delivery_failed') return { kind: 'out', label: 'Try delivery again', icon: 'replay' };
  if (s.status === 'out_for_delivery') return { kind: 'deliver', label: 'Delivered', icon: 'task_alt' };
  return null;
}

function Place({ icon, title, name, address, phone, children }) {
  return (
    <div className="text-body-md">
      <p className="flex items-center gap-1.5"><Icon name={icon} size={18} className="text-on-surface-variant" />{t(title)} <strong>{name}</strong></p>
      <p className="text-on-surface-variant pl-6">{address}</p>
      <div className="flex flex-wrap gap-2 pl-6 mt-1">
        <a href={mapsLink(address)} target="_blank" rel="noreferrer" className="h-10 px-3 rounded-lg border border-outline-variant inline-flex items-center gap-1.5 text-label-md text-primary">
          <Icon name="map" size={18} />{t('Open in Maps')}
        </a>
        {phone && (
          <a href={`tel:${phone}`} className="h-10 px-3 rounded-lg border border-outline-variant inline-flex items-center gap-1.5 text-label-md text-primary">
            <Icon name="call" size={18} />{t('Call')}
          </a>
        )}
      </div>
      {children}
    </div>
  );
}

function ShipmentCard({ s, children, showBuyer, showSeller }) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <p className="text-title-sm font-semibold text-on-surface">{t('Order')} {s.order_number}</p>
          <p className="text-label-md text-on-surface-variant">{t('{n} parcels', { n: s.package_count })}{s.weight_kg ? ` · ${s.weight_kg} kg` : ''}</p>
        </div>
        <StatusBadge status={s.status} />
      </div>
      {showSeller && (
        <Place icon="storefront" title="Pick up from" name={s.seller.name} address={s.pickup_address} phone={s.seller.phone}>
          {s.scheduled_pickup_at && <p className="text-label-md text-on-surface-variant pl-6 mt-1">{t('Pickup time')}: {dateTime(s.scheduled_pickup_at)}</p>}
        </Place>
      )}
      {showBuyer && (
        <Place icon="person_pin_circle" title="Deliver to" name={s.buyer.name} address={s.delivery_address} phone={s.buyer.phone}>
          <p className="text-label-md text-on-surface-variant pl-6 mt-1">{t('Deliver by {date}', { date: dayDate(s.expected_delivery_at) })}{s.current_location ? ` · ${t('now at {place}', { place: s.current_location })}` : ''}</p>
          {s.failure_reason && s.status === 'delivery_failed' && <p className="text-label-md text-error pl-6">{t('Last try')}: {s.failure_reason}</p>}
        </Place>
      )}
      {showBuyer && s.cash_to_collect > 0 && (
        <p className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2 text-body-md font-semibold">
          <Icon name="payments" />{t('Collect {amount} cash', { amount: inr(s.cash_to_collect) })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">{children}</div>
    </Card>
  );
}

const EMPTY_FORM = { location: '', reason: '', otp: '', signature: '', photo: '' };

export default function LogisticsApp({ session, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  const [dash, setDash] = useState(null);
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [profile, setProfile] = useState(null);
  const [modal, setModal] = useState(null); // { kind, shipment }
  const [form, setForm] = useState(EMPTY_FORM);
  const [locating, setLocating] = useState(false);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const load = useCallback(async () => {
    setRows(null);
    setLoadError('');
    try {
      if (tab === 'dashboard') {
        setDash(await logisticsDashboard().catch(() => null));
        setRows(await listShipments());
      } else if (tab === 'profile') {
        setProfile(await getLogisticsProfile());
      } else {
        setRows(await listShipments({ view: tab }));
      }
    } catch (err) {
      setLoadError(err.message);
    }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, msg) => {
    setError('');
    try {
      await fn();
      showToast(t(msg));
      setModal(null);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err.message);
      if (!modal) showToast(err.message, 'error');
    }
  };

  const step = (s, status, extra = {}) => run(() => advanceShipment(s.id, status, extra), 'Updated');
  const open = (kind, shipment) => { setError(''); setForm(EMPTY_FORM); setModal({ kind, shipment }); };

  const doNext = (s, a) => {
    if (a.kind === 'accept') return run(() => acceptPickup(s.id), 'Pickup accepted');
    if (a.kind === 'picked') return step(s, 'picked_up', { location: s.seller.name });
    if (a.kind === 'transit') return open('transit', s);
    if (a.kind === 'out') return step(s, 'out_for_delivery');
    return open('deliver', s);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const place = await currentPlace();
      setForm((f) => ({ ...f, location: place }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLocating(false);
    }
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, photo: '…' })); // '…' = still processing
    try {
      const photo = await compressImage(file, { maxSide: 800, quality: 0.6 });
      setForm((f) => ({ ...f, photo }));
    } catch {
      setForm((f) => ({ ...f, photo: '' }));
      showToast(t('Could not read that photo. Please try again.'), 'error');
    }
  };

  const showEvents = async (s) => {
    try { setDetail(await getShipment(s.id)); } catch (err) { showToast(err.message, 'error'); }
  };

  const actions = (s, a) => (
    <>
      {a && <Button size="lg" icon={a.icon} className="flex-1 min-w-[12rem]" onClick={() => doNext(s, a)}>{t(a.label)}</Button>}
      {s.status === 'out_for_delivery' && <Button variant="secondary" onClick={() => open('fail', s)}>{t('Could not deliver')}</Button>}
      {s.status === 'delivery_failed' && <Button variant="secondary" onClick={() => step(s, 'returned_to_seller', { notes: 'Returned to seller after failed delivery' })}>{t('Take back to seller')}</Button>}
      {['picked_up', 'in_transit'].includes(s.status) && <Button variant="ghost" icon="warehouse" onClick={() => open('hub', s)}>{t('At courier centre')}</Button>}
      {!['delivered', 'returned_to_seller', 'pickup_assigned'].includes(s.status) && <Button variant="ghost" icon="my_location" onClick={() => open('location', s)}>{t('Update location')}</Button>}
      <Button variant="ghost" icon="history" onClick={() => showEvents(s)}>{t('History')}</Button>
    </>
  );

  const content = () => {
    if (loadError) return <LoadError message={loadError} onRetry={load} />;
    if (tab === 'profile') {
      if (!profile) return <Loading />;
      return (
        <Card className="p-5 max-w-xl space-y-3">
          {[['company_name', 'Company'], ['contact_name', 'Your name'], ['phone', 'Mobile number'], ['vehicle_type', 'Vehicle (bike, van…)'], ['vehicle_number', 'Vehicle number'], ['service_city', 'City you deliver in']].map(([k, l]) => (
            <Field key={k} label={t(l)}><Input value={profile[k] || ''} onChange={(e) => setProfile({ ...profile, [k]: e.target.value })} inputMode={k === 'phone' ? 'tel' : undefined} /></Field>
          ))}
          <Toggle label={t('I am free to take new pickups')} checked={profile.is_available} onChange={(v) => setProfile({ ...profile, is_available: v })} />
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant">
            <span className="text-label-md">{t('App language')}</span><LanguagePicker />
          </div>
          <div className="flex justify-end">
            <Button size="lg" onClick={() => run(async () => { const { id: _id, ...body } = profile; setProfile(await updateLogisticsProfile(body)); }, 'Saved')}>{t('Save')}</Button>
          </div>
        </Card>
      );
    }
    if (rows === null) return <Loading />;
    if (tab === 'dashboard') {
      const todo = rows.filter((s) => nextAction(s)).slice(0, 5);
      return (
        <div className="space-y-4">
          {dash && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat icon="inventory" label={t('Pickups to do')} value={dash.assigned_pickups} onClick={() => setTab('pickups')} />
              <Stat icon="local_shipping" tone="indigo" label={t('Deliveries to do')} value={dash.active_deliveries} onClick={() => setTab('deliveries')} />
              <Stat icon="task_alt" tone="green" label={t('Delivered today')} value={dash.delivered_today} note={t('{n} in total', { n: dash.completed_deliveries })} />
              <Stat icon="error" tone="red" label={t('Could not deliver')} value={dash.failed_deliveries} onClick={() => setTab('deliveries')} />
            </div>
          )}
          <h2 className="text-title-md font-semibold">{t('Do next')}</h2>
          {todo.length === 0 ? <Empty icon="task_alt" title={t("Nothing waiting — you're all done")} /> : todo.map((s) => {
            const pickup = ['pickup_assigned', 'created', 'ready_for_pickup'].includes(s.status);
            return <ShipmentCard key={s.id} s={s} showSeller={pickup} showBuyer={!pickup}>{actions(s, nextAction(s))}</ShipmentCard>;
          })}
        </div>
      );
    }
    if (rows.length === 0) return <Empty icon="local_shipping" title={tab === 'pickups' ? t('No pickups right now') : t('No deliveries right now')} />;
    return (
      <div className="space-y-3">
        {rows.map((s) => (
          <ShipmentCard key={s.id} s={s} showSeller={tab === 'pickups'} showBuyer={tab !== 'pickups'}>{actions(s, nextAction(s))}</ShipmentCard>
        ))}
      </div>
    );
  };

  const m = modal?.shipment;
  const locationModal = !!modal && ['hub', 'transit', 'location'].includes(modal.kind);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-surface-container-lowest border-b border-outline-variant">
        <div className="max-w-max-width mx-auto px-4 lg:px-10 h-14 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center"><Icon name="local_shipping" size={18} /></span>
          <span className="text-title-md font-bold text-on-surface mr-auto truncate">{session.fullName || t('Delivery')}</span>
          <nav className="hidden lg:flex gap-1 mr-2">
            {TABS.map((x) => (
              <button key={x.key} onClick={() => setTab(x.key)} className={`px-3 h-10 rounded-lg text-label-md flex items-center gap-1.5 ${tab === x.key ? 'bg-primary-container/15 text-primary font-semibold' : 'text-on-surface-variant'}`}>
                <Icon name={x.icon} size={18} />{t(x.label)}
              </button>
            ))}
          </nav>
          <NotificationBell onOpen={(n) => n.data?.shipment_id && setTab('pickups')} />
          <button onClick={onLogout} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant" aria-label={t('Log out')}><Icon name="logout" /></button>
        </div>
      </header>
      <main className="max-w-max-width mx-auto px-4 lg:px-10 py-6 pb-24 lg:pb-8">
        <PageHeader title={t(TABS.find((x) => x.key === tab).label)} actions={tab !== 'profile' && <Button variant="secondary" icon="refresh" onClick={load}>{t('Refresh')}</Button>} />
        {content()}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant z-30 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around items-center h-16">
          {TABS.map((x) => (
            <button key={x.key} onClick={() => setTab(x.key)} className={`flex flex-col items-center justify-center w-20 h-14 ${tab === x.key ? 'text-primary' : 'text-on-surface-variant'}`}>
              <Icon name={x.icon} filled={tab === x.key} /><span className="text-label-sm">{t(x.label)}</span>
            </button>
          ))}
        </div>
      </nav>

      <Modal open={locationModal} onClose={() => setModal(null)}
        title={modal?.kind === 'hub' ? t('At courier centre') : modal?.kind === 'transit' ? t('Start the trip') : t('Update location')}
        footer={<Button size="lg" disabled={!form.location.trim() && modal?.kind === 'location'} onClick={() => (modal.kind === 'location'
          ? run(() => updateShipmentLocation(m.id, form.location.trim()), 'Location updated')
          : step(m, modal.kind === 'hub' ? 'at_hub' : 'in_transit', { location: form.location.trim() || undefined }))}>{t('Save')}</Button>}>
        <div className="space-y-3">
          <ErrorNote>{error}</ErrorNote>
          <Button size="lg" variant="outline" icon={locating ? 'progress_activity' : 'my_location'} className="w-full" disabled={locating} onClick={useMyLocation}>
            {locating ? t('Finding you…') : t('Use my location')}
          </Button>
          <Field label={t('Where are you now?')}><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Guindy, Chennai" /></Field>
        </div>
      </Modal>

      <Modal open={modal?.kind === 'fail'} onClose={() => setModal(null)} title={t('Could not deliver')}
        footer={<Button variant="danger" size="lg" disabled={!form.reason.trim()} onClick={() => step(m, 'delivery_failed', { notes: form.reason.trim() })}>{t('Save')}</Button>}>
        <ErrorNote>{error}</ErrorNote>
        <p className="text-body-md mb-3">{t('What happened?')}</p>
        <QuickReasons options={REASONS.deliveryFailed} value={form.reason} onPick={(r) => setForm({ ...form, reason: r })} />
        <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t('Or type what happened')} />
      </Modal>

      <Modal open={modal?.kind === 'deliver'} onClose={() => setModal(null)} title={t('Hand over the parcel')}
        footer={<Button size="lg" icon="task_alt" disabled={form.otp.length !== 6 || form.signature.trim().length < 2 || form.photo === '…'}
          onClick={() => run(() => deliverShipment(m.id, { otp: form.otp, signature_name: form.signature.trim(), photo_url: form.photo || null }), 'Delivered — buyer and seller told')}>{t('Confirm delivery')}</Button>}>
        <div className="space-y-4">
          <ErrorNote>{error}</ErrorNote>
          {m?.cash_to_collect > 0 && <p className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2 text-body-md font-semibold">{t('First collect {amount} cash.', { amount: inr(m.cash_to_collect) })}</p>}
          <Field label={t('1. Ask the buyer for their 6-digit delivery code')} hint={t('The buyer sees it in their order on the app.')}>
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '') })}
              className="text-headline-sm tracking-[0.4em] h-14 text-center" autoFocus />
          </Field>
          <Field label={t('2. Name of the person who took it')}><Input value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} placeholder={m?.buyer.name} /></Field>
          <Field label={t('3. Photo of the parcel at the door (optional)')}>
            <label className="h-12 px-4 rounded-lg border-2 border-dashed border-primary/60 text-primary inline-flex items-center gap-2 cursor-pointer text-label-md">
              <Icon name="photo_camera" />{form.photo && form.photo !== '…' ? t('Take again') : t('Take photo')}
              <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
            </label>
            {form.photo && form.photo !== '…' && <img src={form.photo} alt="" className="mt-2 h-24 rounded-lg" />}
          </Field>
          <p className="text-label-md text-on-surface-variant">{t('The time is saved automatically.')}</p>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={t('History')}>
        <ol className="space-y-2 text-body-md">
          {detail?.events.map((e, i) => (
            <li key={i}><strong>{statusText(e.status)}</strong>{e.location ? ` · ${e.location}` : ''}<span className="block text-label-sm text-on-surface-variant">{dateTime(e.created_at)}{e.notes ? ` — ${e.notes}` : ''}</span></li>
          ))}
        </ol>
      </Modal>
      <Toast message={toast.message} type={toast.type} onDismiss={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
}
