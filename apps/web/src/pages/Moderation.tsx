import { useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button, DataTable, Input, Segmented, Select, StateBlock, Tabs, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum, jalaliDate } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { SANCTION_FA } from './Support.tsx';

interface QueueItem { id: string; targetType: string; reasonCode: string; reason: string; createdAt: string; subject: { id: string; displayName: string } | null }
interface Detail {
  report: { id: string; targetType: string; reasonCode: string; reason: string; evidenceRef: string | null; status: string };
  reporter: { displayName: string }; subject: { id: string; displayName: string } | null;
  evidence: { reported?: string; messages?: { id: string; sender: string; body: string; createdAt: string; deleted: boolean }[]; game?: string; players?: { seat: number; name: string }[]; result?: unknown; displayName?: string } | null;
  signals: Record<string, number>; priorSanctions: { id: string; kind: keyof typeof SANCTION_FA; reason: string; active: boolean }[];
}
const TARGET_FA: Record<string, string> = { user: 'رفتار کاربر', display_name: 'نام نمایشی', message: 'پیام', table: 'میز' };
const SIGNAL_FA: Record<string, string> = { timeout_loss: 'باخت با اتمام زمان', resigned: 'انصراف', ready_no_show: 'عدم پذیرش حریف‌یابی' };

function ReportReview({ id, onDone }: { id: string; onDone: () => void }) {
  const d = useApi<Detail>(`/mod/reports/${id}`);
  const toast = useToast();
  const [decision, setDecision] = useState<'dismiss' | 'warning' | 'chat_restricted' | 'suspended'>('dismiss');
  const [hours, setHours] = useState('24');
  const [note, setNote] = useState('');
  if (d.error) return <StateBlock kind="error" title="گزارش دریافت نشد">{d.error.messageFa}</StateBlock>;
  if (!d.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const x = d.data;
  const submit = async () => {
    try {
      await api(`/mod/reports/${id}/resolve`, { method: 'POST', body: { decision, note, ...(decision === 'chat_restricted' || decision === 'suspended' ? { durationHours: Number(hours) } : {}) } });
      toast('success', 'تصمیم ثبت شد.');
      onDone();
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ثبت نشد.'); }
  };
  return (
    <section className="panel stack" aria-label="بررسی گزارش">
      <div className="row"><Badge>{TARGET_FA[x.report.targetType]}</Badge><strong>{x.report.reason}</strong></div>
      <p className="muted" style={{ margin: 0 }}>گزارش‌دهنده: <bdi>{x.reporter.displayName}</bdi>{x.subject && <> · موضوع: <Link to={`/users/${x.subject.id}`}><bdi>{x.subject.displayName}</bdi></Link></>}{x.report.evidenceRef && ` · شاهد: ${x.report.evidenceRef}`}</p>
      {x.evidence?.messages && (
        <ol className="list" aria-label="پیام گزارش‌شده و پیام‌های پیرامون آن">
          {x.evidence.messages.map((m) => (
            <li key={m.id} className="list__item list__item--compact" style={m.id === x.evidence?.reported ? { outline: '2px solid var(--danger)' } : undefined}>
              <bdi style={{ fontWeight: 700 }}>{m.sender}</bdi>: <span style={{ whiteSpace: 'pre-wrap' }}>{m.deleted ? '(حذف‌شده) ' : ''}{m.body}</span>
            </li>))}
        </ol>
      )}
      {x.evidence?.game && <p style={{ margin: 0 }}>میز {x.evidence.game}؛ بازیکنان: {x.evidence.players?.map((p) => p.name).join('، ')}</p>}
      {x.evidence?.displayName !== undefined && <p style={{ margin: 0 }}>نام نمایشی فعلی: <bdi>{x.evidence.displayName}</bdi></p>}
      <p className="muted" style={{ margin: 0 }}>
        نشانه‌های ۳۰ روز اخیر: {Object.keys(x.signals).length ? Object.entries(x.signals).map(([k, n]) => `${SIGNAL_FA[k] ?? k} ${faNum(n)}`).join('، ') : 'ندارد'} (فقط برای اطلاع؛ جریمه خودکار ندارد)
      </p>
      {x.priorSanctions.length > 0 && <p className="muted" style={{ margin: 0 }}>سابقه: {x.priorSanctions.map((s) => `${SANCTION_FA[s.kind]}${s.active ? ' (فعال)' : ''}`).join('، ')}</p>}
      {x.report.status === 'open' && (
        <div className="stack" style={{ gap: 'var(--sp-2)' }}>
          <Segmented legend="تصمیم" name="decision" value={decision} onChange={setDecision} options={[
            { value: 'dismiss', label: 'رد گزارش' }, { value: 'warning', label: 'اخطار' }, { value: 'chat_restricted', label: 'محدودیت گفت‌وگو' }, { value: 'suspended', label: 'تعلیق' }]} />
          {(decision === 'chat_restricted' || decision === 'suspended') && (
            <Select label="مدت" value={hours} onChange={(e) => setHours(e.target.value)} options={[['1', '۱ ساعت'], ['24', '۱ روز'], ['168', '۱ هفته'], ['720', '۳۰ روز']].map(([v, l]) => ({ value: v!, label: l! }))} />
          )}
          <Input label="یادداشت تصمیم (در سابقه ثبت می‌شود)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div><Button variant={decision === 'dismiss' ? 'secondary' : 'danger'} disabled={note.trim().length < 3} onClick={submit}>ثبت تصمیم</Button></div>
        </div>
      )}
    </section>
  );
}

function Queue() {
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed'>('open');
  const q = useApi<{ items: QueueItem[] }>(`/mod/reports?status=${status}`);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="stack">
      <Segmented legend="وضعیت" name="status" value={status} onChange={(v) => { setStatus(v); setOpen(null); }} options={[{ value: 'open', label: 'باز' }, { value: 'resolved', label: 'رسیدگی‌شده' }, { value: 'dismissed', label: 'ردشده' }]} />
      {q.error && <StateBlock kind="error" title="صف دریافت نشد">{q.error.messageFa}</StateBlock>}
      {q.data && (q.data.items.length === 0 ? <StateBlock kind="empty" title="گزارشی در این وضعیت نیست" /> : (
        <DataTable caption="گزارش‌ها" rowKey={(r) => r.id} rows={q.data.items} columns={[
          { key: 'type', title: 'نوع', render: (r) => TARGET_FA[r.targetType] },
          { key: 'subject', title: 'موضوع', render: (r) => r.subject ? <bdi>{r.subject.displayName}</bdi> : '-' },
          { key: 'reason', title: 'توضیح', render: (r) => r.reason.slice(0, 60) },
          { key: 'date', title: 'تاریخ', render: (r) => jalaliDate(r.createdAt) },
          { key: 'act', title: 'اقدام', render: (r) => <Button size="sm" variant="secondary" onClick={() => setOpen(r.id)}>بررسی</Button> }
        ]} />
      ))}
      {open && <ReportReview key={open} id={open} onDone={() => { setOpen(null); q.reload(); }} />}
    </div>
  );
}

function Appeals() {
  const a = useApi<{ items: { id: string; text: string; createdAt: string; user: { displayName: string }; sanction: { kind: keyof typeof SANCTION_FA; reason: string } }[] }>('/mod/appeals');
  const toast = useToast();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const decide = async (id: string, decision: 'upheld' | 'revoked') => {
    try { await api(`/mod/appeals/${id}/decide`, { method: 'POST', body: { decision, note: notes[id] ?? '' } }); toast('success', 'تصمیم ثبت شد.'); a.reload(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ثبت نشد.'); }
  };
  if (a.error) return <StateBlock kind="error" title="اعتراض‌ها دریافت نشد">{a.error.messageFa}</StateBlock>;
  if (!a.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  if (!a.data.items.length) return <StateBlock kind="empty" title="اعتراض بازی نیست" />;
  return (
    <ul className="list">{a.data.items.map((x) => (
      <li key={x.id} className="panel stack">
        <div className="row"><Badge tone="danger">{SANCTION_FA[x.sanction.kind]}</Badge><bdi style={{ fontWeight: 700 }}>{x.user.displayName}</bdi><span className="muted">{jalaliDate(x.createdAt)}</span></div>
        <p style={{ margin: 0 }}>علت محدودیت: {x.sanction.reason}</p>
        <p style={{ margin: 0 }}>اعتراض: {x.text}</p>
        <Input label="یادداشت تصمیم" value={notes[x.id] ?? ''} onChange={(e) => setNotes({ ...notes, [x.id]: e.target.value })} />
        <div className="row">
          <Button disabled={(notes[x.id] ?? '').trim().length < 3} onClick={() => decide(x.id, 'revoked')}>پذیرش اعتراض و لغو محدودیت</Button>
          <Button variant="secondary" disabled={(notes[x.id] ?? '').trim().length < 3} onClick={() => decide(x.id, 'upheld')}>رد اعتراض</Button>
        </div>
      </li>))}</ul>
  );
}

function Audit() {
  const [targetType, setTargetType] = useState('');
  const [action, setAction] = useState('');
  const qs = new URLSearchParams({ ...(targetType ? { targetType } : {}), ...(action.trim() ? { action: action.trim() } : {}) }).toString();
  const a = useApi<{ items: { action: string; targetType: string; actorName: string; createdAt: string }[] }>(`/mod/audit${qs ? `?${qs}` : ''}`);
  const filters = (
    <div className="row" style={{ alignItems: 'end' }}>
      <div style={{ minInlineSize: 180 }}><Select label="نوع هدف" value={targetType} onChange={(e) => setTargetType(e.target.value)}
        options={[['', 'همه'], ['report', 'گزارش'], ['appeal', 'اعتراض'], ['message', 'پیام'], ['club', 'باشگاه'], ['game', 'بازی'], ['game_version', 'نسخه'], ['season', 'فصل'], ['plan', 'پلن'], ['mission', 'مأموریت'], ['user', 'کاربر'], ['payment', 'پرداخت'], ['incident', 'توقف سراسری']].map(([v, l]) => ({ value: v!, label: l! }))} /></div>
      <div style={{ minInlineSize: 180 }}><Input label="عملیات (پیشوند)" dir="ltr" className="input--ltr" value={action} onChange={(e) => setAction(e.target.value)} hint="مثلاً report. یا season." /></div>
    </div>
  );
  if (!a.data) return <>{filters}<StateBlock kind={a.error ? 'error' : 'loading'} title={a.error ? 'سابقه دریافت نشد' : 'در حال بارگذاری…'} /></>;
  if (!a.data.items.length) return <>{filters}<StateBlock kind="empty" title="رکوردی با این فیلتر نیست" /></>;
  return <>{filters}<DataTable caption="سابقه عملیات" rowKey={(r) => r.createdAt + r.action} rows={a.data.items} columns={[
    { key: 'when', title: 'زمان', render: (r) => jalaliDate(r.createdAt) },
    { key: 'who', title: 'انجام‌دهنده', render: (r) => <bdi>{r.actorName}</bdi> },
    { key: 'what', title: 'عملیات', render: (r) => <bdi dir="ltr">{r.action}</bdi> }
  ]} /></>;
}

export function ModerationPage() {
  usePageTitle('نظارت');
  const { me, status } = useSession();
  if (status === 'loading') return <StateBlock kind="loading" title="در حال بررسی دسترسی…" />;
  if (!me?.roles.some((r) => r === 'moderator' || r === 'admin')) return <StateBlock kind="denied" title="دسترسی ندارید">این بخش فقط برای ناظران است.</StateBlock>;
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">نظارت</h1><p className="page-sub">ناظر فقط داده همان گزارش را می‌بیند؛ هر مشاهده و تصمیم در سابقه ثبت می‌شود.</p></div></div>
      <Tabs label="نظارت" tabs={[
        { id: 'reports', title: 'گزارش‌ها', content: <Queue /> },
        { id: 'appeals', title: 'اعتراض‌ها', content: <Appeals /> },
        { id: 'audit', title: 'سابقه', content: <Audit /> }
      ]} />
    </>
  );
}
