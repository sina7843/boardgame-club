import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { SubscriptionStatus } from '@bg/contracts';
import { Badge, Button, DataTable, StateBlock, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum, jalaliDate } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

interface Plans { items: { id: string; titleFa: string; period: string; durationDays: number; priceAmount: number | null; currency: string; termsFa: string; purchasable: boolean; unavailableReasonFa: string | null }[];
  checkout: { available: boolean; reasonFa: string | null; fixture: boolean } }
const money = (amount: number, currency: string) => `${faNum(amount)} ${currency === 'IRR' ? 'ریال' : currency}`;
export const PAYMENT_STATUS_FA = { pending: 'در انتظار تأیید', verified: 'تأییدشده', failed: 'ناموفق', expired: 'منقضی' } as const;
export const FAILURE_FA: Record<string, string> = {
  DECLINED_BY_PAYER: 'پرداخت در درگاه لغو یا رد شد.', AMOUNT_MISMATCH: 'مبلغ پرداخت‌شده با سفارش یکسان نبود؛ اشتراک فعال نشد.',
  DUPLICATE_REFERENCE: 'شناسه پرداخت تکراری بود؛ اشتراک فعال نشد.', PROVIDER_ERROR: 'ارتباط با درگاه برقرار نشد.',
  NOT_CONFIRMED_IN_TIME: 'تأیید پرداخت در زمان مقرر نرسید.', UNKNOWN_AUTHORITY: 'درگاه این پرداخت را نشناخت.'
};

export function PlansPage() {
  usePageTitle('اشتراک');
  const { me } = useSession();
  const toast = useToast();
  const plans = useApi<Plans>('/plans');
  const status = useApi<SubscriptionStatus>(me ? '/me/subscription' : null);
  const [busy, setBusy] = useState<string>();
  const buy = async (planId: string) => {
    setBusy(planId);
    try { location.assign((await api<{ redirectUrl: string }>('/subscriptions/checkout', { method: 'POST', body: { planId } })).redirectUrl); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'شروع پرداخت ممکن نشد.'); setBusy(undefined); }
  };
  if (plans.error) return <StateBlock kind="error" title="پلن‌ها دریافت نشد" action={<Button onClick={plans.reload}>تلاش دوباره</Button>} />;
  if (!plans.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const s = status.data;
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">اشتراک پریمیوم</h1><p className="page-sub">پریمیوم امتیاز مهارتی، اولویت صف یا کمک حین بازی نمی‌دهد. تمدید خودکار ندارد.</p></div></div>
      {plans.data.checkout.fixture && <div className="banner banner--warn" role="note">حالت توسعه: درگاه پرداخت آزمایشی است و پول واقعی جابه‌جا نمی‌شود.</div>}
      {!plans.data.checkout.available && <div className="banner banner--info" role="status">{plans.data.checkout.reasonFa}</div>}
      <div className="stack" style={{ maxInlineSize: 900 }}>
        {me && s && (
          <section className="panel stack" aria-labelledby="mine-h">
            <h2 id="mine-h" className="section-title">وضعیت من</h2>
            {s.premium ? <p style={{ margin: 0 }}><Badge tone="premium">پریمیوم فعال</Badge> {s.premiumUntil ? `تا ${jalaliDate(s.premiumUntil)}` : ''}؛ پس از پایان، بازی‌های در جریان قطع نمی‌شوند.</p>
              : <p className="muted" style={{ margin: 0 }}>اشتراک فعالی ندارید.</p>}
          </section>
        )}
        <div className="grid-cards">
          {plans.data.items.map((p) => (
            <section key={p.id} className="panel stack" aria-labelledby={`plan-${p.id}`}>
              <h2 id={`plan-${p.id}`} className="section-title">{p.titleFa}</h2>
              <strong style={{ fontSize: 'var(--fs-xl)' }}>{p.priceAmount ? money(p.priceAmount, p.currency) : 'قیمت تعیین نشده'}</strong>
              <span className="muted">{faNum(p.durationDays)} روز</span>
              <p style={{ margin: 0 }}>{p.termsFa}</p>
              <ul style={{ margin: 0, paddingInlineStart: 'var(--sp-5)' }}>
                <li>ساخت میز برای بازی‌های پریمیوم و دعوت دوستان رایگان (اگر بازی اجازه دهد)</li>
                <li>سقف بیشتر میزهای نوبتی هم‌زمان</li>
                <li>تحلیل روند و مقایسه فصل‌ها</li>
              </ul>
              {!me ? <Link className="btn btn--secondary" to="/login?next=/plans">برای خرید وارد شوید</Link>
                : <Button busy={busy === p.id} disabled={!p.purchasable} onClick={() => buy(p.id)}>{s?.premium ? 'تمدید (از پایان دوره فعلی)' : 'خرید'}</Button>}
              {!p.purchasable && p.unavailableReasonFa && <span className="muted">{p.unavailableReasonFa}</span>}
            </section>
          ))}
        </div>
        {me && s && s.payments.length > 0 && (
          <section className="stack" aria-labelledby="pay-h">
            <h2 id="pay-h" className="section-title">سابقه پرداخت</h2>
            <DataTable caption="سابقه پرداخت" rowKey={(r) => r.orderId} rows={s.payments} columns={[
              { key: 'date', title: 'تاریخ', render: (r) => jalaliDate(r.createdAt) },
              { key: 'plan', title: 'پلن', render: (r) => r.planTitleFa },
              { key: 'amount', title: 'مبلغ', render: (r) => money(r.amount, r.currency) },
              { key: 'status', title: 'وضعیت', render: (r) => <Badge tone={r.status === 'verified' ? 'success' : r.status === 'failed' ? 'danger' : undefined}>{PAYMENT_STATUS_FA[r.status]}</Badge> },
              { key: 'order', title: 'شماره سفارش', render: (r) => <Link to={`/payments/result?order=${r.orderId}`}><bdi dir="ltr">{r.orderId}</bdi></Link> }
            ]} />
          </section>
        )}
      </div>
    </>
  );
}

export function PaymentResultPage() {
  usePageTitle('نتیجه پرداخت');
  const [params] = useSearchParams();
  const order = params.get('order');
  const p = useApi<{ orderId: string; status: keyof typeof PAYMENT_STATUS_FA; failureReason: string | null; amount: number; planTitleFa: string; fixture: boolean }>(order ? `/payments/${encodeURIComponent(order)}` : null);
  const [checking, setChecking] = useState(false);
  const reload = p.reload;
  useEffect(() => { if (p.data?.status !== 'pending') return; const t = setInterval(reload, 5000); return () => clearInterval(t); }, [p.data?.status, reload]);
  if (!order) return <StateBlock kind="error" title="پرداخت شناخته نشد">درگاه اطلاعات معتبری برنگرداند. اگر مبلغی کسر شده، در «اشتراک» سابقه را ببینید یا با پشتیبانی تماس بگیرید.</StateBlock>;
  if (p.error) return <StateBlock kind="error" title="وضعیت پرداخت دریافت نشد">{p.error.messageFa}</StateBlock>;
  if (!p.data) return <StateBlock kind="loading" title="در حال بررسی پرداخت…" />;
  const d = p.data;
  const recheck = async () => { setChecking(true); try { await api(`/payments/${encodeURIComponent(d.orderId)}/verify`, { method: 'POST' }); reload(); } finally { setChecking(false); } };
  return (
    <div className="stack" style={{ maxInlineSize: 560 }}>
      <h1 className="page-title">نتیجه پرداخت</h1>
      {d.fixture && <div className="banner banner--warn" role="note">پرداخت آزمایشی توسعه: پول واقعی جابه‌جا نشده است.</div>}
      <section className="panel stack" aria-live="polite">
        <div className="row"><Badge tone={d.status === 'verified' ? 'success' : d.status === 'failed' ? 'danger' : undefined}>{PAYMENT_STATUS_FA[d.status]}</Badge><span>{d.planTitleFa}</span></div>
        {d.status === 'verified' && <p style={{ margin: 0 }}>پرداخت روی سرور تأیید شد و اشتراک شما فعال است.</p>}
        {d.status === 'pending' && <p style={{ margin: 0 }}>تأیید پرداخت هنوز از درگاه نرسیده است. این صفحه خودکار دوباره بررسی می‌کند؛ اگر پرداخت انجام شده باشد، با تأیید درگاه اشتراک فعال می‌شود.</p>}
        {(d.status === 'failed' || d.status === 'expired') && <p style={{ margin: 0 }}>{FAILURE_FA[d.failureReason ?? ''] ?? 'پرداخت تأیید نشد.'} اشتراکی فعال نشد.</p>}
        <p className="muted" style={{ margin: 0 }}>شماره سفارش: <bdi dir="ltr">{d.orderId}</bdi></p>
        <div className="row">
          {d.status === 'pending' && <Button busy={checking} onClick={recheck}>بررسی دوباره</Button>}
          <Link className="btn btn--secondary" to="/plans">اشتراک و سابقه</Link>
        </div>
      </section>
    </div>
  );
}

/** DEVELOPMENT-ONLY fake bank page. Clearly labelled; the API refuses this gateway in production. */
export function DevGatewayPage() {
  usePageTitle('درگاه آزمایشی');
  const [params] = useSearchParams();
  const authority = params.get('authority') ?? '';
  const toast = useToast();
  const choose = async (decision: string) => {
    try { location.assign((await api<{ callbackUrl: string }>(`/payments/fake/${encodeURIComponent(authority)}/decision`, { method: 'POST', body: { decision } })).callbackUrl); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'انجام نشد.'); }
  };
  return (
    <div className="stack" style={{ maxInlineSize: 520 }}>
      <div className="banner banner--warn" role="alert"><strong>درگاه آزمایشی توسعه.</strong> این یک بانک واقعی نیست و هیچ پولی جابه‌جا نمی‌شود. فقط برای آزمون مسیر تأیید سرور است.</div>
      <section className="panel stack">
        <h1 className="page-title" style={{ fontSize: 'var(--fs-xl)' }}>شبیه‌سازی نتیجه پرداخت</h1>
        <p className="muted" style={{ margin: 0 }}>شناسه: <bdi dir="ltr">{authority}</bdi></p>
        <Button onClick={() => choose('paid')}>پرداخت موفق</Button>
        <Button variant="secondary" onClick={() => choose('failed')}>انصراف / ناموفق</Button>
        <Button variant="secondary" onClick={() => choose('delayed')}>تأخیر در تأیید بانک</Button>
        <Button variant="ghost" onClick={() => choose('wrong_amount')}>مبلغ نادرست (آزمون امنیت)</Button>
      </section>
    </div>
  );
}
