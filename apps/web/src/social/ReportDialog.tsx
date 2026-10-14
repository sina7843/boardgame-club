import { useState } from 'react';
import { useToast } from '@bg/ui';
import { Button, Checkbox, Dialog, Radio, Textarea, TextField } from '@bg/ui/bgv';
import { api, ApiFailure } from '../lib/api.ts';

const REASONS = [
  { value: 'abuse', label: 'توهین یا آزار' },
  { value: 'spam', label: 'هرزنامه' },
  { value: 'cheating', label: 'تقلب یا تبانی' },
  { value: 'inappropriate_name', label: 'نام نمایشی نامناسب' },
  { value: 'other', label: 'سایر' }
];

export function ReportDialog({ targetType, targetId, label, onClose, quote, mute }: {
  targetType: 'user' | 'display_name' | 'bio' | 'message' | 'table'; targetId: string; label: string; onClose: () => void;
  /** Reported message: shown as a quote above the form. */
  quote?: { author: string; text: string };
  /** Offer «… را برای من بی‌صدا کن» for this sender. */
  mute?: { userId: string; name: string };
}) {
  const toast = useToast();
  const [reasonCode, setReasonCode] = useState(targetType === 'display_name' ? 'inappropriate_name' : 'abuse');
  const [reason, setReason] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [muteToo, setMuteToo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async () => {
    setBusy(true); setError(undefined);
    try {
      await api('/reports', { method: 'POST', body: { targetType, targetId, reasonCode, reason, ...(evidenceRef.trim() ? { evidenceRef } : {}) } });
      if (mute && muteToo) await api('/mutes', { method: 'POST', body: { userId: mute.userId } }).catch(() => undefined);
      toast('success', 'گزارش ثبت شد. نتیجه را در «پشتیبانی» می‌بینید.');
      onClose();
    } catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'ثبت نشد.'); } finally { setBusy(false); }
  };
  return (
    <Dialog modal icon="flag" title={`گزارش ${label}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button variant="primary" loading={busy} disabled={reason.trim().length < 3} onClick={submit}>ثبت گزارش</Button></>}>
      <div className="bgv-stack">
        {quote && <blockquote className="chat-quote"><b><bdi>{quote.author}</bdi></b><p>{quote.text}</p></blockquote>}
        <fieldset className="bgv-stack" style={{ border: 0, padding: 0, margin: 0, gap: 'var(--space-2)' }}>
          <legend className="t-label">دلیل</legend>
          {REASONS.map((r) => <Radio key={r.value} name="report-reason" label={r.label} checked={reasonCode === r.value} onChange={() => setReasonCode(r.value)} />)}
        </fieldset>
        <Textarea label="توضیح" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} hint="چه اتفاقی افتاد؟ (حداقل ۳ نویسه)" error={error} />
        <TextField label="شناسه شاهد (اختیاری)" value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} hint="مثلاً شماره میز یا توضیح تصویر" />
        {mute && <Checkbox label={<><bdi>{mute.name}</bdi> را برای من بی‌صدا کن</>} hint="پیام‌ها و اعلان‌هایش دیگر برای شما نمی‌آید." checked={muteToo} onChange={(e) => setMuteToo(e.target.checked)} />}
      </div>
    </Dialog>
  );
}
