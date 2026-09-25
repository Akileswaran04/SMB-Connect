
import { useState } from 'react';
import { registerUser, loginUser, demoLogin } from '../services/storage';

const DEMO_ACCOUNTS = [
  { key: 'seller1', label: 'Seller 1', sub: 'Murugan Silks', icon: 'storefront', role: 'seller' },
  { key: 'seller2', label: 'Seller 2', sub: 'Lakshmi Filter Coffee', icon: 'storefront', role: 'seller' },
  { key: 'seller3', label: 'Seller 3', sub: 'Karthik Handicrafts', icon: 'storefront', role: 'seller' },
  { key: 'buyer1', label: 'Buyer 1', sub: 'Priya Sundaram', icon: 'shopping_bag', role: 'buyer' },
  { key: 'buyer2', label: 'Buyer 2', sub: 'Arun Kumar', icon: 'shopping_bag', role: 'buyer' },
  { key: 'buyer3', label: 'Buyer 3', sub: 'Divya Balasubramanian', icon: 'shopping_bag', role: 'buyer' },
];

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('seller');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [city, setCity] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState('');

  const handleDemoLogin = async (demoKey) => {
    setError('');
    setDemoLoading(demoKey);
    try {
      const result = await demoLogin(demoKey);
      onLogin(result);
    } catch (err) {
      setError('Demo login failed. Run the seed script first (seed_demo_users.py).');
      setDemoLoading('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        if (!fullName.trim()) {
          setError('Please enter your name');
          setLoading(false);
          return;
        }
        if (role === 'seller' && !businessName.trim()) {
          setError('Please enter your business name');
          setLoading(false);
          return;
        }
        const result = await registerUser({
          email: identifier.includes('@') ? identifier.trim() : `${identifier.trim()}@technova.local`,
          password: password,
          role,
          full_name: fullName.trim(),
          phone: identifier.includes('@') ? null : identifier.trim(),

          business_name: role === 'seller' ? businessName.trim() : undefined,
          business_type: 'retail',
          license_number: role === 'seller' ? licenseNumber.trim() : undefined,

          first_name: role === 'buyer' ? fullName.trim().split(' ')[0] : undefined,
          last_name: role === 'buyer' ? (fullName.trim().split(' ').slice(1).join(' ') || 'User') : undefined,
          city: role === 'buyer' ? city.trim() : undefined,
        });
        onLogin(result);
      } else {
        const result = await loginUser(identifier.trim(), password);
        onLogin(result);
      }
    } catch (err) {
      if (err.status === 404) {
        setError(mode === 'login'
          ? 'No account found. Please sign up first.'
          : 'An account with this email already exists.');
      } else if (err.status === 409) {
        setError('An account with this email already exists. Try logging in.');
      } else if (err.status === 422) {
        setError('Incorrect password or invalid details. Please try again.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <main className="w-full max-w-[440px] bg-surface-container-lowest border border-outline-variant rounded-xl p-6 md:p-8 shadow-sm">
        <header className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-4 shadow-sm">
            <span className="material-symbols-outlined text-[32px]">storefront</span>
          </div>
          <h1 className="text-headline-lg text-on-surface mb-1" style={{ fontWeight: 600 }}>MSME Connect</h1>
          <p className="text-body-md text-on-surface-variant" id="form-subtitle">
            {mode === 'login' ? 'Sign in to your account' : 'Join as a seller or buyer'}
          </p>
        </header>

        <form className="space-y-4 w-full" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'seller', icon: 'storefront', label: 'Seller' },
                  { key: 'buyer', icon: 'shopping_bag', label: 'Buyer' },
                ].map((option) => (
                  <button
                    type="button"
                    key={option.key}
                    onClick={() => setRole(option.key)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                      role === option.key
                        ? 'border-primary bg-primary-container/20 text-primary'
                        : 'border-outline-variant text-on-surface-variant hover:border-primary/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[24px]">{option.icon}</span>
                    <span className="text-label-md font-semibold">{option.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-label-md text-on-surface" htmlFor="fullName">Full Name</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-on-surface-variant">badge</span>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full h-12 pl-12 pr-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {role === 'seller' && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface" htmlFor="businessName">Business Name</label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-on-surface-variant">store</span>
                      <input
                        id="businessName"
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Rajesh Traders"
                        className="w-full h-12 pl-12 pr-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-md text-on-surface" htmlFor="license">License Number (optional)</label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-on-surface-variant">verified_user</span>
                      <input
                        id="license"
                        type="text"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="e.g. LIC-2024-001"
                        className="w-full h-12 pl-12 pr-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </>
              )}

              {role === 'buyer' && (
                <div className="flex flex-col gap-1">
                  <label className="text-label-md text-on-surface" htmlFor="city">City (optional)</label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-4 text-on-surface-variant">location_on</span>
                    <input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Chennai"
                      className="w-full h-12 pl-12 pr-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface" htmlFor="identifier">
              {mode === 'signup' ? 'Email or Phone' : 'Email or Phone Number'}
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-on-surface-variant">person</span>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. 9876543210 or name@store.com"
                className="w-full h-12 pl-12 pr-4 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label className="text-label-md text-on-surface" htmlFor="password">Password</label>
              {mode === 'login' && (
                <a href="#" className="text-label-sm text-primary hover:text-on-primary-fixed-variant transition-colors">
                  Forgot?
                </a>
              )}
            </div>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-on-surface-variant">lock</span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-12 pl-12 pr-12 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-surface-container p-4 rounded-lg mt-2">
            <span className="material-symbols-outlined text-primary text-[20px] shrink-0">cloud</span>
            <p className="text-label-sm text-on-surface-variant pt-[2px]">
              Your data is stored securely in the cloud. Access it from anywhere.
            </p>
          </div>

          <div className="pt-2 space-y-2 flex flex-col">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 flex items-center justify-center bg-primary hover:bg-on-primary-fixed-variant disabled:opacity-50 text-on-primary text-label-md rounded-lg transition-all active:scale-[0.98] shadow-sm"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
              ) : (
                mode === 'login' ? 'Login' : 'Create Account'
              )}
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-outline-variant"></div>
              <span className="flex-shrink-0 mx-4 text-label-sm text-on-surface-variant">or</span>
              <div className="flex-grow border-t border-outline-variant"></div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
              }}
              className="w-full h-12 flex items-center justify-center bg-transparent border-2 border-primary text-primary hover:bg-surface-container-low text-label-md rounded-lg transition-all active:scale-[0.98]"
            >
              {mode === 'login' ? 'Create Account' : 'Back to Login'}
            </button>
          </div>

          {mode === 'login' && (
            <div className="mt-5">
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-outline-variant"></div>
                <span className="flex-shrink-0 mx-4 text-label-sm text-on-surface-variant">Temporary demo login</span>
                <div className="flex-grow border-t border-outline-variant"></div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    type="button"
                    key={acc.key}
                    disabled={!!demoLoading}
                    onClick={() => handleDemoLogin(acc.key)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest hover:border-primary/60 hover:bg-primary-container/10 disabled:opacity-50 text-left transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px] text-primary flex-shrink-0">
                      {demoLoading === acc.key ? 'sync' : acc.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-label-md text-on-surface font-semibold">{acc.label}</span>
                      <span className="block text-label-sm text-on-surface-variant truncate">{acc.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-label-sm text-on-surface-variant mt-2 text-center">
                One-click access to the seeded demo accounts (all data lives in the cloud DBs).
              </p>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}