/**
 * Seller profile (PRD §30): the store profile form plus payout details
 * (only the last 4 digits of the bank account are stored) and verification
 * status with submit-for-review.
 */
import { useState, lazy, Suspense } from 'react';
import { updateSellerProfile, submitSellerProfile } from '../../services/smb';
import { Card, Field, Input, Button, StatusBadge, Loading, ErrorNote } from '../../components/ui';
import LanguagePicker from '../../components/LanguagePicker';
import { t } from '../../i18n';

const ProfileForm = lazy(() => import('../seller-profile').then((m) => ({ default: m.ProfileForm })));

const VERIFY_NOTE = {
  draft: 'Fill in your shop details and documents below, then tap "Send for verification". Verified shops get a badge buyers trust.',
  submitted: 'Sent — our team will check your documents soon.',
  under_review: 'Our team is checking your documents.',
  verified: 'Verified — buyers see the verified badge on your products.',
  rejected: 'Not approved yet — please fix your details and send again.',
  suspended: 'Your shop is paused. Please contact help.',
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
      onToast?.(t('Bank details saved'));
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    try {
      await submitSellerProfile();
      onToast?.(t('Sent for verification'));
      reload();
    } catch (err) {
      onToast?.(err.message, 'error');
    }
  };

  const status = seller.verification_status;
  return (
    <div className="space-y-4">
      <Card className="p-5 flex flex-wrap items-center gap-3">
        <div className="w-full flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-outline-variant">
          <span className="text-title-sm font-semibold">{t('App language')}</span><LanguagePicker />
        </div>
        <div className="flex-1 min-w-[220px]">
          <p className="text-title-sm font-semibold text-on-surface flex items-center gap-2">{t('Verification')} <StatusBadge status={status} /></p>
          <p className="text-label-md text-on-surface-variant">{t(VERIFY_NOTE[status] || '')}</p>
        </div>
        {['draft', 'rejected'].includes(status) && <Button size="lg" icon="verified" onClick={submit}>{t('Send for verification')}</Button>}
      </Card>

      <Card className="p-5">
        <h2 className="text-title-sm font-semibold text-on-surface">{t('Where should we send your money?')}</h2>
        <p className="text-label-md text-on-surface-variant mb-3">{t('Add a bank account or a UPI ID. We keep only the last 4 digits of your account number.')}</p>
        <ErrorNote>{error}</ErrorNote>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          <Field label={t('Owner name')}><Input value={payout.owner_name} onChange={(e) => setPayout({ ...payout, owner_name: e.target.value })} /></Field>
          <Field label={t('Name on bank account')}><Input value={payout.bank_account_holder} onChange={(e) => setPayout({ ...payout, bank_account_holder: e.target.value })} /></Field>
          <Field label={t('Bank account number')} hint={seller.bank_account_last4 ? `${t('Saved')}: ••••${seller.bank_account_last4}` : t('9 to 18 digits')}>
            <Input inputMode="numeric" value={payout.bank_account_number} onChange={(e) => setPayout({ ...payout, bank_account_number: e.target.value.replace(/\D/g, '') })} placeholder={seller.bank_account_last4 ? t('Type a new number to change it') : ''} />
          </Field>
          <Field label={t('IFSC code')} hint={t('Printed on your cheque book or passbook')}><Input value={payout.bank_ifsc} onChange={(e) => setPayout({ ...payout, bank_ifsc: e.target.value.toUpperCase() })} placeholder="HDFC0001234" /></Field>
          <Field label={t('UPI ID (optional)')}><Input value={payout.upi_id} onChange={(e) => setPayout({ ...payout, upi_id: e.target.value })} placeholder="yourstore@okhdfc" /></Field>
        </div>
        <div className="flex justify-end mt-3"><Button onClick={savePayout} disabled={saving}>{saving ? t('Saving…') : t('Save bank details')}</Button></div>
      </Card>

      <Suspense fallback={<Loading />}>
        <ProfileForm seller={seller} products={[]} onSellerUpdate={onSellerUpdate} onToast={onToast} />
      </Suspense>
    </div>
  );
}
