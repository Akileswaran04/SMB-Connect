
import { useRef } from 'react';
import { generateId } from '../../../hooks/useLocalStorage';

export default function DocumentUpload({ documents = [], onChange }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) continue;

      const reader = new FileReader();
      reader.onload = (ev) => {
        onChange([...documents, {
          id: generateId(), name: file.name, dataUrl: ev.target.result,
          uploadedAt: new Date().toISOString(), status: 'pending',
        }]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeDocument = (docId) => {
    onChange(documents.filter((d) => d.id !== docId));
  };

  const getStatusBadge = (status) => {
    if (status === 'verified') return 'bg-emerald-100 text-emerald-800';
    return 'bg-amber-100 text-amber-800';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-label-md text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">description</span>
          Business Documents
        </label>
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="h-10 px-3 bg-surface-container hover:bg-surface-container-high text-on-surface text-label-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors">
          <span className="material-symbols-outlined text-[16px]">upload_file</span>
          Upload File
        </button>
        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple onChange={handleFileSelect} className="hidden" />
      </div>

      <p className="text-label-sm text-on-surface-variant">
        Upload GST certificate, shop license, or ID proof (PDF, JPG, PNG)
      </p>

      {documents.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-outline-variant rounded-xl text-on-surface-variant">
          <span className="material-symbols-outlined text-[24px] opacity-40">description</span>
          <p className="text-body-md mt-1">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between bg-surface-container-low rounded-lg px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant flex-shrink-0">
                  {doc.name.endsWith('.pdf') ? 'picture_as_pdf' : 'image'}
                </span>
                <div className="min-w-0">
                  <p className="text-label-md text-on-surface font-medium truncate">{doc.name}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    Uploaded {new Date(doc.uploadedAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-label-sm font-medium capitalize ${getStatusBadge(doc.status)}`}>
                  {doc.status}
                </span>
                <button onClick={() => removeDocument(doc.id)}
                  className="p-1.5 hover:bg-error-container/30 text-on-surface-variant hover:text-error rounded-lg transition-colors" title="Remove document">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
