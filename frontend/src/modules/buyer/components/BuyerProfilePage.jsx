
import { useState, useEffect } from 'react';
import { getBuyerById, updateBuyer, getMyLanguage, updatePreferredLanguage } from '../../../services/storage';

const LANGUAGES = ['English', 'Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam'];

export default function BuyerProfilePage({ onToast }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState('English');
  const [savingLanguage, setSavingLanguage] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await getBuyerById();
      setProfile(data);
      setForm({
        first_name: data?.first_name || '',
        last_name: data?.last_name || '',
        phone: data?.phone || '',
        city: data?.city || '',
        country: data?.country || '',
        default_address: data?.default_address || '',
      });
    })();
    getMyLanguage().then((lang) => setLanguage(lang === 'en' ? 'English' : lang));
  }, []);

  const saveLanguage = async (next) => {
    setLanguage(next);
    setSavingLanguage(true);
    try {
      await updatePreferredLanguage(next);
      onToast?.('Language preference saved');
    } catch (err) {
      onToast?.(err.message || 'Could not save language', 'error');
    } finally {
      setSavingLanguage(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateBuyer(profile?.id, form);
      setProfile(updated);
      onToast?.('Profile updated');
    } catch (err) {
      onToast?.(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex justify-center py-16">
        <span className="material-symbols-outlined animate-pulse text-[40px] text-on-surface-variant">sync</span>
      </div>
    );
  }

  const fields = [
    { key: 'first_name', label: 'First Name', icon: 'person' },
    { key: 'last_name', label: 'Last Name', icon: 'person' },
    { key: 'phone', label: 'Phone', icon: 'phone' },
    { key: 'city', label: 'City', icon: 'location_on' },
    { key: 'country', label: 'Country', icon: 'public' },
    { key: 'default_address', label: 'Default Address', icon: 'home' },
  ];

  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-headline-md text-on-surface font-semibold">My Profile</h2>
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-headline-md font-bold">
            {(form.first_name || 'B').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-label-md text-on-surface font-semibold">{form.first_name} {form.last_name}</p>
            <p className="text-label-sm text-on-surface-variant">Buyer account</p>
          </div>
        </div>
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface">{f.label}</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-on-surface-variant">{f.icon}</span>
              <input
                value={form[f.key] || ''}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full h-11 pl-12 pr-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <label className="text-label-md text-on-surface">Preferred Language</label>
          <p className="text-label-sm text-on-surface-variant">Used for chat translation and the voice assistant.</p>
          <select
            value={language}
            onChange={(e) => saveLanguage(e.target.value)}
            disabled={savingLanguage}
            className="w-full h-11 px-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:outline-none"
          >
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="w-full h-12 rounded-lg bg-primary text-on-primary text-label-md font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}