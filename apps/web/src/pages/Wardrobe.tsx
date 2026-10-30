import { useState } from 'react';
import { MAX_EMOTE_SLOTS, SLOT_FA } from '@bg/contracts';
import { Badge, Breadcrumbs, Button, Card, Chip, CosmeticTile, Icon, PageHead, StateBlock, TextField } from '@bg/ui/bgv';
import { faNum } from '../lib/format.ts';
import { ItemArt, SHOP_ICON, SHOP_ITEMS, SHOP_SLOTS, useWardrobe } from '../lib/cosmeticItems.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';

const PLURAL: Partial<Record<string, string>> = { fr: 'قاب‌ها', t: 'لقب‌ها', bn: 'بنرهای پروفایل', em: 'اموت‌ها' };

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
      <PageTabs group="shop" />
      <Breadcrumbs className="app-hide-phone" items={[{ label: 'پروفایل من', href: '/me/profile' }, { label: 'کمد من' }]} />
      <PageHead title="کمد من" sub={`${faNum(mine.length)} آیتم از ${faNum(SHOP_ITEMS.length)}. هر آیتم را همین‌جا بپوشید؛ برای دیدن همه با هم به استودیو پروفایل بروید.`}
        actions={<>
          <TextField icon="search" type="search" aria-label="جستجو در کمد" placeholder="جستجو در کمد" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button variant="secondary" icon="palette" href="/me/studio">استودیو پروفایل</Button><Button variant="secondary" icon="shopping-bag" href="/shop">فروشگاه</Button>
        </>} />
      <div className="pf-cats bgv-scroll-x" role="group" aria-label="دسته‌ها">
        <Chip selected={slot === 'all'} icon="layout-grid" onClick={() => setSlot('all')}>همه {faNum(mine.length)}</Chip>
        {SHOP_SLOTS.map((s) => <Chip key={s} selected={slot === s} icon={SHOP_ICON[s]} onClick={() => setSlot(s)}>{SLOT_FA[s]} {faNum(mine.filter((c) => c.slot === s).length)}</Chip>)}
      </div>
      <div className="pf-wgrid">
      {slots.map((s) => {
        const items = mine.filter((c) => c.slot === s && match(c.nameFa));
        const total = SHOP_ITEMS.filter((c) => c.slot === s).length;
        return (
          <Card key={s} className={`pf-w--${s}`} title={PLURAL[s] ?? SLOT_FA[s]} aria-label={PLURAL[s] ?? SLOT_FA[s]} actions={<span className="t-caption bgv-muted">{faNum(items.length)} آیتم</span>}>
            {items.length === 0
              ? <StateBlock kind="empty" title="چیزی پیدا نشد" action={<Button variant="secondary" href="/shop">دیدن فروشگاه</Button>} />
              : (
                s === 't' ? (
                  <ul className="pf-titles">{items.map((c) => (
                    <li key={c.key}>
                      <span className="ac-row__text"><b>{c.nameFa}</b><span>{w.reason(c)}</span></span>
                      {w.isEquipped(c) ? <Badge tone="you" size="sm" icon="check">پوشیده</Badge>
                        : <Button size="sm" variant="secondary" loading={busy === c.key} onClick={async () => { setBusy(c.key); try { await w.equip(c); } finally { setBusy(undefined); } }}>بپوش</Button>}
                    </li>))}</ul>
                ) :
                <div className={`pf-tiles pf-tiles--${s}`}>
                  {items.map((c) => {
                    // Emotes are not worn one at a time: a tap puts one in a free slot or takes it out (four slots at the table).
                    if (s === 'em') {
                      const at = w.d!.loadout.emotes.indexOf(c.key);
                      const full = at < 0 && w.d!.loadout.emotes.length >= MAX_EMOTE_SLOTS;
                      return (
                        <button key={c.key} type="button" className={`bgv-cosm${at >= 0 ? ' is-equipped' : ''}`} aria-pressed={at >= 0} disabled={full}
                          onClick={() => void w.saveLoadout({ ...w.d!.loadout, emotes: at >= 0 ? w.d!.loadout.emotes.filter((k) => k !== c.key) : [...w.d!.loadout.emotes, c.key] })}>
                          <span className="bgv-cosm__art"><ItemArt item={c} me={w.me!} /></span>
                          <span className="bgv-cosm__name">{c.nameFa}</span>
                          <span className="bgv-cosm__state">{at >= 0 ? `اسلات ${faNum(at + 1)}` : 'آزاد'}</span>
                        </button>
                      );
                    }
                    return (
                      <CosmeticTile key={c.key} name={c.nameFa} state={busy === c.key ? 'trying' : w.stateOf(c) === 'equipped' ? 'equipped' : 'owned'}
                        art={<ItemArt item={c} me={w.me!} />}
                        onClick={async () => { if (w.isEquipped(c)) return; setBusy(c.key); try { await w.equip(c); } finally { setBusy(undefined); } }} />
                    );
                  })}
                  {s === 'fr' && total > items.length && !q && (
                    <a className="bgv-cosm pf-moretile" href="/shop"><span className="bgv-cosm__art"><Icon name="shopping-bag" /></span><b className="bgv-cosm__name">قاب‌های بیشتر</b><span className="bgv-cosm__state">{faNum(total - items.length)} قاب دیگر</span></a>
                  )}
                </div>
              )}
            {s === 'em' && <p className="t-caption bgv-muted" style={{ margin: 'var(--space-3) 0 0' }}>{faNum(MAX_EMOTE_SLOTS)} اموت در اسلات‌ها سر میز در دسترس‌اند؛ برای جابه‌جایی روی هر اموت بزنید.</p>}
          </Card>
        );
      })}
      </div>
      <Card title="رنگ صندلی محبوب" aria-label="رنگ صندلی محبوب">
        <p className="t-body-sm bgv-muted" style={{ marginBlockStart: 0 }}>سر میز صندلی خودتان را با این رنگ می‌بینید (بقیه رنگ صندلی شما را طبق جای نشستن می‌بینند).</p>
        <div className="pf-seatcolors" role="radiogroup" aria-label="رنگ صندلی">
          <button type="button" role="radio" aria-checked={w.d.loadout.seatColor === null} className="pf-seatcolor pf-seatcolor--none"
            onClick={() => void w.saveLoadout({ ...w.d!.loadout, seatColor: null })}>پیش‌فرض</button>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" role="radio" aria-checked={w.d!.loadout.seatColor === n} aria-label={`رنگ ${faNum(n)}`}
              className="pf-seatcolor" style={{ '--c': `var(--seat-${n})` } as React.CSSProperties} onClick={() => void w.saveLoadout({ ...w.d!.loadout, seatColor: n })} />
          ))}
        </div>
      </Card>
    </>
  );
}
