/**
 * Login / registration (PRD §6): mobile or email with password, one-time
 * code login, short sign-up for buyers, sellers and delivery partners with
 * language and location — and one-click demo accounts.
 */
import { useState } from 'react';
import { registerUser, loginUser, demoLogin, setSession } from '../services/storage';
import { requestOtp, verifyOtp } from '../services/smb';
import { Icon, ErrorNote } from './ui';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'tanglish', label: 'Tanglish' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
];

const ROLES = [
  { key: 'buyer', icon: 'shopping_bag', label: 'Buyer' },
  { key: 'seller', icon: 'storefront', label: 'Seller' },
  { key: 'logistics', icon: 'local_shipping', label: 'Delivery' },
];

const DEMO_ACCOUNTS = [
  { key: 'buyer1', label: 'Buyer', sub: 'Priya Sundaram', icon: 'shopping_bag' },
  { key: 'buyer2', label: 'Buyer', sub: 'Arun Kumar', icon: 'shopping_bag' },
  { key: 'seller4', label: 'Seller', sub: 'Chennai Footwear Co', icon: 'storefront' },
  { key: 'seller1', label: 'Seller', sub: 'Murugan Silks', icon: 'storefront' },
  { key: 'logistics1', label: 'Delivery', sub: 'SwiftShip Chennai', icon: 'local_shipping' },
  { key: 'admin', label: 'Admin', sub: 'Platform admin', icon: 'admin_panel_settings' },
];

const field = 'w-full h-12 pl-12 pr-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none';

function IconInput({ icon, label, id, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-md text-on-surface" htmlFor={id}>{label}</label>
      <div className="relative flex items-center">
        <Icon name={icon} className="absolute left-4 text-on-surface-variant" />
        <input id={id} className={field} {...props} />
      </div>
    </div>
  );
}

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login'); // login | otp | signup
  const [role, setRole] = useState('buyer');
  const [form, setForm] = useState({
    identifier: '', password: '', fullName: '', email: '', phone: '', businessName: '', license: '',
    city: '', company: '', vehicle: '', language: 'en', code: '',
  });
  const [otpSent, setOtpSent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const switchMode = (m) => { setMode(m); setError(''); setOtpSent(null); };

  const run = async (fn) => {
    setError('');
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      if (err.status === 404) setError(mode === 'login' ? 'No account found — create one first.' : 'Not found.');
      else if (err.status === 409) setError(err.message || 'That account already exists — try logging in.');
      else if (err.status === 403) setError(err.message || 'This account is suspended.');
      else setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!form.identifier.trim() || !form.password) return setError('Enter your email or mobile number and password');
    run(async () => onLogin(await loginUser(form.identifier.trim(), form.password)));
  };

  const handleOtp = (e) => {
    e.preventDefault();
    if (!form.identifier.trim()) return setError('Enter your email or mobile number');
    if (!otpSent) {
      run(async () => setOtpSent(await requestOtp(form.identifier.trim())));
    } else {
      run(async () => onLogin(setSession(await verifyOtp(form.identifier.trim(), form.code.trim()))));
    }
  };

  const handleSignup = (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) return setError('Please enter your name');
    if (!form.email.trim()) return setError('Please enter your email');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (role === 'seller' && !form.businessName.trim()) return setError('Please enter your business name');
    if (role === 'logistics' && !form.company.trim()) return setError('Please enter your company name');
    const names = form.fullName.trim().split(' ');
    run(async () => onLogin(await registerUser({
      email: form.email.trim(),
      password: form.password,
      role,
      full_name: form.fullName.trim(),
      phone: form.phone.trim() || null,
      preferred_language: form.language,
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
      setError('Demo login failed — run backend/seed_demo_users.py first.');
      setDemoLoading('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <main className="w-full max-w-[460px] bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 md:p-8 shadow-sm">
        <header className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center mb-3 shadow-sm">
            <Icon name="handshake" size={30} />
          </div>
          <h1 className="text-headline-lg text-on-surface font-bold">SMBConnect</h1>
          <p className="text-body-md text-on-surface-variant">Less effort. More satisfaction.</p>
        </header>

        {mode !== 'signup' && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-surface-container rounded-xl mb-5" role="tablist">
            {[{ k: 'login', l: 'Password' }, { k: 'otp', l: 'One-time code' }].map((t) => (
              <button key={t.k} role="tab" aria-selected={mode === t.k} onClick={() => switchMode(t.k)}
                className={`h-9 rounded-lg text-label-md font-medium ${mode === t.k ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}>
                {t.l}
              </button>
            ))}
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>

        {mode === 'login' && (
          <form className="space-y-4 mt-3" onSubmit={handleLogin}>
            <IconInput id="identifier" icon="person" label="Email or mobile number" value={form.identifier} onChange={set('identifier')}
              placeholder="9876543210 or name@example.com" autoComplete="username" />
            <IconInput id="password" icon="lock" label="Password" type="password" value={form.password} onChange={set('password')}
              placeholder="Your password" autoComplete="current-password" />
            <button type="submit" disabled={loading} className="w-full h-12 bg-primary text-on-primary rounded-lg text-label-md font-semibold disabled:opacity-50">
              {loading ? 'Signing in…' : 'Log in'}
            </button>
          </form>
        )}

        {mode === 'otp' && (
          <form className="space-y-4 mt-3" onSubmit={handleOtp}>
            <IconInput id="otp-id" icon="smartphone" label="Email or mobile number" value={form.identifier} onChange={set('identifier')}
              placeholder="9876543210 or name@example.com" disabled={!!otpSent} />
            {otpSent && (
              <>
                <p className="text-label-md text-on-surface-variant">
                  We sent a 6-digit code by {otpSent.channel === 'email' ? 'email' : 'SMS'}. It expires in {Math.round(otpSent.expires_in / 60)} minutes.
                </p>
                {otpSent.dev_code && (
                  <p className="text-label-sm bg-amber-50 text-amber-900 border border-amber-200 rounded-lg px-3 py-2">
                    Development mode (no SMS provider configured): your code is <strong>{otpSent.dev_code}</strong>
                  </p>
                )}
                <IconInput id="otp-code" icon="pin" label="Code" inputMode="numeric" maxLength={6} value={form.code} onChange={set('code')} placeholder="123456" autoFocus />
              </>
            )}
            <button type="submit" disabled={loading} className="w-full h-12 bg-primary text-on-primary rounded-lg text-label-md font-semibold disabled:opacity-50">
              {loading ? 'Please wait…' : otpSent ? 'Verify and log in' : 'Send code'}
            </button>
            {otpSent && <button type="button" onClick={() => setOtpSent(null)} className="w-full text-label-md text-primary">Use a different number</button>}
          </form>
        )}

        {mode === 'signup' && (
          <form className="space-y-4" onSubmit={handleSignup}>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button type="button" key={r.key} onClick={() => setRole(r.key)} aria-pressed={role === r.key}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 ${role === r.key ? 'border-primary bg-primary-container/15 text-primary' : 'border-outline-variant text-on-surface-variant'}`}>
                  <Icon name={r.icon} size={22} />
                  <span className="text-label-md font-semibold">{r.label}</span>
                </button>
              ))}
            </div>
            <IconInput id="name" icon="badge" label="Full name" value={form.fullName} onChange={set('fullName')} placeholder="e.g. Priya Sundaram" />
            {role === 'seller' && (
              <>
                <IconInput id="biz" icon="store" label="Business name" value={form.businessName} onChange={set('businessName')} placeholder="e.g. Rajesh Traders" />
                <IconInput id="lic" icon="verified_user" label="License number (optional)" value={form.license} onChange={set('license')} placeholder="e.g. LIC-2024-001" />
              </>
            )}
            {role === 'logistics' && (
              <>
                <IconInput id="company" icon="local_shipping" label="Company name" value={form.company} onChange={set('company')} placeholder="e.g. SwiftShip Chennai" />
                <IconInput id="vehicle" icon="two_wheeler" label="Vehicle number (optional)" value={form.vehicle} onChange={set('vehicle')} placeholder="TN09 AB 1234" />
              </>
            )}
            <IconInput id="email" icon="mail" label="Email" type="email" value={form.email} onChange={set('email')} placeholder="name@example.com" autoComplete="email" />
            <IconInput id="phone" icon="call" label="Mobile number (optional)" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="9876543210" />
            <IconInput id="city" icon="location_on" label={role === 'logistics' ? 'Service city' : 'City'} value={form.city} onChange={set('city')} placeholder="e.g. Chennai" />
            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface" htmlFor="lang">Preferred language</label>
              <div className="relative flex items-center">
                <Icon name="translate" className="absolute left-4 text-on-surface-variant" />
                <select id="lang" value={form.language} onChange={set('language')} className={field}>
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
            </div>
            <IconInput id="new-password" icon="lock" label="Password" type="password" value={form.password} onChange={set('password')}
              placeholder="At least 6 characters" autoComplete="new-password" />
            <button type="submit" disabled={loading} className="w-full h-12 bg-primary text-on-primary rounded-lg text-label-md font-semibold disabled:opacity-50">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}

        <button type="button" onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
          className="w-full h-11 mt-3 border-2 border-primary text-primary rounded-lg text-label-md font-semibold">
          {mode === 'signup' ? 'I already have an account' : 'Create an account'}
        </button>

        {mode !== 'signup' && (
          <div className="mt-6">
            <p className="text-label-sm text-on-surface-variant text-center mb-2">Demo accounts (one click)</p>
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
