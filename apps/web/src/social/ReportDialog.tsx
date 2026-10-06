import { useState } from 'react';
import { Button, Dialog, Input, Select, useToast } from '@bg/ui';
import { api, ApiFailure } from '../lib/api.ts';

const REASONS = [
  { value: 'abuse', label: 'توهین یا آزار' },
  { value: 'spam', label: 'هرزنامه' },
  { value: 'cheating', label: 'تقلب یا تبانی' },
  { value: 'inappropriate_name', label: 'نام نمایشی نامناسب' },
  { value: 'other', label: 'سایر' }
];

export function ReportDialog({ targetType, targetId, label, onClose }: {
  targetType: 'user' | 'display_name' | 'message' | 'table'; targetId: string; label: string; onClose: () => void;
}) {
  const toast = useToast();
  const [reasonCode, setReasonCode] = useState(targetType === 'display_name' ? 'inappropriate_name' : 'abuse');
  const [reason, setReason] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async () => {
    setBusy(true); setError(undefined);
    try {
      await api('/reports', { method: 'POST', body: { targetType, targetId, reasonCode, reason, ...(evidenceRef.trim() ? { evidenceRef } : {}) } });
      toast('success', 'گزارش ثبت شد. نتیجه را در «پشتیبانی» می‌بینید.');
      onClose();
    } catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'ثبت نشد.'); } finally { setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} title={`گزارش ${label}`}
      footer={<><Button variant="ghost" onClick={onClose}>انصراف</Button><Button busy={busy} disabled={reason.trim().length < 3} onClick={submit}>ثبت گزارش</Button></>}>
      <div className="stack">
        <Select label="دلیل" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} options={REASONS} />
        <Input label="توضیح" value={reason} onChange={(e) => setReason(e.target.value)} hint="چه اتفاقی افتاد؟ (حداقل ۳ نویسه)" error={error} />
        <Input label="شناسه شاهد (اختیاری)" value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} hint="مثلاً شماره میز یا توضیح تصویر" />
      </div>
    </Dialog>
  );
}
