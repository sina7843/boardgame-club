import { useState } from 'react';
import { Badge, Button, Card, Icon, PageHead, StateBlock, Textarea } from '@bg/ui/bgv';
import { useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { jalaliDate } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

interface Sanction { id: string; kind: 'suspended' | 'chat_restricted' | 'warning'; reason: string; startsAt: string; endsAt: string | null; active: boolean; appeal: { status: string; decisionNote: string | null } | null }
interface Report { id: string; targetType: string; reasonCode: string; reason: string; status: 'open' | 'resolved' | 'dismissed'; resolution: string | null; createdAt: string }

export const SANCTION_FA = { suspended: 'تعلیق حساب', chat_restricted: 'محدودیت گفت‌وگو', warning: 'اخطار' } as const;
const REPORT_STATUS = { open: { label: 'در حال بررسی', tone: 'warning', icon: 'hourglass' }, resolved: { label: 'رسیدگی شد', tone: 'success', icon: 'circle-check' }, dismissed: { label: 'رد شد', tone: 'neutral', icon: 'x' } } as const;
const APPEAL_FA: Record<string, string> = { open: 'اعتراض در حال بررسی', upheld: 'اعتراض رد شد', revoked: 'اعتراض پذیرفته و محدودیت لغو شد' };
const TIPS: [string, string][] = [
  ['flag', 'برای گزارش رفتار یا نام نامناسب، از صفحه پروفایل بازیکن «گزارش» را بزنید؛ برای پیام، کنار همان پیام.'],
  ['wifi-off', 'قطع اینترنت شما زمان نوبت را متوقف نمی‌کند؛ توقف سراسری سرویس جبران زمانی دارد.'],
  ['ban', 'مسدودکردن یک کاربر هر تماس تازه، دعوت و پیام را از هر دو طرف می‌بندد.'],
  ['shield', 'تصمیم‌های ناظر قابل اعتراض است؛ اعتراض را ناظر دیگری بررسی می‌کند.']
];

function AppealForm({ sanctionId, onDone }: { sanctionId: string; onDone: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const submit = async () => {
    try { await api('/appeals', { method: 'POST', body: { sanctionId, text } }); toast('success', 'اعتراض ثبت شد.'); onDone(); }
    catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'ثبت نشد.'); }
  };
  return (
    <div className="sx-stack-sm">
      <Textarea label="متن اعتراض" rows={3} value={text} onChange={(e) => setText(e.target.value)} hint="حداقل ۱۰ نویسه؛ توضیح دهید چرا این تصمیم باید بازبینی شود." error={error} />
      <div><Button variant="primary" icon="send" disabled={text.trim().length < 10} onClick={submit}>ثبت اعتراض</Button></div>
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
      <PageHead title="پشتیبانی" sub="راهنما، گزارش‌های شما، محدودیت‌های حساب و اعتراض." />
      <div className="bgv-cols">
        <div className="sx-stack">
          {!me ? <StateBlock kind="denied" title="برای دیدن گزارش‌ها و محدودیت‌ها وارد شوید" action={<Button variant="primary" href="/login?next=/support">ورود</Button>} /> : (
            <>
              <Card title="محدودیت‌های حساب">
                {sanctions.error && <StateBlock kind="error" title="محدودیت‌ها دریافت نشد" text={sanctions.error.messageFa} action={<Button onClick={sanctions.reload}>تلاش دوباره</Button>} />}
                {!sanctions.data && !sanctions.error && <StateBlock kind="loading" title="در حال بارگذاری…" />}
                {sanctions.data && (sanctions.data.items.length === 0 ? <p className="bgv-muted" style={{ margin: 0 }}>محدودیتی روی حساب شما نیست.</p> : (
                  <ul className="sx-rows">{sanctions.data.items.map((s) => (
                    <li key={s.id} style={{ display: 'grid', gap: 'var(--space-2)' }}>
                      <div className="bgv-row">
                        <Badge tone={s.active ? 'danger' : 'neutral'} icon={s.kind === 'warning' ? 'triangle-alert' : 'ban'}>{SANCTION_FA[s.kind]}</Badge>
                        <span className="sx-cap">از {jalaliDate(s.startsAt)}{s.endsAt ? ` تا ${jalaliDate(s.endsAt)}` : ' (بدون تاریخ پایان)'}</span>
                        {!s.active && <Badge size="sm">غیرفعال</Badge>}
                      </div>
                      <p className="t-body-sm" style={{ margin: 0 }}><b>علت:</b> {s.reason}</p>
                      {s.appeal ? <p className="sx-cap">{APPEAL_FA[s.appeal.status]}{s.appeal.decisionNote ? `: ${s.appeal.decisionNote}` : ''}</p>
                        : s.active && <AppealForm sanctionId={s.id} onDone={sanctions.reload} />}
                    </li>))}</ul>
                ))}
              </Card>
              <Card title="گزارش‌های من">
                {reports.error && <StateBlock kind="error" title="گزارش‌ها دریافت نشد" text={reports.error.messageFa} action={<Button onClick={reports.reload}>تلاش دوباره</Button>} />}
                {!reports.data && !reports.error && <StateBlock kind="loading" title="در حال بارگذاری…" />}
                {reports.data && (reports.data.items.length === 0 ? <p className="bgv-muted" style={{ margin: 0 }}>گزارشی ثبت نکرده‌اید.</p> : (
                  <ul className="sx-rows">{reports.data.items.map((r) => (
                    <li key={r.id}>
                      <div className="sx-rows__main"><b>{r.reason}</b><span>{jalaliDate(r.createdAt)}</span></div>
                      <Badge tone={REPORT_STATUS[r.status].tone} icon={REPORT_STATUS[r.status].icon}>{REPORT_STATUS[r.status].label}</Badge>
                    </li>))}</ul>
                ))}
              </Card>
            </>
          )}
        </div>
        <Card title="راهنمای سریع">
          <ul className="sx-rows sx-tips">
            {TIPS.map(([icon, text]) => (
              <li key={icon}><span className="sx-tile"><Icon name={icon} /></span><span className="t-body-sm" style={{ flex: 1, minInlineSize: 0 }}>{text}</span></li>
            ))}
          </ul>
          <div className="bgv-row" style={{ marginBlockStart: 'var(--space-3)' }}><Button variant="secondary" icon="book-open" href="/guides">راهنمای بازی‌ها</Button></div>
        </Card>
      </div>
    </>
  );
}
