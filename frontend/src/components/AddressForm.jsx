/**
 * Indian address entry: house/street, a 6-digit PIN code that fills in city
 * and state by itself (free India Post lookup), and a tap-to-pick label.
 */
import { Input } from './ui';
import { t } from '../i18n';

const LABELS = ['Home', 'Shop', 'Work', 'Other'];

/** City and state for an Indian PIN code (free India Post lookup); null when unknown. */
async function lookupPin(pin) {
  try {
    const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const office = (await r.json())?.[0]?.PostOffice?.[0];
    return office ? { city: office.District, state: office.State } : null;
  } catch {
    return null;
  }
}

export default function AddressForm({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const onPin = async (e) => {
    const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange({ ...value, postal_code: pin });
    if (pin.length === 6) {
      const found = await lookupPin(pin);
      if (found) onChange({ ...value, postal_code: pin, city: value.city || found.city, state: value.state || found.state });
    }
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2"><Input placeholder={t('House no., street, area')} value={value.line1} onChange={set('line1')} autoComplete="address-line1" /></div>
      <Input placeholder={t('PIN code (6 digits)')} inputMode="numeric" maxLength={6} value={value.postal_code} onChange={onPin} autoComplete="postal-code" />
      <Input placeholder={t('City')} value={value.city} onChange={set('city')} autoComplete="address-level2" />
      <div className="col-span-2"><Input placeholder={t('State')} value={value.state} onChange={set('state')} autoComplete="address-level1" /></div>
      <div className="col-span-2 flex flex-wrap gap-2">
        {LABELS.map((l) => (
          <button key={l} type="button" onClick={() => onChange({ ...value, label: l })} aria-pressed={value.label === l}
            className={`h-10 px-4 rounded-full border text-label-md ${value.label === l ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant'}`}>{t(l)}</button>
        ))}
      </div>
    </div>
  );
}
export const EMPTY_ADDRESS = { label: 'Home', line1: '', city: '', state: '', postal_code: '', country: 'India' };
