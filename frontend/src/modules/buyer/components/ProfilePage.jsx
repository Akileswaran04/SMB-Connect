/**
 * Buyer profile (PRD §26–27). The everyday things first — name, mobile,
 * language, addresses, log out. Shopping preferences, notifications, voice,
 * privacy and "What we remember" sit under "More settings".
 */
import { useState, useEffect } from 'react';
import {
  getBuyerProfile, updateBuyerProfile, getAddresses, createAddress, deleteAddress, getPersonalisation, savePreferences,
  getCategories,
} from '../../../services/smb';
import LanguagePicker from '../../../components/LanguagePicker';
import AddressForm, { EMPTY_ADDRESS } from '../../../components/AddressForm';
import { Card, Button, Field, Input, Select, Toggle, Icon, Badge, Loading } from '../../../components/ui';
import { inr } from '../../../utils/format';
import { LANGUAGES, t } from '../../../i18n';

function Block({ title, subtitle, children }) {
  return (
    <Card className="p-5">
      <h2 className="text-title-md font-semibold text-on-surface">{title}</h2>
      {subtitle && <p className="text-label-md text-on-surface-variant mb-3">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-3'}>{children}</div>
    </Card>
  );
}

export default function ProfilePage({ onToast, onPrefsChanged, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [pers, setPers] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [categories, setCategories] = useState([]);
  const [newAddr, setNewAddr] = useState(null);
  const [sizeRow, setSizeRow] = useState({ category: '', size: '' });
  const [budgetRow, setBudgetRow] = useState({ category: '', amount: '' });
  const [color, setColor] = useState('');

  const loadPers = async () => {
    const p = await getPersonalisation();
    setPers(p);
    setPrefs(p.explicit);
  };

  useEffect(() => {
    getBuyerProfile().then(setProfile).catch(() => {});
    getAddresses().then(setAddresses).catch(() => {});
    getCategories().then(setCategories).catch(() => {});
    loadPers().catch(() => {});
  }, []);

  const savePrefs = async (changes, message = t('Saved')) => {
    try {
      const saved = await savePreferences(changes);
      setPrefs(saved);
      onPrefsChanged?.(saved);
      onToast?.(message);
      loadPers().catch(() => {});
    } catch (err) {
      onToast?.(err.message, 'error');
    }
  };

  const saveProfile = async () => {
    try {
      const { first_name, last_name, phone, city, postal_code, preferred_payment_method } = profile;
      setProfile(await updateBuyerProfile({ first_name, last_name, phone, city, postal_code, preferred_payment_method }));
      onToast?.(t('Saved'));
    } catch (err) {
      onToast?.(err.message, 'error');
    }
  };

  const addAddress = async () => {
    if (!newAddr.line1.trim() || !newAddr.city.trim()) return onToast?.(t('Please fill in the house/street and city'), 'error');
    try {
      const a = await createAddress({ ...newAddr, is_default: addresses.length === 0 });
      setAddresses((x) => [...x, a]);
      setNewAddr(null);
      onToast?.(t('Address saved'));
    } catch (err) {
      onToast?.(err.message, 'error');
    }
  };

  const removeAddress = async (a) => {
    if (!window.confirm(t('Delete this address?'))) return;
    try {
      await deleteAddress(a.id);
      setAddresses((x) => x.filter((y) => y.id !== a.id));
    } catch (err) {
      onToast?.(err.message, 'error');
    }
  };

  if (!profile || !prefs) return <Loading />;
  const setP = (k) => (e) => setProfile({ ...profile, [k]: e.target.value });
  const learned = pers?.learned;

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-headline-md font-semibold text-on-surface">{t('Profile')}</h1>

      <Block title={t('Language')} subtitle={t('The app, the assistant, voice replies and chats with sellers use this language.')}>
        <LanguagePicker className="[&_select]:max-w-none [&_select]:h-12" />
      </Block>

      <Block title={t('Your details')}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={t('First name')}><Input value={profile.first_name || ''} onChange={setP('first_name')} /></Field>
          <Field label={t('Last name')}><Input value={profile.last_name || ''} onChange={setP('last_name')} /></Field>
          <Field label={t('Mobile number')}><Input value={profile.phone || ''} onChange={setP('phone')} inputMode="tel" /></Field>
          <Field label={t('City')}><Input value={profile.city || ''} onChange={setP('city')} /></Field>
          <Field label={t('PIN code')}><Input value={profile.postal_code || ''} onChange={setP('postal_code')} inputMode="numeric" maxLength={6} /></Field>
          <Field label={t('Usual way to pay')}>
            <Select value={profile.preferred_payment_method || 'cod'} onChange={setP('preferred_payment_method')}>
              <option value="cod">{t('Cash on delivery')}</option><option value="upi">UPI</option><option value="card">{t('Card')}</option><option value="netbanking">{t('Net banking')}</option>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end mt-3"><Button size="lg" onClick={saveProfile}>{t('Save')}</Button></div>
      </Block>

      <Block title={t('Your addresses')}>
        <div className="space-y-2">
          {addresses.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-3 border border-outline-variant rounded-lg">
              <Icon name="home" className="text-on-surface-variant" />
              <p className="flex-1 text-label-md"><strong>{t(a.label)}</strong>{a.is_default && <Badge tone="primary" className="ml-2">{t('Main')}</Badge>}<br />
                <span className="text-on-surface-variant">{[a.line1, a.line2, a.city, a.state, a.postal_code].filter(Boolean).join(', ')}</span></p>
              <button onClick={() => removeAddress(a)} aria-label={t('Delete this address?')} className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-error"><Icon name="delete" /></button>
            </div>
          ))}
          {newAddr ? (
            <div className="space-y-2">
              <AddressForm value={newAddr} onChange={setNewAddr} />
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setNewAddr(null)}>{t('Cancel')}</Button>
                <Button onClick={addAddress}>{t('Save address')}</Button>
              </div>
            </div>
          ) : <Button variant="ghost" icon="add" onClick={() => setNewAddr(EMPTY_ADDRESS)}>{t('Add a new address')}</Button>}
        </div>
      </Block>

      <Button variant="secondary" size="lg" icon="logout" className="w-full" onClick={onLogout}>{t('Log out')}</Button>

      <details className="space-y-4">
      <summary className="h-12 px-4 rounded-xl border border-outline-variant bg-surface-container-lowest flex items-center gap-2 cursor-pointer text-label-md font-medium text-primary">
        <Icon name="tune" />{t('More settings')}
      </summary>
      <div className="space-y-4 mt-4">

      <Block title={t('Shopping preferences')} subtitle={t('We use these to pick sizes and suggest products. You can change them any time.')}>
        <p className="text-label-md font-medium text-on-surface">{t('Sizes')}</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {Object.entries(prefs.sizes).map(([cat, size]) => (
            <Badge key={cat} tone="primary">{cat}: {size}
              <button onClick={() => { const next = { ...prefs.sizes }; delete next[cat]; savePrefs({ sizes: next }); }} aria-label={`Remove ${cat} size`}><Icon name="close" size={14} /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Select value={sizeRow.category} onChange={(e) => setSizeRow({ ...sizeRow, category: e.target.value })}>
            <option value="">{t('Category')}…</option>{categories.map((c) => <option key={c.name}>{c.name}</option>)}
          </Select>
          <Input placeholder={t('Size')} value={sizeRow.size} onChange={(e) => setSizeRow({ ...sizeRow, size: e.target.value })} />
          <Button variant="secondary" disabled={!sizeRow.category || !sizeRow.size} onClick={() => { savePrefs({ sizes: { ...prefs.sizes, [sizeRow.category]: sizeRow.size } }); setSizeRow({ category: '', size: '' }); }}>{t('Add')}</Button>
        </div>

        <p className="text-label-md font-medium text-on-surface mt-4">{t('Favourite colours')}</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {prefs.colors.map((c) => (
            <Badge key={c} tone="slate">{c}<button onClick={() => savePrefs({ colors: prefs.colors.filter((x) => x !== c) })} aria-label={`Remove ${c}`}><Icon name="close" size={14} /></button></Badge>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input placeholder="e.g. black" value={color} onChange={(e) => setColor(e.target.value)} />
          <Button variant="secondary" disabled={!color.trim()} onClick={() => { savePrefs({ colors: [...prefs.colors, color.trim().toLowerCase()] }); setColor(''); }}>{t('Add')}</Button>
        </div>

        <p className="text-label-md font-medium text-on-surface mt-4">{t('Usual budget')}</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {Object.entries(prefs.budgets).map(([cat, amt]) => (
            <Badge key={cat} tone="slate">{cat}: {inr(amt)}
              <button onClick={() => { const next = { ...prefs.budgets }; delete next[cat]; savePrefs({ budgets: next }); }} aria-label={`Remove ${cat} budget`}><Icon name="close" size={14} /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Select value={budgetRow.category} onChange={(e) => setBudgetRow({ ...budgetRow, category: e.target.value })}>
            <option value="">{t('Category')}…</option>{categories.map((c) => <option key={c.name}>{c.name}</option>)}
          </Select>
          <Input type="number" inputMode="numeric" placeholder="₹" value={budgetRow.amount} onChange={(e) => setBudgetRow({ ...budgetRow, amount: e.target.value })} />
          <Button variant="secondary" disabled={!budgetRow.category || !budgetRow.amount} onClick={() => { savePrefs({ budgets: { ...prefs.budgets, [budgetRow.category]: Number(budgetRow.amount) } }); setBudgetRow({ category: '', amount: '' }); }}>{t('Add')}</Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <Field label={t('Delivery')}>
            <Select value={prefs.delivery_preference || ''} onChange={(e) => savePrefs({ delivery_preference: e.target.value || null })}>
              <option value="">{t('No preference')}</option><option value="standard">{t('Normal (cheaper)')}</option><option value="express">{t('Next day (faster)')}</option>
            </Select>
          </Field>
          <Field label={t('Favourite sellers')}>
            <div className="flex flex-wrap gap-1.5">
              {(learned?.preferred_sellers || []).map((s) => {
                const on = prefs.preferred_sellers.includes(s.id);
                return (
                  <button key={s.id} onClick={() => savePrefs({ preferred_sellers: on ? prefs.preferred_sellers.filter((x) => x !== s.id) : [...prefs.preferred_sellers, s.id] })}
                    className={`h-8 px-3 rounded-full border text-label-sm ${on ? 'border-primary bg-primary-container/15 text-primary' : 'border-outline-variant text-on-surface-variant'}`}>
                    {on ? '★ ' : '☆ '}{s.name}
                  </button>
                );
              })}
              {!learned?.preferred_sellers?.length && <span className="text-label-sm text-on-surface-variant">{t('Sellers you buy from will show up here.')}</span>}
            </div>
          </Field>
        </div>
      </Block>

      <Block title={t('Order updates')} subtitle={t('Updates always show in the app. Also send them by:')}>
        {['whatsapp', 'sms', 'email', 'push'].map((ch) => (
          <Toggle key={ch} label={t({ email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', push: 'Phone notifications' }[ch])}
            checked={!!prefs.notification_settings[ch]} onChange={(v) => savePrefs({ notification_settings: { [ch]: v } })} />
        ))}
      </Block>

      <Block title={t('Voice')}>
        <Toggle label={t('Read the replies out loud')} checked={prefs.voice_settings.auto_speak !== false}
          onChange={(v) => savePrefs({ voice_settings: { auto_speak: v } })} />
        <Field label={t('Voice language')}>
          <Select value={prefs.voice_settings.voice_language || ''} onChange={(e) => savePrefs({ voice_settings: { voice_language: e.target.value || null } })}>
            <option value="">{t('Same as app language')}</option>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </Select>
        </Field>
      </Block>

      <Block title={t('Privacy')}>
        <Toggle label={t('Use my past orders to suggest products')} checked={prefs.privacy_settings.personalisation !== false}
          onChange={(v) => savePrefs({ privacy_settings: { personalisation: v } }, v ? t('Saved') : t('Off — we no longer use your past orders'))} />
        <Toggle label={t('Save what I say to the assistant')} checked={prefs.privacy_settings.save_voice_history !== false}
          onChange={(v) => savePrefs({ privacy_settings: { save_voice_history: v } })} />
      </Block>

      <Block title={t('What we learned from your orders')} subtitle={t('What you set above always comes first.')}>
        {!pers?.personalisation_enabled ? (
          <p className="text-label-md text-on-surface-variant">{t('Turned off — your past orders are not used.')}</p>
        ) : !learned?.orders_count ? (
          <p className="text-label-md text-on-surface-variant">{t('Nothing yet — this fills in as you shop.')}</p>
        ) : (
          <ul className="text-label-md text-on-surface space-y-1">
            <li>{t('Orders')}: {learned.orders_count}</li>
            {Object.entries(learned.sizes).map(([c, s]) => <li key={c}>{t('{category}: you usually buy size {size}', { category: c, size: s })}</li>)}
            {Object.entries(learned.budgets).map(([c, b]) => <li key={c}>{t('{category}: you usually spend {amount}', { category: c, amount: inr(b) })}</li>)}
            {learned.colors.length > 0 && <li>{t('Colours you pick')}: {learned.colors.join(', ')}</li>}
            {learned.frequent_products.map((f) => <li key={f.product_id}>{t('You often buy')}: {f.name} (×{f.quantity})</li>)}
          </ul>
        )}
      </Block>
      </div>
      </details>
    </div>
  );
}
