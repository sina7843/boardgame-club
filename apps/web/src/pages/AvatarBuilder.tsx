import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Lock, Shuffle } from 'lucide-react';
import {
  AVATAR_SLOTS, DEFAULT_AVATAR, SLOT_FA, formatAvatar, parseAvatar, slotItems, unlockFa,
  type AvatarParts, type AvatarSlot, type CosmeticItem, type Me
} from '@bg/contracts';
import { Avatar, Button, StateBlock, buttonClass, cn, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { CoinMark, coinsChanged } from '../lib/coins.tsx';
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
  const unlocked = useMemo(() => new Set(owned.data?.unlocked ?? []), [owned.data]);

  if (!me) return <StateBlock kind="denied" title="برای ساخت آواتار وارد شوید" action={<Link className={buttonClass('primary', 'md')} to="/login?next=/me/avatar">ورود</Link>} />;
  if (owned.error) return <StateBlock kind="error" title="آیتم‌ها دریافت نشد" action={<Button onClick={owned.reload}>تلاش دوباره</Button>} />;
  if (!owned.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;
  const d = owned.data;

  const key = formatAvatar(parts);
  const lockedNow = AVATAR_SLOTS.map((s) => slotItems(s)[parts[s]]!).filter((c) => !unlocked.has(c.key));
  const items = slotItems(slot);
  const current = items[parts[slot]]!;
  const reason = (c: CosmeticItem) => unlockFa(c.unlock, (k) => d.achievements[k]);

  const buy = async (c: CosmeticItem) => {
    setBusy(c.key);
    try {
      await api('/cosmetics/buy', { method: 'POST', body: { item: c.key, requestId: crypto.randomUUID() } });
      toast('success', `«${c.nameFa}» خریده شد.`);
      coinsChanged();
      owned.reload();
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

  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">ساخت آواتار</h1><p className="page-sub">هر چیزی را امتحان کنید؛ آیتم‌های قفل با سکه یا با پیشرفت در بازی باز می‌شوند.</p></div>
        <span className="inline-flex items-center gap-1.5 rounded-control bg-secondary px-3 py-1 font-bold"><CoinMark className="size-5" /><span className="num">{faNum(d.balance)}</span></span>
      </div>
      <div className="avatar-builder">
        <section className="avatar-builder__stage" aria-label="پیش‌نمایش">
          <Avatar avatarKey={key} name={me.displayName} size={176} />
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={randomize}><Shuffle className="size-4" aria-hidden />تصادفی</Button>
            <Button busy={busy === 'save'} disabled={lockedNow.length > 0 || !!busy || key === me.avatarKey} onClick={save}>ذخیره آواتار</Button>
          </div>
          {lockedNow.length > 0 && <p className="m-0 text-center text-sm text-muted-foreground" role="status">برای ذخیره، این‌ها باید باز شوند: {lockedNow.map((c) => `${c.nameFa} (${reason(c)})`).join('، ')}</p>}
        </section>

        <section className="avatar-builder__panel" aria-label="آیتم‌ها">
          <div className="avatar-builder__slots" role="group" aria-label="بخش‌ها">
            {AVATAR_SLOTS.map((s) => (
              <button key={s} type="button" aria-pressed={slot === s} className={cn('chip', slot === s && 'chip--on')} onClick={() => setSlot(s)}>{SLOT_FA[s]}</button>
            ))}
          </div>
          <div className="avatar-builder__grid" role="radiogroup" aria-label={SLOT_FA[slot]}>
            {items.map((c) => {
              const locked = !unlocked.has(c.key);
              return (
                <button key={c.key} type="button" role="radio" aria-checked={parts[slot] === c.i} title={locked ? `${c.nameFa} — ${reason(c)}` : c.nameFa}
                  className={cn('avatar-item', parts[slot] === c.i && 'avatar-item--on', locked && 'avatar-item--locked')} onClick={() => setParts({ ...parts, [slot]: c.i })}>
                  {COLOUR[slot] ? <span className="avatar-item__swatch" style={{ background: c.color }} /> : <Avatar avatarKey={formatAvatar({ ...parts, [slot]: c.i })} name={c.nameFa} size={64} />}
                  <span className="avatar-item__name">{c.nameFa}</span>
                  {locked && <span className="avatar-item__lock"><Lock className="size-3" aria-hidden />{'coins' in c.unlock ? faNum(c.unlock.coins) : reason(c)}</span>}
                </button>
              );
            })}
          </div>
          {!unlocked.has(current.key) && (
            <div className="banner banner--info flex flex-wrap items-center justify-between gap-3" role="status">
              <span>«{current.nameFa}» قفل است: {reason(current)}</span>
              {'coins' in current.unlock && (
                <Button size="sm" busy={busy === current.key} disabled={!!busy || d.balance < current.unlock.coins} onClick={() => buy(current)}>
                  {d.balance < current.unlock.coins ? `${faNum(current.unlock.coins - d.balance)} سکه کم دارید` : `خرید با ${faNum(current.unlock.coins)} سکه`}
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
