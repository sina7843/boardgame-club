import { useState } from 'react';
import { Badge, Button, Card, DataTable, Icon, Message, PageHead, PageTabs, Segmented, Select, StateBlock, Tabs, Textarea, TextField } from '@bg/ui/bgv';
import { ADMIN_TABS } from './adminTabs.ts';
import { useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum, jalaliDate, jalaliDateTime } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { SANCTION_FA } from './Support.tsx';

interface QueueItem { id: string; targetType: string; reasonCode: string; reason: string; createdAt: string; subject: { id: string; displayName: string } | null }
interface Detail {
  report: { id: string; targetType: string; reasonCode: string; reason: string; evidenceRef: string | null; status: string };
  reporter: { displayName: string }; subject: { id: string; displayName: string } | null;
  evidence: { reported?: string; messages?: { id: string; sender: string; body: string; createdAt: string; deleted: boolean }[]; game?: string; players?: { seat: number; name: string }[]; result?: unknown; displayName?: string; bio?: string } | null;
  signals: Record<string, number>; priorSanctions: { id: string; kind: keyof typeof SANCTION_FA; reason: string; active: boolean }[];
}
const TARGET_FA: Record<string, string> = { user: 'رفتار کاربر', display_name: 'نام نمایشی', bio: 'متن معرفی', message: 'پیام', table: 'میز' };
const TARGET_ICON: Record<string, string> = { user: 'door-open', display_name: 'user', bio: 'pencil', message: 'message-circle', table: 'layout-grid' };
const SIGNAL_FA: Record<string, string> = { timeout_loss: 'باخت با اتمام زمان', resigned: 'انصراف', ready_no_show: 'عدم پذیرش حریف‌یابی' };
const Loading = () => <StateBlock kind="loading" title="در حال بارگذاری…" />;

function ReportReview({ id, onDone, onClose }: { id: string; onDone: () => void; onClose: () => void }) {
  const d = useApi<Detail>(`/mod/reports/${id}`);
  const toast = useToast();
  const [decision, setDecision] = useState<'dismiss' | 'warning' | 'chat_restricted' | 'suspended'>('dismiss');
  const [hours, setHours] = useState('24');
  const [shown, setShown] = useState(false);
  const [note, setNote] = useState('');
  if (d.error) return <StateBlock kind="error" title="گزارش دریافت نشد" text={d.error.messageFa} />;
  if (!d.data) return <Loading />;
  const x = d.data;
  const clearBio = async (userId: string) => {
    try { await api(`/mod/users/${userId}/clear-bio`, { method: 'POST', body: { reason: `گزارش ${x.report.id}: ${x.report.reason}`.slice(0, 300) } }); toast('success', 'معرفی پاک شد.'); d.reload(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
  };
  const submit = async () => {
    try {
      await api(`/mod/reports/${id}/resolve`, { method: 'POST', body: { decision, note, ...(decision === 'chat_restricted' || decision === 'suspended' ? { durationHours: Number(hours) } : {}) } });
      toast('success', 'تصمیم ثبت شد.');
      onDone();
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ثبت نشد.'); }
  };
  return (
    <Card title="بررسی گزارش" aria-label="بررسی گزارش" className="sx-stack-sm" actions={<Button iconOnly variant="ghost" size="sm" icon="x" onClick={onClose}>بستن بررسی</Button>}>
      <div className="bgv-row"><Badge>{TARGET_FA[x.report.targetType]}</Badge><b className="t-title">{x.report.reason}</b></div>
      <div className="sx-facts">
        <div className="sx-fact"><span>گزارش‌دهنده</span><b><bdi>{x.reporter.displayName}</bdi></b></div>
        {x.subject && <div className="sx-fact"><span>موضوع</span><b><a href={`/users/${x.subject.id}`}><bdi>{x.subject.displayName}</bdi></a></b></div>}
        {x.report.evidenceRef && <div className="sx-fact"><span>شاهد</span><b>{x.report.evidenceRef}</b></div>}
      </div>
      {x.evidence?.messages && (
        <ol className="sx-ev" aria-label="پیام گزارش‌شده و پیام‌های پیرامون آن">
          {x.evidence.messages.map((m) => {
            const hit = m.id === x.evidence?.reported;
            // The reported text stays hidden until the moderator chooses to read it (it may be abusive).
            const hidden = hit && !shown;
            return (
              <li key={m.id} className={hit ? 'sx-ev__hit' : undefined}>
                <Message author={<bdi>{m.sender}</bdi>} initials={m.sender.charAt(0)} state={m.deleted ? 'deleted' : 'sent'}
                  time={<time dateTime={m.createdAt}>{jalaliDateTime(m.createdAt)}</time>}
                  text={hidden ? 'متن پیام گزارش‌شده پنهان است.' : m.body} />
                {hit && <div className="bgv-row" style={{ gap: 8 }}><Badge tone="danger" size="sm" icon="flag">گزارش‌شده</Badge>
                  {!shown && <Button size="sm" variant="ghost" icon="eye" onClick={() => setShown(true)}>نمایش متن</Button>}</div>}
              </li>
            );
          })}
        </ol>
      )}
      {x.evidence?.game && <p className="t-body-sm" style={{ margin: 0 }}>میز {x.evidence.game}؛ بازیکنان: {x.evidence.players?.map((p) => p.name).join('، ')}</p>}
      {x.evidence?.displayName !== undefined && <p className="t-body-sm" style={{ margin: 0 }}>نام نمایشی فعلی: <bdi>{x.evidence.displayName}</bdi></p>}
      {x.evidence?.bio !== undefined && (
        <div className="bgv-row">
          <p dir="auto" className="t-body-sm" style={{ flex: 1, margin: 0 }}>معرفی فعلی: {x.evidence.bio || '(خالی)'}</p>
          {x.evidence.bio && x.subject && <Button size="sm" variant="danger" icon="trash-2" onClick={() => clearBio(x.subject!.id)}>پاک کردن معرفی</Button>}
        </div>
      )}
      <p className="sx-cap">
        نشانه‌های ۳۰ روز اخیر: {Object.keys(x.signals).length ? Object.entries(x.signals).map(([k, n]) => `${SIGNAL_FA[k] ?? k} ${faNum(n)}`).join('، ') : 'ندارد'} (فقط برای اطلاع؛ جریمه خودکار ندارد)
      </p>
      {x.priorSanctions.length > 0 && <p className="sx-cap">سابقه: {x.priorSanctions.map((s) => `${SANCTION_FA[s.kind]}${s.active ? ' (فعال)' : ''}`).join('، ')}</p>}
      {x.report.status === 'open' && (
        <div className="sx-stack-sm">
          <div className="bgv-field"><span className="bgv-label">تصمیم</span>
            <Segmented block label="تصمیم" value={decision} onChange={(v) => setDecision(v as typeof decision)} options={[
              { value: 'dismiss', label: 'رد گزارش' }, { value: 'warning', label: 'اخطار' }, { value: 'chat_restricted', label: 'محدودیت گفت‌وگو' }, { value: 'suspended', label: 'تعلیق' }]} />
          </div>
          {(decision === 'chat_restricted' || decision === 'suspended') && (
            <Select label="مدت" value={hours} onChange={(e) => setHours(e.target.value)} options={[['1', '۱ ساعت'], ['24', '۱ روز'], ['168', '۱ هفته'], ['720', '۳۰ روز']].map(([v, l]) => ({ value: v!, label: l! }))} />
          )}
          <Textarea label="یادداشت تصمیم (در سابقه ثبت می‌شود)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <div><Button variant={decision === 'dismiss' ? 'secondary' : 'danger'} icon="check" disabled={note.trim().length < 3} onClick={submit}>ثبت تصمیم</Button></div>
        </div>
      )}
    </Card>
  );
}

function Queue() {
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed'>('open');
  const q = useApi<{ items: QueueItem[] }>(`/mod/reports?status=${status}`);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="sx-mod">
      <Card flush className="sx-tablecard" aria-label="صف گزارش‌ها">
        <div className="bgv-row" style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <Segmented label="وضعیت" value={status} onChange={(v) => { setStatus(v as typeof status); setOpen(null); }} options={[{ value: 'open', label: 'باز' }, { value: 'resolved', label: 'رسیدگی‌شده' }, { value: 'dismissed', label: 'ردشده' }]} />
          <span className="bgv-spacer" />
          {q.data && <span className="sx-cap">{faNum(q.data.items.length)} گزارش {status === 'open' ? 'باز' : status === 'resolved' ? 'رسیدگی‌شده' : 'ردشده'}، قدیمی‌ترین پایین</span>}
        </div>
        {q.error && <StateBlock kind="error" title="صف دریافت نشد" text={q.error.messageFa} />}
        {!q.data && !q.error && <Loading />}
        {q.data && (q.data.items.length === 0 ? <StateBlock kind="empty" title="گزارشی در این وضعیت نیست" /> : (
          <div className="bgv-scroll-x">
            <DataTable caption="گزارش‌ها" rows={q.data.items} selectedRow={q.data.items.findIndex((r) => r.id === open)} columns={[
              { key: 'type', label: 'نوع', render: (r) => <span className="bgv-row sx-modtype"><Icon name={TARGET_ICON[r.targetType] ?? 'flag'} size="sm" />{TARGET_FA[r.targetType]}</span> },
              { key: 'subject', label: 'موضوع', render: (r) => r.subject ? <bdi>{r.subject.displayName}</bdi> : '-' },
              { key: 'reason', label: 'توضیح', render: (r) => r.reason.slice(0, 60) },
              { key: 'date', label: 'تاریخ', render: (r) => jalaliDate(r.createdAt) },
              { key: 'act', label: 'اقدام', render: (r) => <Button size="sm" variant={r.id === open ? 'primary' : 'secondary'} onClick={() => setOpen(r.id)}>بررسی</Button> }
            ]} />
          </div>
        ))}
      </Card>
      {open && <ReportReview key={open} id={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); q.reload(); }} />}
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
  if (a.error) return <StateBlock kind="error" title="اعتراض‌ها دریافت نشد" text={a.error.messageFa} />;
  if (!a.data) return <Loading />;
  if (!a.data.items.length) return <StateBlock kind="empty" title="اعتراض بازی نیست" />;
  return (
    <ul className="bgv-grid" style={{ listStyle: 'none', margin: 0, padding: 0 }}>{a.data.items.map((x) => (
      <li key={x.id}>
        <Card className="sx-stack-sm">
          <div className="bgv-row"><Badge tone="danger" icon="ban">{SANCTION_FA[x.sanction.kind]}</Badge><b><bdi>{x.user.displayName}</bdi></b><span className="sx-cap">{jalaliDate(x.createdAt)}</span></div>
          <p className="t-body-sm" style={{ margin: 0 }}>علت محدودیت: {x.sanction.reason}</p>
          <p className="t-body-sm" style={{ margin: 0 }}>اعتراض: {x.text}</p>
          <Textarea rows={2} label="یادداشت تصمیم" value={notes[x.id] ?? ''} onChange={(e) => setNotes({ ...notes, [x.id]: e.target.value })} />
          <div className="bgv-row">
            <Button variant="primary" disabled={(notes[x.id] ?? '').trim().length < 3} onClick={() => decide(x.id, 'revoked')}>پذیرش اعتراض و لغو محدودیت</Button>
            <Button variant="secondary" disabled={(notes[x.id] ?? '').trim().length < 3} onClick={() => decide(x.id, 'upheld')}>رد اعتراض</Button>
          </div>
        </Card>
      </li>))}</ul>
  );
}

function Audit() {
  const [targetType, setTargetType] = useState('');
  const [action, setAction] = useState('');
  const qs = new URLSearchParams({ ...(targetType ? { targetType } : {}), ...(action.trim() ? { action: action.trim() } : {}) }).toString();
  const a = useApi<{ items: { action: string; targetType: string; actorName: string; createdAt: string }[] }>(`/mod/audit${qs ? `?${qs}` : ''}`);
  const filters = (
    <div className="sx-field-row">
      <Select label="نوع هدف" value={targetType} onChange={(e) => setTargetType(e.target.value)}
        options={[['', 'همه'], ['report', 'گزارش'], ['appeal', 'اعتراض'], ['message', 'پیام'], ['club', 'باشگاه'], ['game', 'بازی'], ['game_version', 'نسخه'], ['season', 'فصل'], ['plan', 'پلن'], ['mission', 'مأموریت'], ['user', 'کاربر'], ['payment', 'پرداخت'], ['incident', 'توقف سراسری']].map(([v, l]) => ({ value: v!, label: l! }))} />
      <TextField label="عملیات (پیشوند)" dir="ltr" value={action} onChange={(e) => setAction(e.target.value)} hint="مثلاً report. یا season." />
    </div>
  );
  if (!a.data) return <div className="sx-stack">{filters}<StateBlock kind={a.error ? 'error' : 'loading'} title={a.error ? 'سابقه دریافت نشد' : 'در حال بارگذاری…'} /></div>;
  if (!a.data.items.length) return <div className="sx-stack">{filters}<StateBlock kind="empty" title="رکوردی با این فیلتر نیست" /></div>;
  return (
    <div className="sx-stack">{filters}
      <Card flush className="sx-tablecard">
        <div className="bgv-scroll-x">
          <DataTable caption="سابقه عملیات" rows={a.data.items} columns={[
            { key: 'when', label: 'زمان', render: (r) => jalaliDate(r.createdAt) },
            { key: 'who', label: 'انجام‌دهنده', render: (r) => <bdi>{r.actorName}</bdi> },
            { key: 'what', label: 'عملیات', render: (r) => <bdi dir="ltr">{r.action}</bdi> }
          ]} />
        </div>
      </Card>
    </div>
  );
}

export function ModerationPage() {
  usePageTitle('نظارت');
  const { me, status } = useSession();
  const [tab, setTab] = useState('reports');
  const admin = !!me?.roles.includes('admin');
  const reports = useApi<{ items: QueueItem[] }>(me ? '/mod/reports?status=open' : null);
  const appeals = useApi<{ items: unknown[] }>(me ? '/mod/appeals' : null);
  if (status === 'loading') return <StateBlock kind="loading" title="در حال بررسی دسترسی…" />;
  if (!me?.roles.some((r) => r === 'moderator' || r === 'admin')) return <StateBlock kind="denied" title="دسترسی ندارید" text="این بخش فقط برای ناظران است." />;
  return (
    <>
      {admin && <PageTabs label="بخش‌های مدیریت" value="mod" items={[{ value: 'mod', label: 'نظارت', href: '/mod' }, ...ADMIN_TABS.map((t) => ({ ...t, href: `/admin?tab=${t.value}` }))]} />}
      <PageHead title="نظارت" sub="ناظر فقط دادهٔ همان گزارش را می‌بیند؛ هر مشاهده و تصمیم در سابقه ثبت می‌شود."
        actions={<Badge icon="shield">نقش شما: {admin ? 'مدیر' : 'ناظر'}</Badge>} />
      <Tabs label="نظارت" value={tab} onChange={setTab} items={[{ value: 'reports', label: 'گزارش‌ها', count: reports.data?.items.length ?? 0 }, { value: 'appeals', label: 'اعتراض‌ها', count: appeals.data?.items.length ?? 0 }, { value: 'audit', label: 'سابقه' }]} />
      {tab === 'reports' ? <Queue /> : tab === 'appeals' ? <Appeals /> : <Audit />}
    </>
  );
}
