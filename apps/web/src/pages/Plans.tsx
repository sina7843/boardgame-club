import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { SubscriptionStatus } from '@bg/contracts';
import { Check, CircleX, Crown, Hourglass, Receipt } from 'lucide-react';
import { Badge, Button, Confetti, DataTable, StateBlock, SuccessCheck, buttonClass, cn, faNumber, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum, jalaliDate } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

interface Plans { items: { id: string; titleFa: string; period: string; durationDays: number; priceAmount: number | null; currency: string; termsFa: string; purchasable: boolean; unavailableReasonFa: string | null }[];
  checkout: { available: boolean; reasonFa: string | null; fixture: boolean } }
/** Stored in Rial (what Zarinpal charges); shown in Toman as Iranian shoppers read prices. */
const money = (amount: number, currency: string) => currency === 'IRR' ? `${faNumber(Math.round(amount / 10))} تومان` : `${faNum(amount)} ${currency}`;
export const PAYMENT_STATUS_FA = { pending: 'در انتظار تأیید', verified: 'تأییدشده', failed: 'ناموفق', expired: 'منقضی' } as const;
export const FAILURE_FA: Record<string, string> = {
  DECLINED_BY_PAYER: 'پرداخت در درگاه لغو یا رد شد.', CANCELLED_BY_PAYER: 'پرداخت در درگاه زرین‌پال لغو شد.', AMOUNT_MISMATCH: 'مبلغ پرداخت‌شده با سفارش یکسان نبود؛ اشتراک فعال نشد.',
  DUPLICATE_REFERENCE: 'شناسه پرداخت تکراری بود؛ اشتراک فعال نشد.', PROVIDER_ERROR: 'ارتباط با درگاه برقرار نشد.',
  NOT_CONFIRMED_IN_TIME: 'تأیید پرداخت در زمان مقرر نرسید.', UNKNOWN_AUTHORITY: 'درگاه این پرداخت را نشناخت.'
};

const PERKS = ['ساخت میز برای بازی‌های پریمیوم و دعوت دوستان رایگان (اگر بازی اجازه دهد)', 'سقف بیشتر میزهای نوبتی هم‌زمان', 'تحلیل روند و مقایسه فصل‌ها'];

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
  // The longest purchasable plan is the café's recommendation.
  const featured = plans.data.items.filter((p) => p.purchasable).sort((a, b) => b.durationDays - a.durationDays)[0]?.id;
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">اشتراک پریمیوم</h1><p className="page-sub">پریمیوم امتیاز مهارتی، اولویت صف یا کمک حین بازی نمی‌دهد. تمدید خودکار ندارد.</p></div></div>
      {plans.data.checkout.fixture && <div className="banner banner--warn" role="note">حالت آزمایشی: درگاه پرداخت آزمایشی است و پول واقعی جابه‌جا نمی‌شود.</div>}
      {!plans.data.checkout.available && <div className="banner banner--info" role="status">{plans.data.checkout.reasonFa}</div>}
      <div className="grid gap-6">
        {me && s && (
          <section className={cn('flex flex-wrap items-center gap-4 rounded-surface border-line p-5 shadow-surface', s.premium ? 'border-brand/40 bg-brand/8' : 'border-border bg-card')} aria-labelledby="mine-h">
            <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-field shadow-control', s.premium ? 'bg-brand text-brand-foreground' : 'bg-secondary text-muted-foreground')}><Crown className="size-6" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <h2 id="mine-h" className="text-base">وضعیت من</h2>
              {s.premium ? <p className="m-0 text-sm"><Badge tone="premium">پریمیوم فعال</Badge> {s.premiumUntil ? `تا ${jalaliDate(s.premiumUntil)}` : ''}؛ پس از پایان، بازی‌های در جریان قطع نمی‌شوند.</p>
                : <p className="m-0 text-sm text-muted-foreground">اشتراک فعالی ندارید.</p>}
            </div>
          </section>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:max-w-4xl">
          {plans.data.items.map((p, i) => {
            const top = p.id === featured;
            return (
              <section key={p.id} aria-labelledby={`plan-${p.id}`} style={{ animationDelay: `${i * 90}ms` }}
                className={cn('relative flex flex-col gap-5 rounded-surface border-line p-6 shadow-surface animate-fade-up transition-transform duration-(--motion) ease-motion hover:-translate-y-1',
                  top ? 'border-transparent bg-felt text-felt-foreground ring-2 ring-brand' : 'border-border bg-card')}>
                {top && <span className="absolute -top-3 start-6 rounded-control bg-brand px-3 py-0.5 text-xs font-bold text-brand-foreground shadow-control">پیشنهاد کافه</span>}
                <div className="flex items-start justify-between gap-3">
                  <h2 id={`plan-${p.id}`} className="text-lg">{p.titleFa}</h2>
                  <span className={cn('rounded-control px-3 py-0.5 text-xs font-semibold', top ? 'bg-white/12' : 'bg-secondary text-muted-foreground')}>{faNum(p.durationDays)} روز</span>
                </div>
                <p className="m-0 font-display text-3xl font-extrabold leading-none">
                  {p.priceAmount ? money(p.priceAmount, p.currency) : <span className="text-xl opacity-70">قیمت تعیین نشده</span>}
                </p>
                <p className={cn('m-0 text-sm', top ? 'opacity-85' : 'text-muted-foreground')}>{p.termsFa}</p>
                <ul className="m-0 grid list-none gap-2.5 p-0 text-sm">
                  {PERKS.map((k) => (
                    <li key={k} className="flex items-start gap-2.5">
                      <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full', top ? 'bg-brand text-brand-foreground' : 'bg-primary/12 text-primary')}><Check className="size-3.5" strokeWidth={3} aria-hidden /></span>{k}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto grid gap-2">
                  {!me ? <Link className={buttonClass(top ? 'brand' : 'secondary', 'md', true)} to="/login?next=/plans">برای خرید وارد شوید</Link>
                    : <Button variant={top ? 'brand' : 'primary'} block busy={busy === p.id} disabled={!p.purchasable} onClick={() => buy(p.id)}>{s?.premium ? 'تمدید (از پایان دوره فعلی)' : 'خرید'}</Button>}
                  {!p.purchasable && p.unavailableReasonFa && <span className={cn('text-center text-xs', top ? 'opacity-85' : 'text-muted-foreground')}>{p.unavailableReasonFa}</span>}
                </div>
              </section>
            );
          })}
        </div>
        <p className="m-0 flex items-center gap-2 text-xs text-muted-foreground"><Receipt className="size-4" aria-hidden />پرداخت از درگاه زرین‌پال؛ تأیید نهایی همیشه روی سرور انجام می‌شود.</p>
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
  const ok = d.status === 'verified';
  const recheck = async () => { setChecking(true); try { await api(`/payments/${encodeURIComponent(d.orderId)}/verify`, { method: 'POST' }); reload(); } finally { setChecking(false); } };
  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <h1 className="page-title">نتیجه پرداخت</h1>
      {d.fixture && <div className="banner banner--warn" role="note">پرداخت آزمایشی: پول واقعی جابه‌جا نشده است.</div>}
      <section className="relative isolate grid justify-items-center gap-4 overflow-hidden rounded-surface border-line border-border bg-card px-6 pt-10 pb-6 text-center shadow-overlay animate-fade-up" aria-live="polite">
        {ok && <Confetti count={70} colors={['var(--brand)', 'var(--primary)', 'var(--success)', '#e9c46a', '#d1495b']} />}
        {ok ? <SuccessCheck size={84} />
          : d.status === 'pending' ? <span className="flex size-20 items-center justify-center rounded-full bg-warning/12 text-warning animate-pulse-soft"><Hourglass className="size-9" aria-hidden /></span>
          : <span className="flex size-20 items-center justify-center rounded-full bg-destructive/10 text-destructive animate-pop"><CircleX className="size-10" aria-hidden /></span>}
        <div className="grid gap-2">
          <p className="m-0 font-display text-2xl font-extrabold">{ok ? 'به جمع پریمیوم خوش آمدید' : d.status === 'pending' ? 'در انتظار تأیید بانک' : 'پرداخت انجام نشد'}</p>
          <p className="m-0 flex flex-wrap items-center justify-center gap-2"><Badge tone={ok ? 'success' : d.status === 'failed' ? 'danger' : undefined}>{PAYMENT_STATUS_FA[d.status]}</Badge><span className="text-sm">{d.planTitleFa} · {money(d.amount, 'IRR')}</span></p>
        </div>
        {ok && <p className="m-0 text-sm">پرداخت روی سرور تأیید شد و اشتراک شما فعال است.</p>}
        {d.status === 'pending' && <p className="m-0 text-sm text-muted-foreground">تأیید پرداخت هنوز از درگاه نرسیده است. این صفحه خودکار دوباره بررسی می‌کند؛ اگر پرداخت انجام شده باشد، با تأیید درگاه اشتراک فعال می‌شود.</p>}
        {(d.status === 'failed' || d.status === 'expired') && <p className="m-0 text-sm text-muted-foreground">{FAILURE_FA[d.failureReason ?? ''] ?? 'پرداخت تأیید نشد.'} اشتراکی فعال نشد.</p>}
        <p className="m-0 w-full rounded-field bg-secondary px-4 py-2 text-xs text-muted-foreground">شماره سفارش: <bdi dir="ltr" className="font-semibold text-foreground">{d.orderId}</bdi></p>
        <div className="flex w-full flex-wrap justify-center gap-2">
          {d.status === 'pending' && <Button busy={checking} onClick={recheck}>بررسی دوباره</Button>}
          {ok && <Link className={buttonClass('primary', 'md')} to="/games">برویم سر میز</Link>}
          <Link className={buttonClass('secondary', 'md')} to="/plans">اشتراک و سابقه</Link>
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
