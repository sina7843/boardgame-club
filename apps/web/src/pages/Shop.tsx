import { useState } from 'react';
import { SLOT_FA, type CosmeticItem } from '@bg/contracts';
import { Badge, Banner, Button, Checkbox, Chip, Coin, CosmeticTile, Icon, PageHead, Rarity, Sheet, StateBlock } from '@bg/ui/bgv';
import { faNum } from '../lib/format.ts';
import { ItemArt, SHOP_ICON, SHOP_ITEMS, SHOP_SLOTS, useWardrobe } from '../lib/cosmeticItems.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';

/** Cosmetic shop: purely visual items, bought with coins; premium/level/league/achievement items show why they are locked. */
export function ShopPage() {
  usePageTitle('فروشگاه کازمتیک');
  const w = useWardrobe();
  const [slot, setSlot] = useState<(typeof SHOP_SLOTS)[number] | 'all'>('all');
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState<CosmeticItem>();
  const [busy, setBusy] = useState(false);

  if (!w.me) return <StateBlock kind="denied" title="برای دیدن فروشگاه وارد شوید" action={<Button variant="primary" href="/login?next=/shop">ورود</Button>} />;
  if (w.owned.error) return <StateBlock kind="error" title="فروشگاه دریافت نشد" action={<Button variant="primary" onClick={w.owned.reload}>تلاش دوباره</Button>} />;
  if (!w.d) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const d = w.d;
  const all = SHOP_ITEMS.filter((c) => slot === 'all' || c.slot === slot);
  const items = all.filter((c) => !missing || !w.unlocked.has(c.key));
  const ownedCount = all.filter((c) => w.unlocked.has(c.key)).length;
  const price = (c: CosmeticItem) => ('coins' in c.unlock ? c.unlock.coins : null);

  const act = async (fn: () => Promise<boolean>) => { setBusy(true); try { if (await fn()) setOpen(undefined); } finally { setBusy(false); } };

  return (
    <>
      <PageTabs group="wallet" />
      <PageHead title="فروشگاه کازمتیک" sub="همه‌چیز فقط ظاهری است؛ هیچ آیتمی در بازی امتیاز یا برتری نمی‌دهد."
        actions={<><Coin amount={d.balance} unit /><Button variant="secondary" icon="plus" href="/coins">خرید سکه</Button></>} />

      <div className="pf-cats bgv-scroll-x" role="group" aria-label="دسته‌ها">
        <Chip selected={slot === 'all'} icon="layout-grid" onClick={() => setSlot('all')}>همه</Chip>
        {SHOP_SLOTS.map((s) => <Chip key={s} selected={slot === s} icon={SHOP_ICON[s]} onClick={() => setSlot(s)}>{SLOT_FA[s]}</Chip>)}
        <Chip href="/me/avatar" icon="palette">لایه‌های آواتار</Chip>
      </div>

      <div className="pf-shopbar">
        <span className="t-body-sm bgv-muted">{faNum(all.length)} آیتم<span className="bgv-sep" />{faNum(ownedCount)} آیتم را دارید</span>
        <Checkbox checked={missing} onChange={(e) => setMissing(e.target.checked)} label="فقط آنچه ندارم" />
      </div>

      {items.length === 0
        ? <StateBlock kind="empty" title="آیتمی پیدا نشد" text="همهٔ آیتم‌های این دسته را دارید." />
        : (
          <div className="pf-tiles pf-tiles--shop">
            {items.map((c) => {
              const st = w.stateOf(c);
              const p = price(c);
              return (
                <CosmeticTile key={c.key} name={c.nameFa} state={st} rarity={w.rarity(c)} premium={'premium' in c.unlock}
                  price={st === 'locked' && p !== null ? p : undefined} lockText={st === 'locked' ? w.reason(c) : undefined}
                  art={<ItemArt item={c} me={w.me!} />} onClick={() => setOpen(c)} />
              );
            })}
          </div>
        )}

      {open && (() => {
        const c = open;
        const st = w.stateOf(c);
        const p = price(c);
        const short = p !== null ? Math.max(0, p - d.balance) : 0;
        return (
          <div className="pf-sheet-host">
            <div className="bgv-scrim" onClick={() => setOpen(undefined)} />
            <Sheet title={c.nameFa} onClose={() => setOpen(undefined)}
              footer={st === 'locked'
                ? (p !== null
                  ? <>
                    <Button variant="primary" block loading={busy} disabled={busy || short > 0} onClick={() => act(async () => (await w.buy(c)) && (await w.equip(c)))}>
                      {short > 0 ? `${faNum(short)} سکه کم دارید` : `خرید و پوشیدن با ${faNum(p)} سکه`}
                    </Button>
                    {short > 0 && <Button variant="secondary" block href="/coins">خرید سکه</Button>}
                  </>
                  : <Button variant="secondary" block disabled icon="lock">{w.reason(c)}</Button>)
                : st === 'equipped' ? <Button variant="secondary" block disabled icon="check">در حال استفاده</Button>
                  : <Button variant="primary" block loading={busy} disabled={busy} onClick={() => act(() => w.equip(c))}>پوشیدن</Button>}>
              <div className="bgv-stack">
                <div className="pf-itemhero"><ItemArt item={c} me={w.me!} size="lg" /></div>
                <div className="bgv-row">
                  <Rarity level={w.rarity(c)} />
                  <span className="t-caption bgv-muted">{w.kindFa(c)}</span>
                  {'premium' in c.unlock && <Badge tone="premium" size="sm" icon="crown">ویژهٔ اشتراک</Badge>}
                </div>
                {p !== null && (
                  <div className="pf-facts">
                    <div><span className="t-caption bgv-muted">قیمت</span><Coin amount={p} /></div>
                    <div><span className="t-caption bgv-muted">موجودی</span><Coin amount={d.balance} /></div>
                    <div><span className="t-caption bgv-muted">پس از خرید</span><Coin amount={Math.max(0, d.balance - p)} /></div>
                  </div>
                )}
                {st === 'locked' && p === null && <Banner tone="info" icon="lock" text={`این آیتم فروخته نمی‌شود: ${w.reason(c)}`} />}
                {st !== 'locked' && <span className="t-body-sm bgv-muted"><Icon name="check" size="sm" /> این آیتم را دارید.</span>}
                <Banner tone="info" text="هر آیتم یک بار خریده می‌شود و برای همیشه در کمد شما می‌ماند. هیچ آیتمی در بازی امتیاز یا برتری نمی‌دهد." />
              </div>
            </Sheet>
          </div>
        );
      })()}
    </>
  );
}
