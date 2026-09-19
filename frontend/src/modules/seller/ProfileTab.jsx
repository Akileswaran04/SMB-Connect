/**
 * Seller profile (PRD §30): the store profile form plus payout details
 * (only the last 4 digits of the bank account are stored) and verification
 * status with submit-for-review.
 */
import { useState, lazy, Suspense } from 'react';
import { updateSellerProfile, submitSellerProfile } from '../../services/smb';
import { Card, Field, Input, Button, StatusBadge, Loading, ErrorNote } from '../../components/ui';

const ProfileForm = lazy(() => import('../seller-profile').then((m) => ({ default: m.ProfileForm })));

const VERIFY_NOTE = {
  draft: 'Complete your details and submit them for verification.',
  submitted: 'Submitted — an admin will review your documents shortly.',
  under_review: 'Under review.',
  verified: 'Verified — buyers see the verified badge on your products.',
  rejected: 'Verification was rejected — update your details and resubmit.',
  suspended: 'Your store is suspended. Contact support.',
};

export default function ProfileTab({ seller, onToast, onSellerUpdate, reload }) {
  const [payout, setPayout] = useState({
    owner_name: seller.owner_name || '', bank_account_holder: seller.bank_account_holder || '', bank_account_number: '',
    bank_ifsc: seller.bank_ifsc || '', upi_id: seller.upi_id || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const savePayout = async () => {
    setError('');
    const body = Object.fromEntries(Object.entries(payout).filter(([, v]) => v !== ''));
    setSaving(true);
    try {
      await updateSellerProfile(body);
      setPayout((p) => ({ ...p, bank_account_number: '' }));
      onToast?.('Payout details saved');
      reload();
    } catch (err) {
      setError(err.message || 'Could not save — check the account number, IFSC and UPI ID');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    try {
      await submitSellerProfile();
      onToast?.('Submitted for verification');
      reload();
    } catch (err) {
      onToast?.(err.message || 'Could not submit', 'error');
    }
  };

  const status = seller.verification_status;
  return (
    <div className="space-y-4">
      <Card className="p-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <p className="text-title-sm font-semibold text-on-surface flex items-center gap-2">Verification <StatusBadge status={status} /></p>
          <p className="text-label-md text-on-surface-variant">{VERIFY_NOTE[status] || ''}</p>
        </div>
        {['draft', 'rejected'].includes(status) && <Button icon="verified" onClick={submit}>Submit for verification</Button>}
      </Card>

      <Card className="p-5">
        <h2 className="text-title-sm font-semibold text-on-surface">Owner & payouts</h2>
        <p className="text-label-md text-on-surface-variant mb-3">Where we settle your earnings. We store only the last 4 digits of your account number.</p>
        <ErrorNote>{error}</ErrorNote>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          <Field label="Owner name"><Input value={payout.owner_name} onChange={(e) => setPayout({ ...payout, owner_name: e.target.value })} /></Field>
          <Field label="Account holder name"><Input value={payout.bank_account_holder} onChange={(e) => setPayout({ ...payout, bank_account_holder: e.target.value })} /></Field>
          <Field label="Bank account number" hint={seller.bank_account_last4 ? `Saved: ••••${seller.bank_account_last4}` : '9–18 digits'}>
            <Input inputMode="numeric" value={payout.bank_account_number} onChange={(e) => setPayout({ ...payout, bank_account_number: e.target.value.replace(/\D/g, '') })} placeholder={seller.bank_account_last4 ? 'Enter to replace' : ''} />
          </Field>
          <Field label="IFSC"><Input value={payout.bank_ifsc} onChange={(e) => setPayout({ ...payout, bank_ifsc: e.target.value.toUpperCase() })} placeholder="HDFC0001234" /></Field>
          <Field label="UPI ID"><Input value={payout.upi_id} onChange={(e) => setPayout({ ...payout, upi_id: e.target.value })} placeholder="yourstore@okhdfc" /></Field>
        </div>
        <div className="flex justify-end mt-3"><Button onClick={savePayout} disabled={saving}>{saving ? 'Saving…' : 'Save payout details'}</Button></div>
      </Card>

      <Suspense fallback={<Loading />}>
        <ProfileForm seller={seller} products={[]} onSellerUpdate={onSellerUpdate} onToast={onToast} />
      </Suspense>
    </div>
  );
}
