import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { SubscriptionStatus } from '@bg/contracts';
import { faNumber, useToast } from '@bg/ui';
import { Badge, Banner, Button, Card, Icon, PageHead, StateBlock } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { faNum, jalaliDate, jalaliDateTime } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';

interface Plans { items: { id: string; titleFa: string; period: string; durationDays: number; priceAmount: number | null; currency: string; termsFa: string; purchasable: boolean; unavailableReasonFa: string | null }[];
  checkout: { available: boolean; reasonFa: string | null; fixture: boolean }; limits: { turnTables: { free: number; premium: number } } }
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
  if (plans.error) return <StateBlock kind="error" title="پلن‌ها دریافت نشد" action={<Button variant="primary" icon="refresh-cw" onClick={plans.reload}>تلاش دوباره</Button>} />;
  if (!plans.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const s = status.data;
  // The longest purchasable plan is the café's recommendation.
  const featured = plans.data.items.filter((p) => p.purchasable).sort((a, b) => b.durationDays - a.durationDays)[0]?.id;
  // No plans listed = the store is closed (launch promo): show only my premium status.
  const store = plans.data.items.length > 0;
  // The Cafe Bazaar app sells nothing for money; outside the launch promo the server says so instead of the promo note.
  const closedNote = (navigator.userAgent.includes('BGVBazaar/') && plans.data.checkout.reasonFa) || 'در دوران افتتاح سایت، هر بازیکن با ورود، پریمیوم رایگان هدیه می‌گیرد.';
  return (
    <>
      <PageTabs group="wallet" />
      <PageHead title="اشتراک پریمیوم" sub={`پریمیوم امتیاز مهارتی، اولویت صف یا کمک حین بازی نمی‌دهد.${store ? ' تمدید خودکار ندارد.' : ''}`} />
      {store && plans.data.checkout.fixture && <Banner tone="warning" text="حالت آزمایشی: درگاه پرداخت آزمایشی است و پول واقعی جابه‌جا نمی‌شود." />}
      {store && !plans.data.checkout.available && <Banner tone="info" text={plans.data.checkout.reasonFa} />}
      {me && s && (
        <Card aria-labelledby="mine-h" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', ...(s.premium ? { outline: '2px solid var(--accent)' } : {}) }}>
          <span className="ac-tile" style={{ inlineSize: 48, blockSize: 48, ...(s.premium ? { background: 'var(--accent)', color: 'var(--on-accent)' } : {}) }}><Icon name="crown" size="lg" /></span>
          <div style={{ flex: '1 1 320px', display: 'grid', gap: 4, minInlineSize: 0 }}>
            <h2 id="mine-h" className="ac-h3" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>وضعیت من{s.premium && <Badge tone="premium" icon="crown">پریمیوم فعال</Badge>}</h2>
            {s.premium ? <p className="t-body-sm" style={{ margin: 0 }}>{s.premiumUntil ? `تا ${jalaliDate(s.premiumUntil)}` : ''}؛ پس از پایان، بازی‌های در جریان قطع نمی‌شوند.</p>
              : <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>اشتراک فعالی ندارید.</p>}
            {!store && <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>{closedNote}</p>}
          </div>
        </Card>
      )}
      {!store && !me && <p className="t-body-sm" style={{ margin: 0 }}>{closedNote} <Link to="/login?next=/plans">ورود</Link></p>}
      <div className="ac-plans">
        {plans.data.items.map((p) => {
          const top = p.id === featured;
          return (
            <Card key={p.id} className={`ac-plan${top ? ' ac-plan--top' : ''}`} aria-labelledby={`plan-${p.id}`}>
              <div className="ac-between" style={{ flexWrap: 'wrap', gap: 8 }}>
                <h2 id={`plan-${p.id}`} className="ac-h2">{p.titleFa}</h2>
                <span className="bgv-row" style={{ gap: 6 }}>{top && <Badge tone="premium" icon="sparkles" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>پیشنهاد کافه</Badge>}<Badge>{faNum(p.durationDays)} روز</Badge></span>
              </div>
              <p className="ac-plan__price">{p.priceAmount ? money(p.priceAmount, p.currency) : <small>قیمت تعیین نشده</small>}</p>
              <p className="t-body-sm ac-muted">{p.termsFa}</p>
              <ul className="ac-perks">{PERKS.map((k) => <li key={k}><i><Icon name="check" size="sm" /></i><span>{k}</span></li>)}</ul>
              <div style={{ marginBlockStart: 'auto', display: 'grid', gap: 8 }}>
                {!me ? <Button variant="primary" block href="/login?next=/plans">برای خرید وارد شوید</Button>
                  : <Button variant="primary" block loading={busy === p.id} disabled={!p.purchasable} onClick={() => buy(p.id)}>{s?.premium ? 'تمدید (از پایان دوره فعلی)' : 'خرید'}</Button>}
                {!p.purchasable && p.unavailableReasonFa && <span className="ac-plan__why ac-muted">{p.unavailableReasonFa}</span>}
              </div>
            </Card>
          );
        })}
      </div>
      <section className="ac-stack" style={{ gap: 12 }} aria-labelledby="cmp-h">
        <h2 id="cmp-h" className="ac-h2">رایگان و پریمیوم کنار هم</h2>
        <Card flush className="ac-tablecard"><div className="bgv-scroll-x">
          <table className="bgv-table ac-cmp">
            <thead><tr><th scope="col">امکان</th><th scope="col">رایگان</th><th scope="col" className="ac-cmp__hl">پریمیوم</th></tr></thead>
            <tbody>
              <tr><th scope="row">میزهای نوبتی هم‌زمان</th><td>{faNum(plans.data.limits.turnTables.free)} میز</td><td className="ac-cmp__hl">{faNum(plans.data.limits.turnTables.premium)} میز</td></tr>
              <tr><th scope="row">میز زنده</th><td>یک میز در هر زمان</td><td className="ac-cmp__hl">یک میز در هر زمان</td></tr>
              <tr><th scope="row">بازی‌های پریمیوم</th><td>نشستن با دعوت میزبان پریمیوم</td><td className="ac-cmp__hl">ساخت میز و دعوت دوستان</td></tr>
              <tr><th scope="row">تحلیل روند و مقایسهٔ فصل‌ها</th><td><Icon name="x" size="sm" aria-label="ندارد" /></td><td className="ac-cmp__hl"><Icon name="check" size="sm" aria-label="دارد" /></td></tr>
              <tr><th scope="row">امتیاز مهارتی، اولویت صف و کمک حین بازی</th><td className="ac-muted">یکسان برای همه</td><td className="ac-cmp__hl ac-muted">یکسان برای همه</td></tr>
            </tbody>
          </table>
        </div></Card>
      </section>
      <div className="ac-between">
        {store && me && <p className="t-body-sm" style={{ margin: 0 }}>سکه دارید؟ با سکه‌های بازی هم می‌توانید روز پریمیوم بگیرید: <Link to="/coins">کیف سکه</Link></p>}
        {store && <p className="ac-note"><Icon name="info" size="sm" />پرداخت از درگاه زرین‌پال؛ تأیید نهایی همیشه روی سرور انجام می‌شود.</p>}
      </div>
      {me && s && s.payments.length > 0 && (
        <section className="ac-stack" style={{ gap: 12 }} aria-labelledby="pay-h">
          <h2 id="pay-h" className="ac-h2">سابقه پرداخت</h2>
          <Card flush className="ac-tablecard"><div className="bgv-scroll-x">
            <table className="bgv-table">
              <caption className="bgv-sr">سابقه پرداخت</caption>
              <thead><tr><th scope="col">تاریخ</th><th scope="col">خرید</th><th scope="col">مبلغ</th><th scope="col">وضعیت</th><th scope="col">شماره سفارش</th></tr></thead>
              <tbody>{s.payments.map((r) => (
                <tr key={r.orderId}>
                  <td>{jalaliDate(r.createdAt)}</td><td style={{ fontWeight: 700 }}>{r.planTitleFa}</td><td>{money(r.amount, r.currency)}</td>
                  <td><Badge tone={r.status === 'verified' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'}
                    icon={r.status === 'verified' ? 'check' : r.status === 'pending' ? 'hourglass' : 'x'}>{PAYMENT_STATUS_FA[r.status]}</Badge></td>
                  <td><Link to={`/payments/result?order=${r.orderId}`}><bdi dir="ltr" className="bgv-latin ac-cap">{r.orderId}</bdi></Link></td>
                </tr>))}</tbody>
            </table></div></Card>
        </section>
      )}
    </>
  );
}

export function PaymentResultPage() {
  usePageTitle('نتیجه پرداخت');
  const [params] = useSearchParams();
  const order = params.get('order');
  const p = useApi<{ orderId: string; status: keyof typeof PAYMENT_STATUS_FA; failureReason: string | null; amount: number; planTitleFa: string; kind: 'plan' | 'coins' | 'tournament'; coins: number | null; fixture: boolean; tournamentId: string | null; createdAt?: string }>(order ? `/payments/${encodeURIComponent(order)}` : null);
  const [checking, setChecking] = useState(false);
  const reload = p.reload;
  useEffect(() => { if (p.data?.status !== 'pending') return; const t = setInterval(reload, 5000); return () => clearInterval(t); }, [p.data?.status, reload]);
  const frame = (children: ReactNode) => (
    <div className="bgv ac-result">
      <header className="bgv-topbar"><span className="bgv-topbar__title">نتیجهٔ پرداخت</span><Button variant="ghost" iconOnly icon="x" href="/">بستن</Button></header>
      <div className="ac-result__body">{children}</div>
    </div>
  );
  if (!order) return frame(<Card><StateBlock kind="error" title="پرداخت شناخته نشد" text="درگاه اطلاعات معتبری برنگرداند. اگر مبلغی کسر شده، در «اشتراک» سابقه را ببینید یا با پشتیبانی تماس بگیرید." action={<Button href="/support">تماس با پشتیبانی</Button>} /></Card>);
  if (p.error) return frame(<Card><StateBlock kind="error" title="وضعیت پرداخت دریافت نشد" text={p.error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={reload}>تلاش دوباره</Button>} /></Card>);
  if (!p.data) return frame(<Card><StateBlock kind="loading" title="در حال بررسی پرداخت…" /></Card>);
  const d = p.data;
  const ok = d.status === 'verified';
  const coins = d.kind === 'coins';
  const entry = d.kind === 'tournament';
  const recheck = async () => { setChecking(true); try { await api(`/payments/${encodeURIComponent(d.orderId)}/verify`, { method: 'POST' }); reload(); } finally { setChecking(false); } };
  const tone = ok ? 'ok' : d.status === 'pending' ? 'wait' : 'bad';
  return frame(
    <>
      {d.fixture && <Banner tone="warning" text="پرداخت آزمایشی: پول واقعی جابه‌جا نشده است." />}
      <Card className="ac-result__card" aria-live="polite">
        <span className={`ac-result__icon ac-result__icon--${tone}`}><Icon name={ok ? 'circle-check' : d.status === 'pending' ? 'hourglass' : 'circle-alert'} size={40} /></span>
        <h1 className="t-page-sm">{ok ? (coins ? `${faNum(d.coins ?? 0)} سکه به کیف شما اضافه شد` : entry ? 'ورودی تورنمنت پرداخت شد' : 'به جمع پریمیوم خوش آمدید') : d.status === 'pending' ? 'در انتظار تأیید بانک' : 'پرداخت انجام نشد'}</h1>
        <div className="bgv-row" style={{ justifyContent: 'center' }}>
          <Badge tone={ok ? 'success' : d.status === 'failed' ? 'danger' : undefined} icon={ok ? 'check' : d.status === 'pending' ? 'hourglass' : 'x'}>{PAYMENT_STATUS_FA[d.status]}</Badge>
          <span className="t-body-sm">{d.planTitleFa}<span className="bgv-sep" />{money(d.amount, 'IRR')}</span>
        </div>
        {ok && <p className="t-body-sm bgv-muted">{coins ? 'پرداخت روی سرور تأیید شد و سکه‌ها به حساب شما اضافه شد.' : entry ? 'پرداخت تأیید شد. وضعیت ثبت‌نام را در صفحهٔ تورنمنت ببینید؛ اگر ظرفیت پیش از تأیید پر شده باشد، مبلغ بازپرداخت می‌شود.' : 'پرداخت روی سرور تأیید شد و اشتراک شما فعال است.'}</p>}
        {d.status === 'pending' && <p className="t-body-sm bgv-muted">تأیید پرداخت هنوز از درگاه نرسیده است. این صفحه خودکار دوباره بررسی می‌کند؛ اگر پرداخت انجام شده باشد، با تأیید درگاه خرید شما فعال می‌شود.</p>}
        {(d.status === 'failed' || d.status === 'expired') && <p className="t-body-sm bgv-muted">{FAILURE_FA[d.failureReason ?? ''] ?? 'پرداخت تأیید نشد.'} {coins ? 'سکه‌ای اضافه نشد.' : entry ? 'ثبت‌نامی انجام نشد.' : 'اشتراکی فعال نشد.'}</p>}
        <div className="ac-receipt"><div><span>درگاه</span><b>{d.fixture ? 'درگاه آزمایشی' : 'زرین‌پال'}</b></div><div><span>شماره سفارش</span><b className="bgv-latin" dir="ltr" style={{ fontSize: 14 }}>{d.orderId}</b></div>
          {d.createdAt && <div><span>زمان</span><b>{jalaliDateTime(d.createdAt)}</b></div>}</div>
      </Card>
      {!ok && d.status !== 'pending' && <Banner tone="info" text="اگر مبلغی از حساب بانکی کم شده ولی خرید فعال نشد، بانک آن را برمی‌گرداند." />}
      <div className="ac-result__actions">
        {d.status === 'pending' && <Button variant="primary" size="lg" loading={checking} onClick={recheck}>بررسی دوباره</Button>}
        {d.tournamentId && (ok || d.status === 'pending') && <Button variant="primary" size="lg" href={`/tournaments/${d.tournamentId}`}>صفحهٔ تورنمنت</Button>}
        {ok && !entry && (coins ? <Button variant="primary" size="lg" icon="wallet" href="/coins">کیف سکه</Button> : <Button variant="primary" size="lg" href="/games">برویم سر میز</Button>)}
        {(d.status === 'failed' || d.status === 'expired') && <Button variant="primary" size="lg" icon="rotate-ccw"
          href={entry && d.tournamentId ? `/tournaments/${d.tournamentId}` : coins ? '/coins' : '/plans'}>تلاش دوباره</Button>}
        <Button href="/plans">اشتراک و سابقه</Button>
        {(d.status === 'failed' || d.status === 'expired') && <Button variant="ghost" size="sm" icon="life-buoy" href="/support">تماس با پشتیبانی</Button>}
      </div>
    </>
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
    <div className="bgv ac-result">
      <div className="ac-result__body">
        <Banner tone="warning" title="درگاه آزمایشی توسعه." text="این یک بانک واقعی نیست و هیچ پولی جابه‌جا نمی‌شود. فقط برای آزمون مسیر تأیید سرور است." />
        <Card className="ac-stack" style={{ padding: 20 }}>
          <h1 className="t-page-sm" style={{ margin: 0, color: 'var(--heading)' }}>شبیه‌سازی نتیجه پرداخت</h1>
          <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>شناسه: <bdi dir="ltr">{authority}</bdi></p>
          <Button variant="primary" onClick={() => choose('paid')}>پرداخت موفق</Button>
          <Button onClick={() => choose('failed')}>انصراف / ناموفق</Button>
          <Button onClick={() => choose('delayed')}>تأخیر در تأیید بانک</Button>
          <Button variant="ghost" onClick={() => choose('wrong_amount')}>مبلغ نادرست (آزمون امنیت)</Button>
        </Card>
      </div>
    </div>
  );
}
