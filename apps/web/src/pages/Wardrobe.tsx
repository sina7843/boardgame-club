import { useState } from 'react';
import { SLOT_FA } from '@bg/contracts';
import { Button, Card, Chip, CosmeticTile, PageHead, StateBlock, TextField } from '@bg/ui/bgv';
import { faNum } from '../lib/format.ts';
import { ItemArt, SHOP_ICON, SHOP_ITEMS, SHOP_SLOTS, useWardrobe } from '../lib/cosmeticItems.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';

/** Wardrobe: everything I can wear, per kind; one item per kind is worn at a time. */
export function WardrobePage() {
  usePageTitle('کمد من');
  const w = useWardrobe();
  const [slot, setSlot] = useState<(typeof SHOP_SLOTS)[number] | 'all'>('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string>();

  if (!w.me) return <StateBlock kind="denied" title="برای دیدن کمد وارد شوید" action={<Button variant="primary" href="/login?next=/me/wardrobe">ورود</Button>} />;
  if (w.owned.error) return <StateBlock kind="error" title="کمد دریافت نشد" action={<Button variant="primary" onClick={w.owned.reload}>تلاش دوباره</Button>} />;
  if (!w.d) return <StateBlock kind="loading" title="در حال بارگذاری…" />;

  const mine = SHOP_ITEMS.filter((c) => w.unlocked.has(c.key));
  const match = (name: string) => !q.trim() || name.includes(q.trim());
  const slots = SHOP_SLOTS.filter((s) => slot === 'all' || s === slot);

  return (
    <>
      <PageTabs group="wallet" />
      <PageHead title="کمد من" sub={`${faNum(mine.length)} آیتم از ${faNum(SHOP_ITEMS.length)}. هر آیتم را همین‌جا بپوشید؛ برای دیدن همه با هم به استودیو پروفایل بروید.`}
        actions={<><Button variant="secondary" icon="palette" href="/me/studio">استودیو پروفایل</Button><Button variant="secondary" icon="shopping-bag" href="/shop">فروشگاه</Button></>} />
      <TextField label="جستجو در کمد" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pf-cats bgv-scroll-x" role="group" aria-label="دسته‌ها">
        <Chip selected={slot === 'all'} icon="layout-grid" onClick={() => setSlot('all')}>همه ({faNum(mine.length)})</Chip>
        {SHOP_SLOTS.map((s) => <Chip key={s} selected={slot === s} icon={SHOP_ICON[s]} onClick={() => setSlot(s)}>{SLOT_FA[s]} ({faNum(mine.filter((c) => c.slot === s).length)})</Chip>)}
      </div>
      {slots.map((s) => {
        const items = mine.filter((c) => c.slot === s && match(c.nameFa));
        const total = SHOP_ITEMS.filter((c) => c.slot === s).length;
        return (
          <Card key={s} title={SLOT_FA[s]} aria-label={SLOT_FA[s]} actions={<span className="t-caption bgv-muted">{faNum(items.length)} آیتم</span>}>
            {items.length === 0
              ? <StateBlock kind="empty" title="چیزی پیدا نشد" action={<Button variant="secondary" href="/shop">دیدن فروشگاه</Button>} />
              : (
                <div className="pf-tiles">
                  {items.map((c) => (
                    <CosmeticTile key={c.key} name={c.nameFa} state={busy === c.key ? 'trying' : w.stateOf(c) === 'equipped' ? 'equipped' : 'owned'} rarity={w.rarity(c)}
                      art={<ItemArt item={c} me={w.me!} />}
                      onClick={async () => { if (w.isEquipped(c)) return; setBusy(c.key); try { await w.equip(c); } finally { setBusy(undefined); } }} />
                  ))}
                </div>
              )}
            {items.length > 0 && total > items.length && !q && <p className="t-caption bgv-muted">{faNum(total - items.length)} آیتم دیگر در فروشگاه یا با پیشرفت باز می‌شود.</p>}
          </Card>
        );
      })}
    </>
  );
}
