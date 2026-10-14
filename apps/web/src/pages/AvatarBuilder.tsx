import { useMemo, useState } from 'react';
import {
  AVATAR_SLOTS, DEFAULT_AVATAR, SLOT_FA, formatAvatar, parseAvatar, slotItems, unlockFa,
  type AvatarParts, type AvatarSlot, type CosmeticItem, type Me
} from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Avatar, Badge, Banner, Button, Card, Chip, Coin, CosmeticTile, Icon, PageHead, Sheet, StateBlock } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { coinsChanged } from '../lib/coins.tsx';
import { AvatarArt, frameProps } from '../lib/bgv.tsx';
import { faNum } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

interface Owned { unlocked: string[]; balance: number; level: number; achievements: Record<string, string> }
/** Colour slots show swatches; the rest show the avatar wearing the item. */
const COLOUR: Partial<Record<AvatarSlot, true>> = { s: true, hc: true, oc: true };
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;

/** Avatar builder: try anything on (locked items too, like a fitting room), buy coin items in place, save what you own. */
export function AvatarBuilder() {
  usePageTitle('ساخت آواتار');
  const { me, setMe } = useSession();
  const toast = useToast();
  const owned = useApi<Owned>(me ? '/me/cosmetics' : null);
  const [parts, setParts] = useState<AvatarParts>(() => parseAvatar(me?.avatarKey ?? '') ?? parseAvatar(DEFAULT_AVATAR)!);
  const [slot, setSlot] = useState<AvatarSlot>('h');
  const [busy, setBusy] = useState<string>();
  const [sheet, setSheet] = useState(false);
  const unlocked = useMemo(() => new Set(owned.data?.unlocked ?? []), [owned.data]);

  if (!me) return <StateBlock kind="denied" title="برای ساخت آواتار وارد شوید" action={<Button variant="primary" href="/login?next=/me/avatar">ورود</Button>} />;
  if (owned.error) return <StateBlock kind="error" title="آیتم‌ها دریافت نشد" action={<Button variant="primary" onClick={owned.reload}>تلاش دوباره</Button>} />;
  if (!owned.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const d = owned.data;

  const key = formatAvatar(parts);
  const lockedNow = AVATAR_SLOTS.map((s) => slotItems(s)[parts[s]]!).filter((c) => !unlocked.has(c.key));
  const items = slotItems(slot);
  const current = items[parts[slot]]!;
  const reason = (c: CosmeticItem) => unlockFa(c.unlock, (k) => d.achievements[k]);
  const priced = 'coins' in current.unlock ? current.unlock.coins : null;
  const tryingLocked = !unlocked.has(current.key);

  const buy = async (c: CosmeticItem) => {
    setBusy(c.key);
    try {
      await api('/cosmetics/buy', { method: 'POST', body: { item: c.key, requestId: crypto.randomUUID() } });
      toast('success', `«${c.nameFa}» خریده شد.`);
      coinsChanged();
      owned.reload();
      setSheet(false);
    } catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'خرید انجام نشد.'); }
    finally { setBusy(undefined); }
  };
  const save = async () => {
    setBusy('save');
    try { setMe(await api<Me>('/me/profile', { method: 'PATCH', body: { avatarKey: key } })); toast('success', 'آواتار ذخیره شد.'); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'ذخیره انجام نشد.'); }
    finally { setBusy(undefined); }
  };
  const randomize = () => setParts(Object.fromEntries(AVATAR_SLOTS.map((s) => [s, pick(slotItems(s).filter((c) => unlocked.has(c.key))).i])) as AvatarParts);
  const reset = () => setParts(parseAvatar(me.avatarKey) ?? parseAvatar(DEFAULT_AVATAR)!);

  return (
    <>
      <PageHead title="ساخت آواتار" sub="هر چیزی را امتحان کنید؛ آیتم‌های قفل با سکه یا با پیشرفت در بازی باز می‌شوند."
        actions={<>
          <Button variant="secondary" href="/coins" icon="plus">خرید سکه</Button>
          <Button variant="primary" icon="check" loading={busy === 'save'} disabled={lockedNow.length > 0 || !!busy || key === me.avatarKey} onClick={save}>ذخیرهٔ آواتار</Button>
        </>} />
      <div className="pf-builder">
        <Card aria-label="پیش‌نمایش">
          <div className="pf-preview">
            <div className="pf-preview__art">
              <Avatar size="2xl" name={`آواتار ${me.displayName}`} {...frameProps(key)}><AvatarArt avatarKey={key} /></Avatar>
            </div>
            {key !== me.avatarKey && <Badge tone="warning" icon="eye">در حال امتحان</Badge>}
            <div className="bgv-row">
              <Button variant="secondary" icon="refresh-cw" onClick={randomize}>تصادفی</Button>
              <Button variant="secondary" icon="rotate-ccw" disabled={key === me.avatarKey} onClick={reset}>برگرداندن</Button>
            </div>
            {lockedNow.length > 0 && <div role="status"><Banner tone="warning" icon="lock"
              title={`${faNum(lockedNow.length)} آیتم امتحانی هنوز باز نشده`}
              text={`برای ذخیرهٔ آواتار، آیتم‌های در حال امتحان باید باز شوند: ${lockedNow.map((c) => `${c.nameFa} (${reason(c)})`).join('، ')}`} /></div>}
            <dl className="pf-sum" aria-label="لایه‌های آواتار">
              {AVATAR_SLOTS.map((s) => {
                const c = slotItems(s)[parts[s]]!;
                return <div key={s}><dt>{SLOT_FA[s]}</dt><dd>{c.nameFa}{!unlocked.has(c.key) && <Icon name="lock" size="sm" />}</dd></div>;
              })}
            </dl>
          </div>
        </Card>

        <Card aria-label="آیتم‌ها">
          <div className="bgv-stack">
            <div className="bgv-row" role="group" aria-label="بخش‌ها">
              {AVATAR_SLOTS.map((s) => <Chip key={s} selected={slot === s} onClick={() => setSlot(s)}>{SLOT_FA[s]}</Chip>)}
            </div>
            <div className="pf-tiles" role="radiogroup" aria-label={SLOT_FA[slot]}>
              {items.map((c) => {
                const locked = !unlocked.has(c.key);
                const on = parts[slot] === c.i;
                return (
                  <CosmeticTile key={c.key} {...({ role: 'radio' } as object)} aria-checked={on} aria-pressed={undefined} name={c.nameFa}
                    state={on ? (locked ? 'trying' : 'equipped') : locked ? 'locked' : 'owned'}
                    price={locked && 'coins' in c.unlock ? c.unlock.coins : undefined} lockText={locked ? reason(c) : undefined}
                    art={COLOUR[slot]
                      ? <span className="pf-sw" style={{ '--sw': c.color } as React.CSSProperties} />
                      : <Avatar size="lg"><AvatarArt avatarKey={formatAvatar({ ...parts, [slot]: c.i })} frame={slot === 'fr'} /></Avatar>}
                    onClick={() => setParts({ ...parts, [slot]: c.i })} />
                );
              })}
            </div>
            {tryingLocked && (
              <Banner tone="info" icon="lock"
                action={priced !== null && (
                  <Button size="sm" variant="primary" loading={busy === current.key} disabled={!!busy || d.balance < priced} onClick={() => setSheet(true)}>
                    {d.balance < priced ? `${faNum(priced - d.balance)} سکه کم دارید` : `خرید با ${faNum(priced)} سکه`}
                  </Button>
                )}>
                <span>«{current.nameFa}» قفل است: {reason(current)}</span>
              </Banner>
            )}
          </div>
        </Card>
      </div>

      {sheet && priced !== null && (
        <div className="pf-sheet-host">
          <div className="bgv-scrim" onClick={() => setSheet(false)} />
          <Sheet title={`خرید «${current.nameFa}»`} onClose={() => setSheet(false)}
            footer={<>
              <Button variant="primary" block loading={busy === current.key} disabled={!!busy || d.balance < priced} onClick={() => buy(current)}>خرید و پوشیدن</Button>
              <Button variant="secondary" block onClick={() => setSheet(false)}>انصراف</Button>
            </>}>
            <div className="bgv-stack">
              <span className="t-caption bgv-muted">{SLOT_FA[slot]}، لایهٔ آواتار</span>
              <div className="pf-facts">
                <div><span className="t-caption bgv-muted">قیمت</span><Coin amount={priced} /></div>
                <div><span className="t-caption bgv-muted">موجودی</span><Coin amount={d.balance} /></div>
                <div><span className="t-caption bgv-muted">پس از خرید</span><Coin amount={d.balance - priced} /></div>
              </div>
              <Banner tone="info" text="هر آیتم سکه‌ای یک بار خریده می‌شود و برای همیشه در کمد شما می‌ماند. هیچ آیتمی در بازی امتیاز یا برتری نمی‌دهد." />
            </div>
          </Sheet>
        </div>
      )}
    </>
  );
}
