/**
 * Verification documents (GST certificate, shop licence, ID proof): take a
 * photo or pick a file. Photos are shrunk on the phone so they always fit;
 * PDFs must be under 1 MB. Up to 3 documents (the backend limit).
 */
import { useRef, useState } from 'react';
import { generateId } from '../../../hooks/useLocalStorage';
import { compressImage } from '../../../utils/image';
import { Icon, Button, StatusBadge } from '../../../components/ui';
import { dateShort } from '../../../utils/format';
import { t } from '../../../i18n';

const MAX_DOCS = 3;
const MAX_PDF_BYTES = 1_000_000;

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (ev) => resolve(ev.target.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function DocumentUpload({ documents = [], onChange, onError }) {
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const full = documents.length >= MAX_DOCS;

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_DOCS - documents.length);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      const added = [];
      for (const file of files) {
        let dataUrl;
        if (file.type === 'application/pdf') {
          if (file.size > MAX_PDF_BYTES) { onError?.(t('This PDF is too big. Please take a photo of the document instead.')); continue; }
          dataUrl = await readAsDataUrl(file);
        } else if (file.type.startsWith('image/')) {
          dataUrl = await compressImage(file, { maxSide: 1600, quality: 0.75 });
        } else {
          onError?.(t('Please choose a photo or a PDF.'));
          continue;
        }
        added.push({ id: generateId(), name: file.name || t('Document photo'), dataUrl, uploadedAt: new Date().toISOString(), status: 'pending' });
      }
      if (added.length) await onChange([...documents, ...added]);
    } catch {
      onError?.(t('Could not read that file. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-body-md text-on-surface-variant">
        {t('Add your GST certificate, shop licence or ID proof (Aadhaar / PAN). A clear photo is enough.')}
      </p>
      {!full && (
        <div className="flex flex-wrap gap-2">
          <Button size="lg" icon={busy ? 'progress_activity' : 'photo_camera'} disabled={busy} onClick={() => cameraRef.current?.click()}>{t('Take a photo')}</Button>
          <Button size="lg" variant="secondary" icon="upload_file" disabled={busy} onClick={() => fileRef.current?.click()}>{t('Choose file')}</Button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFiles} className="hidden" />
          <input ref={fileRef} type="file" accept=".pdf,image/*" multiple onChange={handleFiles} className="hidden" />
        </div>
      )}
      {documents.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-outline-variant rounded-xl text-on-surface-variant">
          <Icon name="description" size={32} className="opacity-40" />
          <p className="text-body-md mt-1">{t('No documents added yet')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 bg-surface-container-low rounded-lg px-3 py-2">
              {doc.dataUrl?.startsWith('data:image') ? <img src={doc.dataUrl} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                : <Icon name="picture_as_pdf" size={32} className="text-on-surface-variant flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-label-md text-on-surface font-medium truncate">{doc.name}</p>
                <p className="text-label-sm text-on-surface-variant">{t('Added')} {dateShort(doc.uploadedAt)}</p>
              </div>
              <StatusBadge status={doc.status === 'verified' ? 'verified' : 'submitted'} />
              <button onClick={() => window.confirm(t('Remove this document?')) && onChange(documents.filter((d) => d.id !== doc.id))}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-error" aria-label={t('Remove')}>
                <Icon name="delete" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {full && <p className="text-label-md text-on-surface-variant">{t('You can add up to 3 documents. Remove one to add another.')}</p>}
    </div>
  );
}
