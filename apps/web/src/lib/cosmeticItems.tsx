// Shared by the shop, the wardrobe and the studio: how a catalogue item looks, whether I own / wear it, and how to buy / wear it.
import { useCallback, useMemo, type CSSProperties } from 'react';
import {
  COSMETICS, DEFAULT_AVATAR, KIND_FA, SLOT_FA, formatAvatar, kindOfKey, parseAvatar, rarityOf, unlockFa,
  type CosmeticItem, type CosmeticSlot, type EquippedCosmetics, type Me
} from '@bg/contracts';
import { useToast } from '@bg/ui';
import { Avatar, CardBack, Icon, type CosmeticTileProps } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from './api.ts';
import { coinsChanged } from './coins.tsx';
import { AvatarArt } from './bgv.tsx';
import { useSession } from './session.tsx';

export interface Owned { unlocked: string[]; balance: number; level: number; achievements: Record<string, string>; equipped: EquippedCosmetics; loadout: { emotes: string[]; seatColor: number | null } }

/** Slots the shop sells and the wardrobe lists (the other avatar layers live in the avatar builder). */
export const SHOP_SLOTS = ['fr', 't', 'bn', 'cb', 'bk', 'em', 'bu', 'sr'] as const satisfies readonly CosmeticSlot[];
export const SHOP_ICON: Record<(typeof SHOP_SLOTS)[number], string> = { fr: 'user', t: 'badge-check', bn: 'image', cb: 'layers', bk: 'layout-grid', em: 'smile', bu: 'message-circle', sr: 'armchair' };
export const SHOP_ITEMS: readonly CosmeticItem[] = COSMETICS.filter((c) => (SHOP_SLOTS as readonly string[]).includes(c.slot));
export const slotTitle = (s: CosmeticSlot) => SLOT_FA[s];

const vars = (it: CosmeticItem) => ({ '--c1': it.art?.colors[0], '--c2': it.art?.colors[1] ?? it.art?.colors[0], '--c3': it.art?.colors[2] ?? it.art?.colors[0] }) as CSSProperties;
const myParts = (me: Pick<Me, 'avatarKey'>) => parseAvatar(me.avatarKey) ?? parseAvatar(DEFAULT_AVATAR)!;

/** Preview art of one item (purely visual: colours and patterns come from the catalogue data). */
export function ItemArt({ item, me, size = 'md' }: { item: CosmeticItem; me: Pick<Me, 'avatarKey'>; size?: 'md' | 'lg' }) {
  const avatar = (key: string) => <AvatarArt avatarKey={key} />;
  switch (item.slot) {
    case 'fr': return <Avatar size={size === 'lg' ? 'xl' : 'lg'}><AvatarArt avatarKey={formatAvatar({ ...myParts(me), fr: item.i })} frame /></Avatar>;
    case 't': return <span className="pf-titlechip"><span className="t-micro bgv-muted">لقب</span><span className="t-label">{item.nameFa}</span></span>;
    case 'bn': return <span className="pf-bnsw" style={{ '--bn': item.css } as CSSProperties} />;
    case 'cb': return <CardBack width={size === 'lg' ? 96 : 44} label={item.nameFa} color={item.art?.colors[0]}><span className={`pf-pat pf-pat--${item.art?.pattern}`} style={vars(item)} /></CardBack>;
    case 'bk': return <span className={`pf-skin pf-pat pf-pat--${item.art?.pattern}`} style={vars(item)} />;
    case 'em': return <span className="pf-emote" style={vars(item)}><Icon name={item.art?.glyph ?? 'smile'} size={size === 'lg' ? 40 : 28} /></span>;
    case 'bu': return <span className={`pf-bubble pf-pat pf-pat--${item.art?.pattern}`} style={vars(item)}>کی پایه‌ست؟</span>;
    case 'sr': return <span className={`pf-ring pf-pat pf-pat--${item.art?.pattern}`} style={vars(item)}><Avatar size={size === 'lg' ? 'xl' : 'md'}>{avatar(me.avatarKey)}</Avatar></span>;
    default: return null;
  }
}

/** Ownership, equip and purchase for the signed-in player. */
export function useWardrobe() {
  const { me, setMe } = useSession();
  const toast = useToast();
  const owned = useApi<Owned>(me ? '/me/cosmetics' : null);
  const unlocked = useMemo(() => new Set(owned.data?.unlocked ?? []), [owned.data]);
  // An older API (mid-deploy) may not send `loadout`; default it so pages never crash on it.
  const d = useMemo(() => owned.data && { ...owned.data, loadout: owned.data.loadout ?? { emotes: [], seatColor: null } }, [owned.data]);

  const isEquipped = useCallback((c: CosmeticItem): boolean => {
    if (!me || !d) return false;
    if (c.slot === 'fr') return myParts(me).fr === c.i;
    if (c.slot === 't') return (me.titleKey ?? 't.0') === c.key;
    if (c.slot === 'bn') return (me.bannerKey ?? 'bn.0') === c.key;
    const kind = kindOfKey(c.key);
    return !!kind && (d.equipped[kind] ?? `${c.slot}.0`) === c.key;
  }, [me, d]);

  const stateOf = (c: CosmeticItem): NonNullable<CosmeticTileProps['state']> => isEquipped(c) ? 'equipped' : unlocked.has(c.key) ? 'owned' : 'locked';
  const reason = (c: CosmeticItem) => unlockFa(c.unlock, (k) => d?.achievements[k]);
  const rarity = rarityOf;

  const fail = (e: unknown, fallback: string) => toast('error', e instanceof ApiFailure ? e.messageFa : fallback);
  const equip = async (c: CosmeticItem) => {
    if (!me) return false;
    try {
      if (c.slot === 'fr') setMe(await api<Me>('/me/profile', { method: 'PATCH', body: { avatarKey: formatAvatar({ ...myParts(me), fr: c.i }) } }));
      else if (c.slot === 't') setMe(await api<Me>('/me/profile', { method: 'PATCH', body: { titleKey: c.key } }));
      else if (c.slot === 'bn') setMe(await api<Me>('/me/profile', { method: 'PATCH', body: { bannerKey: c.key } }));
      else await api('/me/cosmetics/equip', { method: 'PATCH', body: { kind: kindOfKey(c.key), key: c.key } });
      owned.reload();
      toast('success', `«${c.nameFa}» پوشیده شد.`);
      return true;
    } catch (e) { fail(e, 'پوشیدن انجام نشد.'); return false; }
  };
  const buy = async (c: CosmeticItem) => {
    try {
      await api('/cosmetics/buy', { method: 'POST', body: { item: c.key, requestId: crypto.randomUUID() } });
      toast('success', `«${c.nameFa}» خریده شد.`);
      coinsChanged();
      owned.reload();
      return true;
    } catch (e) { fail(e, 'خرید انجام نشد.'); return false; }
  };
  const saveLoadout = async (l: { emotes: string[]; seatColor: number | null }) => {
    try { await api('/me/cosmetics/loadout', { method: 'PUT', body: l }); owned.reload(); return true; }
    catch (e) { fail(e, 'ذخیره انجام نشد.'); return false; }
  };
  const buyBundle = async (key: string, nameFa: string) => {
    try {
      await api('/cosmetics/bundles/buy', { method: 'POST', body: { bundle: key, requestId: crypto.randomUUID() } });
      toast('success', `«${nameFa}» خریده شد.`); coinsChanged(); owned.reload(); return true;
    } catch (e) { fail(e, 'خرید انجام نشد.'); return false; }
  };
  const gift = async (c: CosmeticItem, userId: string, name: string) => {
    try {
      await api('/cosmetics/gift', { method: 'POST', body: { item: c.key, userId, requestId: crypto.randomUUID() } });
      toast('success', `«${c.nameFa}» برای ${name} هدیه رفت.`); coinsChanged(); owned.reload(); return true;
    } catch (e) { fail(e, 'هدیه فرستاده نشد.'); return false; }
  };
  return { me, owned, d, unlocked, stateOf, isEquipped, reason, rarity, equip, buy, buyBundle, gift, saveLoadout, kindFa: (c: CosmeticItem) => { const k = kindOfKey(c.key); return k ? KIND_FA[k] : SLOT_FA[c.slot]; } };
}
