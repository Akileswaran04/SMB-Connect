/**
 * Buyer profile (PRD §26–27): personal details, language, addresses,
 * payment preference, sizes / colours / budgets / sellers / delivery, and
 * notification, voice and privacy settings — plus "What we remember",
 * so the buyer can see and control personalisation.
 */
import { useState, useEffect } from 'react';
import {
  getBuyerProfile, updateBuyerProfile, getAddresses, createAddress, deleteAddress, getPersonalisation, savePreferences,
  setLanguage, getCategories,
} from '../../../services/smb';
import { getSession, updateSessionLanguage } from '../../../services/storage';
import { LANGUAGES } from '../../../components/LoginScreen';
import { Card, Button, Field, Input, Select, Toggle, Icon, Badge, Loading } from '../../../components/ui';
import { inr } from '../../../utils/format';

function Block({ title, subtitle, children }) {
  return (
    <Card className="p-5">
      <h2 className="text-title-md font-semibold text-on-surface">{title}</h2>
      {subtitle && <p className="text-label-md text-on-surface-variant mb-3">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-3'}>{children}</div>
    </Card>
  );
}

export default function ProfilePage({ onToast, onPrefsChanged }) {
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [pers, setPers] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [categories, setCategories] = useState([]);
  const [newAddr, setNewAddr] = useState(null);
  const [sizeRow, setSizeRow] = useState({ category: '', size: '' });
  const [budgetRow, setBudgetRow] = useState({ category: '', amount: '' });
  const [color, setColor] = useState('');
  const [language, setLang] = useState(getSession()?.language || 'en');

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

  const savePrefs = async (changes, message = 'Preferences saved') => {
    try {
      const saved = await savePreferences(changes);
      setPrefs(saved);
      onPrefsChanged?.(saved);
      onToast?.(message);
      loadPers().catch(() => {});
    } catch (err) {
      onToast?.(err.message || 'Could not save', 'error');
    }
  };

  const saveProfile = async () => {
    try {
      const { first_name, last_name, phone, city, postal_code, preferred_payment_method } = profile;
      setProfile(await updateBuyerProfile({ first_name, last_name, phone, city, postal_code, preferred_payment_method }));
      onToast?.('Profile saved');
    } catch (err) {
      onToast?.(err.message || 'Could not save profile', 'error');
    }
  };

  const changeLanguage = async (code) => {
    setLang(code);
    try {
      await setLanguage(code);
      updateSessionLanguage(code);
      onToast?.('Language updated — chats and the assistant will use it');
    } catch (err) {
      onToast?.(err.message, 'error');
    }
  };

  if (!profile || !prefs) return <Loading />;
  const setP = (k) => (e) => setProfile({ ...profile, [k]: e.target.value });
  const learned = pers?.learned;

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-headline-md font-semibold text-on-surface">Profile</h1>

      <Block title="Personal details">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="First name"><Input value={profile.first_name || ''} onChange={setP('first_name')} /></Field>
          <Field label="Last name"><Input value={profile.last_name || ''} onChange={setP('last_name')} /></Field>
          <Field label="Mobile number"><Input value={profile.phone || ''} onChange={setP('phone')} inputMode="tel" /></Field>
          <Field label="City"><Input value={profile.city || ''} onChange={setP('city')} /></Field>
          <Field label="PIN code"><Input value={profile.postal_code || ''} onChange={setP('postal_code')} /></Field>
          <Field label="Preferred payment">
            <Select value={profile.preferred_payment_method || 'upi'} onChange={setP('preferred_payment_method')}>
              <option value="upi">UPI</option><option value="card">Card</option><option value="netbanking">Net Banking</option><option value="cod">Cash on Delivery</option>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end mt-3"><Button onClick={saveProfile}>Save details</Button></div>
      </Block>

      <Block title="Language" subtitle="Used for the assistant, voice replies and translating your chats with sellers.">
        <Select value={language} onChange={(e) => changeLanguage(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </Select>
      </Block>

      <Block title="Saved addresses">
        <div className="space-y-2">
          {addresses.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-3 border border-outline-variant rounded-lg">
              <Icon name="home" className="text-on-surface-variant" />
              <p className="flex-1 text-label-md"><strong>{a.label}</strong>{a.is_default && <Badge tone="primary" className="ml-2">Default</Badge>}<br />
                <span className="text-on-surface-variant">{[a.line1, a.line2, a.city, a.state, a.postal_code].filter(Boolean).join(', ')}</span></p>
              <button onClick={async () => { await deleteAddress(a.id); setAddresses((x) => x.filter((y) => y.id !== a.id)); }} aria-label="Delete address" className="text-on-surface-variant hover:text-error"><Icon name="delete" /></button>
            </div>
          ))}
          {newAddr ? (
            <div className="grid sm:grid-cols-2 gap-2">
              <Input placeholder="House / street" value={newAddr.line1} onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })} />
              <Input placeholder="City" value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} />
              <Input placeholder="State" value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} />
              <Input placeholder="PIN code" value={newAddr.postal_code} onChange={(e) => setNewAddr({ ...newAddr, postal_code: e.target.value })} />
              <Input placeholder="Label" value={newAddr.label} onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })} />
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setNewAddr(null)}>Cancel</Button>
                <Button disabled={!newAddr.line1 || !newAddr.city} onClick={async () => {
                  const a = await createAddress({ ...newAddr, is_default: addresses.length === 0 });
                  setAddresses((x) => [...x, a]);
                  setNewAddr(null);
                }}>Save</Button>
              </div>
            </div>
          ) : <Button variant="ghost" icon="add" onClick={() => setNewAddr({ label: 'Home', line1: '', city: '', state: '', postal_code: '', country: 'India' })}>Add address</Button>}
        </div>
      </Block>

      <Block title="Shopping preferences" subtitle="Used to pre-select sizes and tailor recommendations. You're always in control.">
        <p className="text-label-md font-medium text-on-surface">Sizes</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {Object.entries(prefs.sizes).map(([cat, size]) => (
            <Badge key={cat} tone="primary">{cat}: {size}
              <button onClick={() => { const next = { ...prefs.sizes }; delete next[cat]; savePrefs({ sizes: next }); }} aria-label={`Remove ${cat} size`}><Icon name="close" size={14} /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Select value={sizeRow.category} onChange={(e) => setSizeRow({ ...sizeRow, category: e.target.value })}>
            <option value="">Category…</option>{categories.map((c) => <option key={c.name}>{c.name}</option>)}
          </Select>
          <Input placeholder="Size" value={sizeRow.size} onChange={(e) => setSizeRow({ ...sizeRow, size: e.target.value })} />
          <Button variant="secondary" disabled={!sizeRow.category || !sizeRow.size} onClick={() => { savePrefs({ sizes: { ...prefs.sizes, [sizeRow.category]: sizeRow.size } }); setSizeRow({ category: '', size: '' }); }}>Add</Button>
        </div>

        <p className="text-label-md font-medium text-on-surface mt-4">Favourite colours</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {prefs.colors.map((c) => (
            <Badge key={c} tone="slate">{c}<button onClick={() => savePrefs({ colors: prefs.colors.filter((x) => x !== c) })} aria-label={`Remove ${c}`}><Icon name="close" size={14} /></button></Badge>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input placeholder="e.g. black" value={color} onChange={(e) => setColor(e.target.value)} />
          <Button variant="secondary" disabled={!color.trim()} onClick={() => { savePrefs({ colors: [...prefs.colors, color.trim().toLowerCase()] }); setColor(''); }}>Add</Button>
        </div>

        <p className="text-label-md font-medium text-on-surface mt-4">Usual budget</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {Object.entries(prefs.budgets).map(([cat, amt]) => (
            <Badge key={cat} tone="slate">{cat}: {inr(amt)}
              <button onClick={() => { const next = { ...prefs.budgets }; delete next[cat]; savePrefs({ budgets: next }); }} aria-label={`Remove ${cat} budget`}><Icon name="close" size={14} /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Select value={budgetRow.category} onChange={(e) => setBudgetRow({ ...budgetRow, category: e.target.value })}>
            <option value="">Category…</option>{categories.map((c) => <option key={c.name}>{c.name}</option>)}
          </Select>
          <Input type="number" placeholder="₹" value={budgetRow.amount} onChange={(e) => setBudgetRow({ ...budgetRow, amount: e.target.value })} />
          <Button variant="secondary" disabled={!budgetRow.category || !budgetRow.amount} onClick={() => { savePrefs({ budgets: { ...prefs.budgets, [budgetRow.category]: Number(budgetRow.amount) } }); setBudgetRow({ category: '', amount: '' }); }}>Add</Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <Field label="Delivery preference">
            <Select value={prefs.delivery_preference || ''} onChange={(e) => savePrefs({ delivery_preference: e.target.value || null })}>
              <option value="">No preference</option><option value="standard">Standard (cheaper)</option><option value="express">Express (faster)</option>
            </Select>
          </Field>
          <Field label="Preferred sellers">
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
              {!learned?.preferred_sellers?.length && <span className="text-label-sm text-on-surface-variant">Sellers you buy from will show up here.</span>}
            </div>
          </Field>
        </div>
      </Block>

      <Block title="Notifications" subtitle="In-app notifications are always on. Choose the other channels.">
        {['email', 'sms', 'whatsapp', 'push'].map((ch) => (
          <Toggle key={ch} label={{ email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', push: 'Push notifications' }[ch]}
            checked={!!prefs.notification_settings[ch]} onChange={(v) => savePrefs({ notification_settings: { [ch]: v } }, 'Notification settings saved')} />
        ))}
      </Block>

      <Block title="Voice">
        <Toggle label="Speak the assistant's replies aloud" checked={prefs.voice_settings.auto_speak !== false}
          onChange={(v) => savePrefs({ voice_settings: { auto_speak: v } })} />
        <Field label="Voice language" hint="Defaults to your app language.">
          <Select value={prefs.voice_settings.voice_language || ''} onChange={(e) => savePrefs({ voice_settings: { voice_language: e.target.value || null } })}>
            <option value="">Same as app language</option>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </Select>
        </Field>
      </Block>

      <Block title="Privacy">
        <Toggle label="Personalise using my purchase history" checked={prefs.privacy_settings.personalisation !== false}
          onChange={(v) => savePrefs({ privacy_settings: { personalisation: v } }, v ? 'Personalisation on' : 'Personalisation off — we no longer use your history')} />
        <Toggle label="Keep a history of my voice requests" checked={prefs.privacy_settings.save_voice_history !== false}
          onChange={(v) => savePrefs({ privacy_settings: { save_voice_history: v } })} />
      </Block>

      <Block title="What we remember" subtitle="Worked out from your orders. Explicit preferences above always win.">
        {!pers?.personalisation_enabled ? (
          <p className="text-label-md text-on-surface-variant">Personalisation is off, so nothing from your history is used.</p>
        ) : !learned?.orders_count ? (
          <p className="text-label-md text-on-surface-variant">Nothing yet — this fills in as you shop.</p>
        ) : (
          <ul className="text-label-md text-on-surface space-y-1">
            <li>Orders: {learned.orders_count}</li>
            {Object.entries(learned.sizes).map(([c, s]) => <li key={c}>You usually buy size <strong>{s}</strong> in {c}</li>)}
            {Object.entries(learned.budgets).map(([c, b]) => <li key={c}>Typical spend on {c}: <strong>{inr(b)}</strong></li>)}
            {learned.colors.length > 0 && <li>Colours you pick: {learned.colors.join(', ')}</li>}
            {learned.delivery_preference && <li>Usual delivery: {learned.delivery_preference}</li>}
            {learned.frequent_products.map((f) => <li key={f.product_id}>Frequently bought: {f.name} (×{f.quantity})</li>)}
          </ul>
        )}
      </Block>
    </div>
  );
}
