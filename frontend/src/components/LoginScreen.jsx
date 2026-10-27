/**
 * Login / registration (PRD §6), built for shop owners on a phone:
 * mobile number + SMS code first (no password to remember), password as the
 * other option, and a short sign-up — name, shop name, mobile, password —
 * with everything else optional. Language can be chosen before logging in.
 * Demo accounts appear only in development builds.
 */
import { useState } from 'react';
import { registerUser, loginUser, demoLogin, setSession } from '../services/storage';
import { requestOtp, verifyOtp } from '../services/smb';
import { Icon, ErrorNote } from './ui';
import LanguagePicker from './LanguagePicker';
import { getLang, t } from '../i18n';

const ROLES = [
  { key: 'seller', icon: 'storefront', label: 'Seller', note: 'I want to sell' },
  { key: 'buyer', icon: 'shopping_bag', label: 'Buyer', note: 'I want to buy' },
  { key: 'logistics', icon: 'local_shipping', label: 'Delivery', note: 'I deliver parcels' },
];

const DEMO_ACCOUNTS = [
  { key: 'seller4', label: 'Seller', sub: 'Chennai Footwear Co', icon: 'storefront' },
  { key: 'seller1', label: 'Seller', sub: 'Murugan Silks', icon: 'storefront' },
  { key: 'buyer1', label: 'Buyer', sub: 'Priya Sundaram', icon: 'shopping_bag' },
  { key: 'buyer2', label: 'Buyer', sub: 'Arun Kumar', icon: 'shopping_bag' },
  { key: 'logistics1', label: 'Delivery', sub: 'SwiftShip Chennai', icon: 'local_shipping' },
  { key: 'admin', label: 'Admin', sub: 'Platform admin', icon: 'admin_panel_settings' },
];

const field = 'w-full h-12 pl-12 pr-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none';

/** "+91 98765-43210" → "9876543210". Emails pass through unchanged. */
function normalizeIdentifier(value) {
  const v = value.trim();
  if (v.includes('@')) return v.toLowerCase();
  const digits = v.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}

function IconInput({ icon, label, id, after, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-md text-on-surface font-medium" htmlFor={id}>{label}</label>
      <div className="relative flex items-center">
        <Icon name={icon} className="absolute left-4 text-on-surface-variant" />
        <input id={id} className={`${field} ${after ? 'pr-14' : ''}`} {...props} />
        {after}
      </div>
    </div>
  );
}

function PasswordInput({ id, label, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <IconInput id={id} icon="lock" label={label} type={show ? 'text' : 'password'} {...props}
      after={(
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t('Hide password') : t('Show password')}
          className="absolute right-2 w-10 h-10 flex items-center justify-center text-on-surface-variant">
          <Icon name={show ? 'visibility_off' : 'visibility'} />
        </button>
      )} />
  );
}

export default function LoginScreen({ onLogin, notice }) {
  const [mode, setMode] = useState('otp'); // otp | login | signup
  const [role, setRole] = useState('seller');
  const [form, setForm] = useState({
    identifier: '', password: '', fullName: '', email: '', phone: '', businessName: '', license: '',
    city: '', company: '', vehicle: '', code: '',
  });
  const [otpSent, setOtpSent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const switchMode = (m) => { setMode(m); setError(''); setOtpSent(null); };
  const id = normalizeIdentifier(form.identifier);

  const run = async (fn) => {
    setError('');
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      if (err.status === 404 && mode !== 'signup') setError(t('No account found with this number. Tap "Create an account" below.'));
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!id || !form.password) return setError(t('Enter your mobile number and password'));
    run(async () => onLogin(await loginUser(id, form.password)));
  };

  const handleOtp = (e) => {
    e.preventDefault();
    if (!id) return setError(t('Enter your mobile number'));
    if (!id.includes('@') && id.length !== 10) return setError(t('Mobile number must be 10 digits'));
    if (!otpSent) run(async () => setOtpSent(await requestOtp(id)));
    else run(async () => onLogin(setSession(await verifyOtp(id, form.code.trim()))));
  };

  const handleSignup = (e) => {
    e.preventDefault();
    const phone = normalizeIdentifier(form.phone);
    if (!form.fullName.trim()) return setError(t('Please enter your name'));
    if (role === 'seller' && !form.businessName.trim()) return setError(t('Please enter your shop name'));
    if (role === 'logistics' && !form.company.trim()) return setError(t('Please enter your company name'));
    if (phone.length !== 10) return setError(t('Mobile number must be 10 digits'));
    if (form.password.length < 6) return setError(t('Password must be at least 6 letters or numbers'));
    const names = form.fullName.trim().split(/\s+/);
    run(async () => onLogin(await registerUser({
      email: form.email.trim() || undefined,
      password: form.password,
      role,
      full_name: form.fullName.trim(),
      phone,
      preferred_language: getLang(),
      city: form.city.trim() || undefined,
      business_name: role === 'seller' ? form.businessName.trim() : undefined,
      business_type: role === 'seller' ? 'retail' : undefined,
      license_number: role === 'seller' ? form.license.trim() || undefined : undefined,
      first_name: role === 'buyer' ? names[0] : undefined,
      last_name: role === 'buyer' ? names.slice(1).join(' ') || 'User' : undefined,
      company_name: role === 'logistics' ? form.company.trim() : undefined,
      service_city: role === 'logistics' ? form.city.trim() || undefined : undefined,
      vehicle_number: role === 'logistics' ? form.vehicle.trim() || undefined : undefined,
    })));
  };

  const handleDemo = async (key) => {
    setError('');
    setDemoLoading(key);
    try {
      onLogin(await demoLogin(key));
    } catch {
      setError('Demo login failed — set DEMO_LOGIN_ENABLED=true and run backend/seed_demo_users.py.');
      setDemoLoading('');
    }
  };

  const submitBtn = 'w-full h-12 bg-primary text-on-primary rounded-lg text-label-md font-semibold disabled:opacity-50';

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <main className="w-full max-w-[460px] bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 md:p-8 shadow-sm">
        <div className="flex justify-end -mt-1 mb-2"><LanguagePicker /></div>
        <header className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center mb-3 shadow-sm">
            <Icon name="handshake" size={30} />
          </div>
          <h1 className="text-headline-lg text-on-surface font-bold">SMBConnect</h1>
          <p className="text-body-md text-on-surface-variant">{t('Sell more. Work less.')}</p>
        </header>

        {notice && <p className="mb-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg px-4 py-3 text-body-md">{notice}</p>}

        {mode !== 'signup' && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-surface-container rounded-xl mb-5" role="tablist">
            {[{ k: 'otp', l: t('SMS code') }, { k: 'login', l: t('Password') }].map((tab) => (
              <button key={tab.k} role="tab" aria-selected={mode === tab.k} onClick={() => switchMode(tab.k)}
                className={`h-11 rounded-lg text-label-md font-medium ${mode === tab.k ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}>
                {tab.l}
              </button>
            ))}
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>

        {mode === 'otp' && (
          <form className="space-y-4 mt-3" onSubmit={handleOtp}>
            <IconInput id="otp-id" icon="smartphone" label={t('Mobile number')} value={form.identifier} onChange={set('identifier')}
              inputMode="tel" autoComplete="tel" placeholder="98765 43210" disabled={!!otpSent} />
            {otpSent && (
              <>
                <p className="text-body-md text-on-surface-variant">
                  {t('We sent a 6-digit code to your phone. It works for {n} minutes.', { n: Math.round(otpSent.expires_in / 60) })}
                </p>
                {otpSent.dev_code && (
                  <p className="text-label-md bg-amber-50 text-amber-900 border border-amber-200 rounded-lg px-3 py-2">
                    Development mode — your code is <strong>{otpSent.dev_code}</strong>
                  </p>
                )}
                <IconInput id="otp-code" icon="pin" label={t('Code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={form.code} onChange={set('code')} placeholder="123456" autoFocus />
              </>
            )}
            <button type="submit" disabled={loading} className={submitBtn}>
              {loading ? t('Please wait…') : otpSent ? t('Log in') : t('Send me a code')}
            </button>
            {otpSent && <button type="button" onClick={() => setOtpSent(null)} className="w-full h-11 text-label-md text-primary">{t('Use a different number')}</button>}
          </form>
        )}

        {mode === 'login' && (
          <form className="space-y-4 mt-3" onSubmit={handleLogin}>
            <IconInput id="identifier" icon="smartphone" label={t('Mobile number or email')} value={form.identifier} onChange={set('identifier')}
              placeholder="98765 43210" autoComplete="username" />
            <PasswordInput id="password" label={t('Password')} value={form.password} onChange={set('password')} autoComplete="current-password" />
            <button type="submit" disabled={loading} className={submitBtn}>{loading ? t('Please wait…') : t('Log in')}</button>
            <button type="button" onClick={() => switchMode('otp')} className="w-full h-11 text-label-md text-primary">
              {t('Forgot password? Log in with an SMS code')}
            </button>
          </form>
        )}

        {mode === 'signup' && (
          <form className="space-y-4" onSubmit={handleSignup}>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button type="button" key={r.key} onClick={() => setRole(r.key)} aria-pressed={role === r.key}
                  className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl border-2 text-center ${role === r.key ? 'border-primary bg-primary-container/15 text-primary' : 'border-outline-variant text-on-surface-variant'}`}>
                  <Icon name={r.icon} size={24} />
                  <span className="text-label-md font-semibold">{t(r.label)}</span>
                  <span className="text-label-sm leading-tight">{t(r.note)}</span>
                </button>
              ))}
            </div>
            <IconInput id="name" icon="badge" label={t('Your name')} value={form.fullName} onChange={set('fullName')} placeholder="e.g. Rajesh Kumar" autoComplete="name" />
            {role === 'seller' && (
              <IconInput id="biz" icon="store" label={t('Shop name')} value={form.businessName} onChange={set('businessName')} placeholder="e.g. Rajesh Traders" />
            )}
            {role === 'logistics' && (
              <IconInput id="company" icon="local_shipping" label={t('Company name')} value={form.company} onChange={set('company')} placeholder="e.g. SwiftShip Chennai" />
            )}
            <IconInput id="phone" icon="smartphone" label={t('Mobile number')} inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="98765 43210" />
            <PasswordInput id="new-password" label={t('Make a password')} value={form.password} onChange={set('password')}
              placeholder={t('At least 6 letters or numbers')} autoComplete="new-password" />
            <details className="rounded-lg border border-outline-variant px-4 py-2">
              <summary className="text-label-md text-primary font-medium cursor-pointer py-1">{t('More details (optional)')}</summary>
              <div className="space-y-4 mt-3 mb-2">
                <IconInput id="email" icon="mail" label={t('Email (optional)')} type="email" value={form.email} onChange={set('email')} placeholder="name@example.com" autoComplete="email" />
                <IconInput id="city" icon="location_on" label={role === 'logistics' ? t('City you deliver in') : t('City')} value={form.city} onChange={set('city')} placeholder="e.g. Chennai" />
                {role === 'seller' && (
                  <IconInput id="lic" icon="verified_user" label={t('GST or shop licence number (optional)')} value={form.license} onChange={set('license')} placeholder="e.g. 33ABCDE1234F1Z5" />
                )}
                {role === 'logistics' && (
                  <IconInput id="vehicle" icon="two_wheeler" label={t('Vehicle number (optional)')} value={form.vehicle} onChange={set('vehicle')} placeholder="TN09 AB 1234" />
                )}
              </div>
            </details>
            <button type="submit" disabled={loading} className={submitBtn}>{loading ? t('Please wait…') : t('Create account')}</button>
          </form>
        )}

        <button type="button" onClick={() => switchMode(mode === 'signup' ? 'otp' : 'signup')}
          className="w-full h-12 mt-3 border-2 border-primary text-primary rounded-lg text-label-md font-semibold">
          {mode === 'signup' ? t('I already have an account') : t('Create an account')}
        </button>

        {import.meta.env.DEV && mode !== 'signup' && (
          <div className="mt-6">
            <p className="text-label-sm text-on-surface-variant text-center mb-2">Demo accounts (development only)</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button type="button" key={acc.key} disabled={!!demoLoading} onClick={() => handleDemo(acc.key)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-outline-variant hover:border-primary/60 hover:bg-primary-container/10 disabled:opacity-50 text-left">
                  <Icon name={demoLoading === acc.key ? 'progress_activity' : acc.icon} className={`text-primary flex-shrink-0 ${demoLoading === acc.key ? 'animate-spin' : ''}`} />
                  <span className="min-w-0">
                    <span className="block text-label-md text-on-surface font-semibold">{acc.label}</span>
                    <span className="block text-label-sm text-on-surface-variant truncate">{acc.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
