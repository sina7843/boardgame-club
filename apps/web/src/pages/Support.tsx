import { useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button, Input, StateBlock, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { jalaliDate } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

interface Sanction { id: string; kind: 'suspended' | 'chat_restricted' | 'warning'; reason: string; startsAt: string; endsAt: string | null; active: boolean; appeal: { status: string; decisionNote: string | null } | null }
interface Report { id: string; targetType: string; reasonCode: string; reason: string; status: 'open' | 'resolved' | 'dismissed'; resolution: string | null; createdAt: string }

export const SANCTION_FA = { suspended: 'تعلیق حساب', chat_restricted: 'محدودیت گفت‌وگو', warning: 'اخطار' } as const;
const REPORT_STATUS_FA = { open: 'در حال بررسی', resolved: 'رسیدگی شد', dismissed: 'رد شد' } as const;
const APPEAL_FA: Record<string, string> = { open: 'اعتراض در حال بررسی', upheld: 'اعتراض رد شد', revoked: 'اعتراض پذیرفته و محدودیت لغو شد' };

function AppealForm({ sanctionId, onDone }: { sanctionId: string; onDone: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const submit = async () => {
    try { await api('/appeals', { method: 'POST', body: { sanctionId, text } }); toast('success', 'اعتراض ثبت شد.'); onDone(); }
    catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'ثبت نشد.'); }
  };
  return (
    <div className="stack" style={{ gap: 'var(--sp-2)' }}>
      <Input label="متن اعتراض" value={text} onChange={(e) => setText(e.target.value)} hint="حداقل ۱۰ نویسه؛ توضیح دهید چرا این تصمیم باید بازبینی شود." error={error} />
      <div><Button size="sm" disabled={text.trim().length < 10} onClick={submit}>ثبت اعتراض</Button></div>
    </div>
  );
}

export function SupportPage() {
  usePageTitle('پشتیبانی');
  const { me } = useSession();
  const sanctions = useApi<{ items: Sanction[] }>(me ? '/me/sanctions' : null);
  const reports = useApi<{ items: Report[] }>(me ? '/me/reports' : null);
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">پشتیبانی</h1><p className="page-sub">راهنما، گزارش‌های شما، محدودیت‌های حساب و اعتراض.</p></div></div>
      <div className="stack" style={{ maxInlineSize: 760 }}>
        <section className="panel stack" aria-labelledby="help-h">
          <h2 id="help-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}>راهنمای سریع</h2>
          <ul style={{ margin: 0, paddingInlineStart: 'var(--sp-5)' }}>
            <li>برای گزارش رفتار یا نام نامناسب، از صفحه پروفایل بازیکن «گزارش» را بزنید؛ برای پیام، کنار همان پیام.</li>
            <li>قطع اینترنت شما زمان نوبت را متوقف نمی‌کند؛ توقف سراسری سرویس جبران زمانی دارد.</li>
            <li>مسدودکردن یک کاربر هر تماس تازه، دعوت و پیام را از هر دو طرف می‌بندد.</li>
            <li>تصمیم‌های ناظر قابل اعتراض است؛ اعتراض را ناظر دیگری بررسی می‌کند.</li>
          </ul>
        </section>
        {!me ? <StateBlock kind="denied" title="برای دیدن گزارش‌ها و محدودیت‌ها وارد شوید" action={<Link className="btn btn--primary" to="/login?next=/support">ورود</Link>} /> : (
          <>
            <section className="panel stack" aria-labelledby="sanctions-h">
              <h2 id="sanctions-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}>محدودیت‌های حساب</h2>
              {sanctions.error && <p className="field__error">{sanctions.error.messageFa}</p>}
              {sanctions.data && (sanctions.data.items.length === 0 ? <p className="muted" style={{ margin: 0 }}>محدودیتی روی حساب شما نیست.</p> : (
                <ul className="list">{sanctions.data.items.map((s) => (
                  <li key={s.id} className="list__item list__item--compact" style={{ display: 'grid' }}>
                    <div className="row">
                      <Badge tone={s.active ? 'danger' : undefined}>{SANCTION_FA[s.kind]}</Badge>
                      <span className="muted">از {jalaliDate(s.startsAt)}{s.endsAt ? ` تا ${jalaliDate(s.endsAt)}` : ' (بدون تاریخ پایان)'}</span>
                      {!s.active && <Badge>غیرفعال</Badge>}
                    </div>
                    <p style={{ margin: 0 }}>علت: {s.reason}</p>
                    {s.appeal ? <p className="muted" style={{ margin: 0 }}>{APPEAL_FA[s.appeal.status]}{s.appeal.decisionNote ? ` — ${s.appeal.decisionNote}` : ''}</p>
                      : s.active && <AppealForm sanctionId={s.id} onDone={sanctions.reload} />}
                  </li>))}</ul>
              ))}
            </section>
            <section className="panel stack" aria-labelledby="reports-h">
              <h2 id="reports-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}>گزارش‌های من</h2>
              {reports.data && (reports.data.items.length === 0 ? <p className="muted" style={{ margin: 0 }}>گزارشی ثبت نکرده‌اید.</p> : (
                <ul className="list">{reports.data.items.map((r) => (
                  <li key={r.id} className="list__item list__item--compact">
                    <span style={{ flex: 1 }}>{r.reason} <span className="muted">({jalaliDate(r.createdAt)})</span></span>
                    <Badge tone={r.status === 'resolved' ? 'success' : undefined}>{REPORT_STATUS_FA[r.status]}</Badge>
                  </li>))}</ul>
              ))}
            </section>
          </>
        )}
      </div>
    </>
  );
}
