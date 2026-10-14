import { useState } from 'react';
import { Link } from 'react-router';
import { faNumber, useToast } from '@bg/ui';
import { Badge, Banner, Button, Card, Coin, Hero, Icon, PageHead, Progress, StateBlock } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { coinsChanged, useCoins } from '../lib/coins.tsx';
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
  const sub = useApi<{ premium: boolean; premiumUntil: string | null }>('/me/subscription');
  const [busy, setBusy] = useState<string>();
  if (c.error) return <StateBlock kind={c.error.status === 401 ? 'denied' : 'error'} title={c.error.status === 401 ? 'برای دیدن سکه‌ها وارد شوید' : 'سکه‌ها دریافت نشد'}
    action={c.error.status === 401 ? <Button variant="primary" href="/login?next=/coins">ورود</Button> : <Button variant="primary" icon="refresh-cw" onClick={c.reload}>تلاش دوباره</Button>} />;
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
      <PageHead title="سکه‌ها" sub={`با بازی، برد، مأموریت، دستاورد و بالا رفتن سطح سکه بگیرید${d.shop.length > 0 ? ' و با آن روز پریمیوم بخرید' : ''}. سکه روی رتبه و نتیجه بازی اثری ندارد.`} />
      {d.checkout.fixture && d.packs.length > 0 && <Banner tone="warning" text="حالت آزمایشی: درگاه پرداخت آزمایشی است و پول واقعی جابه‌جا نمی‌شود." />}

      <Hero eyebrow="موجودی من" title={<span aria-live="polite">{faNum(d.balance)} سکه</span>} aside={<Coin size="lg" aria-hidden />}
        actions={<>
          {d.packs.length > 0 && <Button variant="primary" icon="plus" onClick={() => document.getElementById('packs-h')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>خرید سکه</Button>}
          <Button icon="history" href="/plans">سابقه</Button>
        </>} />
      {sub.data && (
        <Card className="ac-premium" aria-label="وضعیت پریمیوم">
          <span className="ac-tile"><Icon name="crown" /></span>
          <div className="ac-row__text">
            <b className="bgv-row" style={{ gap: 8 }}>پریمیوم {sub.data.premium ? <Badge tone="premium" size="sm">فعال</Badge> : <Badge size="sm">غیرفعال</Badge>}</b>
            <span>{sub.data.premium && sub.data.premiumUntil ? `تا ${jalaliDate(sub.data.premiumUntil)}` : 'با سکه یا اشتراک فعال می‌شود.'}</span>
          </div>
          <Button size="sm" href="/plans">پلن‌ها</Button>
        </Card>
      )}

      {d.shop.length > 0 && (
        <section className="ac-stack" style={{ gap: 12 }} aria-labelledby="shop-h">
          <h2 id="shop-h" className="ac-h2">خرید با سکه</h2>
          <div className="bgv-grid ac-fit">
            {d.shop.map((i) => {
              const short = Math.max(0, i.cost - d.balance);
              return (
                <Card key={i.key} className="ac-shop" aria-labelledby={`shop-${i.key}`}>
                  <div className="ac-between" style={{ flexWrap: 'nowrap' }}>
                    <h3 id={`shop-${i.key}`} className="ac-h3" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="crown" />{i.titleFa}</h3>
                    <Coin chip amount={i.cost} />
                  </div>
                  <p className="t-body-sm bgv-muted" style={{ margin: 0, textWrap: 'pretty' }}>{i.descriptionFa}</p>
                  {short > 0 && <Progress label={`پس‌انداز برای ${i.titleFa}`} value={Math.min(1, d.balance / i.cost)} valueText={`${faNum(short)} سکه دیگر`} />}
                  <Button variant="primary" block loading={busy === i.key} disabled={short > 0 || !!busy} onClick={() => spend(i.key)}>
                    {short > 0 ? `${faNum(short)} سکه کم دارید` : 'خرید با سکه'}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {d.packs.length > 0 && (
        <section className="ac-stack" style={{ gap: 12 }} aria-labelledby="packs-h">
          <h2 id="packs-h" className="ac-h2">خرید سکه</h2>
          {!d.checkout.available && <Banner tone="info" text={d.checkout.reasonFa} />}
          <div className="bgv-grid ac-fit">
            {d.packs.map((p) => (
              <Card key={p.id} className="ac-pack" aria-labelledby={`pack-${p.id}`}>
                <Coin size="lg" aria-hidden />
                <h3 id={`pack-${p.id}`} className="ac-h3">{p.titleFa}</h3>
                <p className="t-num-lg" style={{ color: 'var(--heading)', margin: 0 }}>{faNum(p.coins)} <small style={{ fontSize: 15, fontWeight: 700 }}>سکه</small></p>
                <p className="ac-cap">{p.priceAmount ? money(p.priceAmount, p.currency) : 'قیمت تعیین نشده'}</p>
                <Button loading={busy === p.id} disabled={!p.purchasable || !!busy} onClick={() => buyPack(p.id)}>خرید</Button>
                {!p.purchasable && p.unavailableReasonFa && <span className="ac-cap">{p.unavailableReasonFa}</span>}
              </Card>
            ))}
          </div>
          <p className="ac-note"><Icon name="info" size="sm" />سکه فقط پس از تأیید پرداخت روی سرور به حساب شما اضافه می‌شود. سابقه پرداخت در <Link to="/plans">اشتراک</Link>.</p>
        </section>
      )}

      <div className="ac-stack" style={{ gap: 24 }}>
        <Card flush aria-labelledby="earn-h">
          <div className="ac-sec__head"><h2 id="earn-h" className="ac-h3" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="sparkles" />راه‌های گرفتن سکه</h2></div>
          <ul className="ac-earn">
            {d.earn.map((e) => <li key={e.labelFa}><span>{e.labelFa}</span><Coin size="sm" amount={`+${faNum(e.coins)}`} /></li>)}
          </ul>
          <p className="ac-cap ac-pad">سکهٔ بازی‌ها هم‌پای XP است: سقف روزانه و بازی پیاپی با حریف تکراری سکه را هم کم می‌کند.</p>
        </Card>

        <Card flush aria-labelledby="hist-h">
          <div className="ac-sec__head"><h2 id="hist-h" className="ac-h3">گردش سکه</h2></div>
          {d.history.length === 0
            ? <StateBlock kind="empty" title="هنوز سکه‌ای نگرفته‌اید" text="یک بازی را تا پایان کنید." action={<Button href="/games">بازی‌ها</Button>} />
            : (
              <ul className="ac-ledger">
                {d.history.map((h, i) => (
                  <li key={i}>
                    <Badge tone={h.amount > 0 ? 'success' : 'danger'}><bdi dir="ltr" className="bgv-num">{h.amount > 0 ? '+' : '−'}{faNum(Math.abs(h.amount))}</bdi></Badge>
                    <span>{h.reason}</span>
                    <span className="ac-cap" style={{ flex: 'none' }}>{jalaliDate(h.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>
    </>
  );
}
