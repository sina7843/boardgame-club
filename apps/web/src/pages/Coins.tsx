import { useState } from 'react';
import { Link } from 'react-router';
import { Crown, Receipt, Sparkles } from 'lucide-react';
import { Badge, Button, Progress, StateBlock, buttonClass, faNumber, useToast } from '@bg/ui';
import { api, ApiFailure } from '../lib/api.ts';
import { CoinMark, coinsChanged, useCoins } from '../lib/coins.tsx';
import { faNum, jalaliDate } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';

/** Stored in Rial; shown in Toman (same rule as the plans page). */
const money = (amount: number, currency: string) => currency === 'IRR' ? `${faNumber(Math.round(amount / 10))} تومان` : `${faNum(amount)} ${currency}`;

/** Coin wallet: balance, what coins buy, coin packs, how to earn them and recent movements. */
export function CoinsPage() {
  usePageTitle('سکه‌ها');
  const toast = useToast();
  const c = useCoins();
  const [busy, setBusy] = useState<string>();
  if (c.error) return <StateBlock kind={c.error.status === 401 ? 'denied' : 'error'} title={c.error.status === 401 ? 'برای دیدن سکه‌ها وارد شوید' : 'سکه‌ها دریافت نشد'}
    action={c.error.status === 401 ? <Link className={buttonClass('primary', 'md')} to="/login?next=/coins">ورود</Link> : <Button onClick={c.reload}>تلاش دوباره</Button>} />;
  if (!c.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const d = c.data;

  const spend = async (item: string) => {
    setBusy(item);
    try {
      const r = await api<{ balance: number; premiumUntil: string | null }>('/coins/spend', { method: 'POST', body: { item, requestId: crypto.randomUUID() } });
      toast('success', r.premiumUntil ? `پریمیوم شما تا ${jalaliDate(r.premiumUntil)} فعال است.` : 'خرید انجام شد.');
      coinsChanged();
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'خرید انجام نشد.'); }
    finally { setBusy(undefined); }
  };
  const buyPack = async (packId: string) => {
    setBusy(packId);
    try { location.assign((await api<{ redirectUrl: string }>('/coins/checkout', { method: 'POST', body: { packId } })).redirectUrl); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'شروع پرداخت ممکن نشد.'); setBusy(undefined); }
  };

  return (
    <>
      <PageTabs group="wallet" />
      <div className="page-head"><div><h1 className="page-title">سکه‌ها</h1><p className="page-sub">با بازی، برد، مأموریت، دستاورد و بالا رفتن سطح سکه بگیرید{d.shop.length > 0 && ' و با آن روز پریمیوم بخرید'}. سکه روی رتبه و نتیجه بازی اثری ندارد.</p></div></div>
      {d.checkout.fixture && d.packs.length > 0 && <div className="banner banner--warn" role="note">حالت آزمایشی: درگاه پرداخت آزمایشی است و پول واقعی جابه‌جا نمی‌شود.</div>}
      <div className="grid gap-6">
        <section aria-labelledby="bal-h" className="relative isolate flex flex-wrap items-center gap-5 overflow-hidden rounded-surface bg-felt p-6 text-felt-foreground shadow-surface animate-fade-up">
          <CoinMark className="size-16 animate-pop" />
          <div className="grid gap-1">
            <h2 id="bal-h" className="m-0 text-sm font-semibold opacity-85">موجودی من</h2>
            <p className="m-0 font-display text-4xl font-extrabold leading-none" aria-live="polite"><span className="num">{faNum(d.balance)}</span> <span className="text-xl">سکه</span></p>
          </div>
        </section>

        {d.shop.length > 0 && <section className="stack" aria-labelledby="shop-h">
          <h2 id="shop-h" className="section-title">خرید با سکه</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:max-w-4xl">
            {d.shop.map((i, n) => {
              const short = Math.max(0, i.cost - d.balance);
              return (
                <section key={i.key} aria-labelledby={`shop-${i.key}`} style={{ animationDelay: `${n * 90}ms` }}
                  className="flex flex-col gap-4 rounded-surface border-line border-border bg-card p-6 shadow-surface animate-fade-up">
                  <div className="flex items-start justify-between gap-3">
                    <h3 id={`shop-${i.key}`} className="m-0 flex items-center gap-2 text-lg"><Crown className="size-5 text-brand" aria-hidden />{i.titleFa}</h3>
                    <span className="inline-flex items-center gap-1.5 rounded-control bg-secondary px-3 py-0.5 text-sm font-bold"><CoinMark className="size-5" /><span className="num">{faNum(i.cost)}</span></span>
                  </div>
                  <p className="m-0 text-sm text-muted-foreground">{i.descriptionFa}</p>
                  {short > 0 && <Progress label={`پس‌انداز برای ${i.titleFa}`} value={d.balance} max={i.cost} valueText={`${faNum(short)} سکه دیگر`} />}
                  <Button className="mt-auto" block busy={busy === i.key} disabled={short > 0 || !!busy} onClick={() => spend(i.key)}>
                    {short > 0 ? `${faNum(short)} سکه کم دارید` : 'خرید با سکه'}
                  </Button>
                </section>
              );
            })}
          </div>
        </section>}

        {d.packs.length > 0 && (
          <section className="stack" aria-labelledby="packs-h">
            <h2 id="packs-h" className="section-title">خرید سکه</h2>
            {!d.checkout.available && <div className="banner banner--info" role="status">{d.checkout.reasonFa}</div>}
            <div className="grid gap-4 sm:grid-cols-3 lg:max-w-4xl">
              {d.packs.map((p) => (
                <section key={p.id} aria-labelledby={`pack-${p.id}`} className="flex flex-col items-center gap-3 rounded-surface border-line border-border bg-card p-5 text-center shadow-surface">
                  <CoinMark className="size-12" />
                  <h3 id={`pack-${p.id}`} className="m-0 text-base">{p.titleFa}</h3>
                  <p className="m-0 font-display text-2xl font-extrabold"><span className="num">{faNum(p.coins)}</span> سکه</p>
                  <p className="m-0 text-sm text-muted-foreground">{p.priceAmount ? money(p.priceAmount, p.currency) : 'قیمت تعیین نشده'}</p>
                  <Button className="mt-auto" block variant="secondary" busy={busy === p.id} disabled={!p.purchasable || !!busy} onClick={() => buyPack(p.id)}>خرید</Button>
                  {!p.purchasable && p.unavailableReasonFa && <span className="text-xs text-muted-foreground">{p.unavailableReasonFa}</span>}
                </section>
              ))}
            </div>
            <p className="m-0 flex items-center gap-2 text-xs text-muted-foreground"><Receipt className="size-4" aria-hidden />سکه فقط پس از تأیید پرداخت روی سرور به حساب شما اضافه می‌شود. سابقه پرداخت در <Link to="/plans">اشتراک</Link>.</p>
          </section>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className="panel stack" aria-labelledby="earn-h">
            <h2 id="earn-h" className="section-title flex items-center gap-2"><Sparkles className="size-5 text-brand" aria-hidden />راه‌های گرفتن سکه</h2>
            <ul className="m-0 grid list-none gap-2 p-0">
              {d.earn.map((e) => (
                <li key={e.labelFa} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0">
                  <span>{e.labelFa}</span><span className="inline-flex items-center gap-1 font-bold"><span className="num" dir="ltr">+{faNum(e.coins)}</span><CoinMark className="size-4" /></span>
                </li>
              ))}
            </ul>
            <p className="m-0 text-xs text-muted-foreground">سکهٔ بازی‌ها هم‌پای XP است: سقف روزانه و بازی پیاپی با حریف تکراری سکه را هم کم می‌کند.</p>
          </section>

          <section className="panel stack" aria-labelledby="hist-h">
            <h2 id="hist-h" className="section-title">گردش سکه</h2>
            {d.history.length === 0 ? <p className="muted" style={{ margin: 0 }}>هنوز سکه‌ای نگرفته‌اید. یک بازی را تا پایان کنید. <Link to="/games">بازی‌ها</Link></p> : (
              <ul className="m-0 grid list-none gap-2 p-0">
                {d.history.map((h, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Badge tone={h.amount > 0 ? 'success' : 'danger'}><span className="num" dir="ltr">{h.amount > 0 ? '+' : '−'}{faNum(Math.abs(h.amount))}</span></Badge>
                    <span className="min-w-0 flex-1 truncate">{h.reason}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{jalaliDate(h.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
