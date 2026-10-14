// Cosmetics: the avatar builder catalogue, titles and profile banners. Static code, never uploads, so the SVG is
// trusted markup. An avatar is stored as a short string (`v1:s0.f0.h1…`) in users.avatar_key, which every existing
// projection already carries. Item indexes are stored by players: lists are APPEND-ONLY, never reorder or remove.
import type { League } from './progression.ts';

export type Unlock = { free: true } | { coins: number } | { level: number } | { achievement: string } | { league: League } | { premium: true };

/** Avatar layers in string order; `t` (title) and `bn` (banner) are profile items, not avatar layers. */
export const AVATAR_SLOTS = ['s', 'f', 'h', 'hc', 'e', 'm', 'o', 'oc', 'a', 'b', 'fr'] as const;
export type AvatarSlot = (typeof AVATAR_SLOTS)[number];
/** Table cosmetics (purely visual descriptors, see `art`): each kind owns one slot prefix in the item key. */
export const ITEM_KINDS = ['cardBack', 'boardSkin', 'emote', 'chatBubble', 'seatRing'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const KIND_SLOT = { cardBack: 'cb', boardSkin: 'bk', emote: 'em', chatBubble: 'bu', seatRing: 'sr' } as const satisfies Record<ItemKind, string>;
export const KIND_FA: Record<ItemKind, string> = { cardBack: 'پشت کارت', boardSkin: 'اسکین صفحه', emote: 'اموت', chatBubble: 'حباب گفت‌وگو', seatRing: 'حلقهٔ صندلی' };
export type CosmeticSlot = AvatarSlot | 't' | 'bn' | (typeof KIND_SLOT)[ItemKind];
export const RARITIES = ['common', 'rare', 'epic', 'legend'] as const;
export type Rarity = (typeof RARITIES)[number];
export const PATTERNS = ['solid', 'dots', 'stripes', 'diamonds', 'rings', 'stars', 'waves'] as const;
export type Pattern = (typeof PATTERNS)[number];
/** Visual descriptor of a table cosmetic: 1-3 colours, a pattern name and (emotes) an icon name; the renderer decides how to draw it. */
export interface ItemArt { colors: string[]; pattern: Pattern; glyph?: string }

export const SLOT_FA: Record<CosmeticSlot, string> = {
  s: 'رنگ پوست', f: 'صورت', h: 'مو', hc: 'رنگ مو', e: 'چشم', m: 'دهان', o: 'لباس', oc: 'رنگ لباس', a: 'اکسسوری',
  b: 'پس‌زمینه', fr: 'قاب', t: 'لقب', bn: 'بنر پروفایل', cb: KIND_FA.cardBack, bk: KIND_FA.boardSkin, em: KIND_FA.emote, bu: KIND_FA.chatBubble, sr: KIND_FA.seatRing
};

export interface CosmeticItem {
  /** `${slot}.${index}`: what user_cosmetics stores. */
  key: string;
  slot: CosmeticSlot;
  i: number;
  nameFa: string;
  unlock: Unlock;
  /** Front SVG markup (viewBox 0 0 100 100); `{skin}`, `{hair}`, `{cloth}` are filled from the colour slots. */
  svg?: string;
  /** Drawn behind the body (long hair, capes). */
  back?: string;
  /** Colour slots. */
  color?: string;
  /** Banners: CSS background. */
  css?: string;
  /** Table cosmetics only. */
  art?: ItemArt;
  /** Explicit rarity; items without one get `rarityOf` (derived from the unlock). */
  rarity?: Rarity;
}

type Def = Omit<CosmeticItem, 'key' | 'slot' | 'i'>;
const FREE: Unlock = { free: true };
const coins = (n: number): Unlock => ({ coins: n });
const level = (n: number): Unlock => ({ level: n });
const ach = (key: string): Unlock => ({ achievement: key });
const league = (l: League): Unlock => ({ league: l });
const PREMIUM: Unlock = { premium: true };
const art = (pattern: Pattern, ...colors: string[]): ItemArt => ({ colors, pattern });

const INK = '#2B2B2B';
const LIP = '#7A3B2E';

const DEFS: Record<CosmeticSlot, Def[]> = {
  s: [
    { nameFa: 'روشن', unlock: FREE, color: '#F9D7C0' },
    { nameFa: 'گندمی روشن', unlock: FREE, color: '#F1C19B' },
    { nameFa: 'گندمی', unlock: FREE, color: '#DFA57A' },
    { nameFa: 'برنزه', unlock: FREE, color: '#C68650' },
    { nameFa: 'تیره', unlock: FREE, color: '#8D5A34' },
    { nameFa: 'خیلی تیره', unlock: FREE, color: '#5C3A21' }
  ],
  f: [
    { nameFa: 'گرد', unlock: FREE, svg: '<circle cx="29" cy="49" r="5" fill="{skin}"/><circle cx="71" cy="49" r="5" fill="{skin}"/><circle cx="50" cy="47" r="21" fill="{skin}"/>' },
    { nameFa: 'کشیده', unlock: FREE, svg: '<circle cx="31" cy="49" r="5" fill="{skin}"/><circle cx="69" cy="49" r="5" fill="{skin}"/><ellipse cx="50" cy="47" rx="19" ry="23" fill="{skin}"/>' },
    { nameFa: 'چهارگوش', unlock: FREE, svg: '<circle cx="29" cy="49" r="5" fill="{skin}"/><circle cx="71" cy="49" r="5" fill="{skin}"/><rect x="30" y="25" width="40" height="45" rx="14" fill="{skin}"/>' },
    { nameFa: 'تپل', unlock: FREE, svg: '<circle cx="28" cy="49" r="5" fill="{skin}"/><circle cx="72" cy="49" r="5" fill="{skin}"/><path d="M50 25C64 25 73 35 73 49C73 63 63 70 50 70S27 63 27 49C27 35 36 25 50 25Z" fill="{skin}"/><circle cx="37" cy="56" r="4" fill="#E57373" opacity=".35"/><circle cx="63" cy="56" r="4" fill="#E57373" opacity=".35"/>' }
  ],
  h: [
    { nameFa: 'بدون مو', unlock: FREE, svg: '' },
    { nameFa: 'کوتاه', unlock: FREE, svg: '<path d="M29 44C28 30 37 23 50 23S72 30 71 44C67 36 60 33 50 33S33 36 29 44Z" fill="{hair}"/>' },
    { nameFa: 'فرق کج', unlock: FREE, svg: '<path d="M28 46C26 28 38 21 52 22C66 23 74 32 72 46C70 38 66 34 62 33C52 34 40 32 34 30C31 34 29 40 28 46Z" fill="{hair}"/>' },
    { nameFa: 'سیخ‌سیخی', unlock: FREE, svg: '<path d="M29 44L30 32L35 34L37 24L43 29L47 20L52 28L57 21L60 29L66 25L66 33L71 32L71 44C66 36 58 33 50 33S34 36 29 44Z" fill="{hair}"/>' },
    { nameFa: 'فرفری', unlock: FREE, svg: '<g fill="{hair}"><circle cx="31" cy="40" r="6"/><circle cx="36" cy="31" r="7"/><circle cx="45" cy="26" r="7"/><circle cx="55" cy="26" r="7"/><circle cx="64" cy="31" r="7"/><circle cx="69" cy="40" r="6"/></g>' },
    { nameFa: 'کوتاه دخترانه', unlock: FREE, back: '<path d="M26 48C24 28 36 21 50 21S76 28 74 48V66H26Z" fill="{hair}"/>', svg: '<path d="M29 44C29 30 38 24 50 24S71 30 71 44C64 38 56 34 42 36C36 37 32 40 29 44Z" fill="{hair}"/>' },
    { nameFa: 'بلند صاف', unlock: coins(100), back: '<path d="M27 46C25 27 37 21 50 21S75 27 73 46L77 84H23Z" fill="{hair}"/>', svg: '<path d="M29 46C29 30 38 23 50 23S71 30 71 46C68 38 64 34 58 32C52 36 40 38 29 46Z" fill="{hair}"/>' },
    { nameFa: 'گوجه‌ای', unlock: coins(100), svg: '<circle cx="50" cy="18" r="8" fill="{hair}"/><path d="M29 44C28 30 37 23 50 23S72 30 71 44C67 36 60 33 50 33S33 36 29 44Z" fill="{hair}"/>' },
    { nameFa: 'دم‌اسبی', unlock: coins(120), back: '<path d="M68 34C82 36 84 58 74 70C76 56 72 46 64 40Z" fill="{hair}"/>', svg: '<path d="M28 46C26 28 38 21 52 22C66 23 74 32 72 46C70 38 66 34 62 33C52 34 40 32 34 30C31 34 29 40 28 46Z" fill="{hair}"/>' },
    { nameFa: 'موهاک', unlock: coins(150), svg: '<path d="M29 44C29 32 38 27 50 27S71 32 71 44C66 38 58 35 50 35S34 38 29 44Z" fill="{hair}" opacity=".35"/><path d="M44 34C42 24 44 14 50 9C56 14 58 24 56 34Z" fill="{hair}"/>' },
    { nameFa: 'آفرو', unlock: level(6), back: '<circle cx="50" cy="38" r="27" fill="{hair}"/>', svg: '<path d="M30 42C32 32 40 28 50 28S68 32 70 42C64 36 58 34 50 34S36 36 30 42Z" fill="{hair}"/>' },
    { nameFa: 'دو گیس', unlock: ach('hat_trick'), back: '<path d="M29 44C24 56 29 70 26 84M71 44C76 56 71 70 74 84" fill="none" stroke="{hair}" stroke-width="8" stroke-linecap="round"/>', svg: '<path d="M29 46C28 30 38 23 50 23S72 30 71 46C68 36 58 30 50 31C42 30 32 36 29 46Z" fill="{hair}"/><path d="M50 23V31" stroke="#0003" stroke-width="1.5"/>' }
  ],
  hc: [
    { nameFa: 'مشکی', unlock: FREE, color: '#2B1B12' },
    { nameFa: 'قهوه‌ای', unlock: FREE, color: '#5A3825' },
    { nameFa: 'خرمایی', unlock: FREE, color: '#8B5A2B' },
    { nameFa: 'بور', unlock: FREE, color: '#D9A441' },
    { nameFa: 'حنایی', unlock: FREE, color: '#B5462E' },
    { nameFa: 'جوگندمی', unlock: FREE, color: '#9AA0A6' },
    { nameFa: 'آبی', unlock: coins(80), color: '#4A6CF7' },
    { nameFa: 'صورتی', unlock: coins(80), color: '#E04F9A' }
  ],
  e: [
    { nameFa: 'ساده', unlock: FREE, svg: `<circle cx="42" cy="47" r="2.6" fill="${INK}"/><circle cx="58" cy="47" r="2.6" fill="${INK}"/>` },
    { nameFa: 'درشت', unlock: FREE, svg: `<g><circle cx="42" cy="47" r="4.2" fill="#fff"/><circle cx="58" cy="47" r="4.2" fill="#fff"/><circle cx="42.5" cy="47.5" r="2.5" fill="${INK}"/><circle cx="58.5" cy="47.5" r="2.5" fill="${INK}"/><circle cx="43.3" cy="46.5" r=".9" fill="#fff"/><circle cx="59.3" cy="46.5" r=".9" fill="#fff"/></g>` },
    { nameFa: 'خندان', unlock: FREE, svg: `<path d="M38 48q4-4 8 0M54 48q4-4 8 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` },
    { nameFa: 'خواب‌آلود', unlock: FREE, svg: `<path d="M38 46q4 3 8 0M54 46q4 3 8 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` },
    { nameFa: 'چشمک', unlock: coins(60), svg: `<circle cx="42" cy="47" r="2.6" fill="${INK}"/><path d="M54 48q4-4 8 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` },
    { nameFa: 'مصمم', unlock: level(3), svg: `<circle cx="42" cy="48" r="2.6" fill="${INK}"/><circle cx="58" cy="48" r="2.6" fill="${INK}"/><path d="M37 41l9 2.5M63 41l-9 2.5" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` }
  ],
  m: [
    { nameFa: 'لبخند', unlock: FREE, svg: `<path d="M44 57q6 5 12 0" fill="none" stroke="${LIP}" stroke-width="2.2" stroke-linecap="round"/>` },
    { nameFa: 'خنده', unlock: FREE, svg: `<path d="M43 56h14q-1 8-7 8t-7-8z" fill="${LIP}"/><path d="M44.5 56h11v2h-11z" fill="#fff"/>` },
    { nameFa: 'تعجب', unlock: FREE, svg: `<ellipse cx="50" cy="59" rx="2.6" ry="3.2" fill="${LIP}"/>` },
    { nameFa: 'جدی', unlock: FREE, svg: `<path d="M45 59h10" stroke="${LIP}" stroke-width="2.2" stroke-linecap="round"/>` },
    { nameFa: 'زبان', unlock: coins(60), svg: `<path d="M44 56q6 7 12 0z" fill="${LIP}"/><path d="M47.5 59.3q2.5 3.5 5 0" fill="#E57373"/>` },
    { nameFa: 'نیشخند', unlock: level(4), svg: `<path d="M44 59q7 2 12-3" fill="none" stroke="${LIP}" stroke-width="2.2" stroke-linecap="round"/>` }
  ],
  o: [
    { nameFa: 'تی‌شرت', unlock: FREE, svg: '<path d="M42 72Q50 80 58 72" fill="none" stroke="#0003" stroke-width="2"/>' },
    { nameFa: 'هودی', unlock: FREE, svg: '<path d="M34 74Q50 64 66 74L60 80Q50 74 40 80Z" fill="{cloth}" stroke="#0002"/><path d="M46 80v8M54 80v8" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>' },
    { nameFa: 'پیراهن و کراوات', unlock: FREE, svg: '<path d="M42 72L50 80L46 84L38 75ZM58 72L50 80L54 84L62 75Z" fill="#fff"/><path d="M48 80h4l2 4-4 14-4-14z" fill="#C0392B"/>' },
    { nameFa: 'کت و شلوار', unlock: coins(150), svg: '<path d="M44 72L50 88L56 72Z" fill="#fff"/><path d="M40 73L50 90L44 100H30ZM60 73L50 90L56 100H70Z" fill="#0004"/><path d="M47 74h6l-3 4z" fill="#2D3142"/>' },
    { nameFa: 'راه‌راه', unlock: coins(80), svg: '<path d="M24 86H76M17 94H83" stroke="#fff9" stroke-width="3"/>' },
    { nameFa: 'یقه هفت', unlock: FREE, svg: '<path d="M42 72L50 84L58 72Z" fill="{skin}" stroke="#0002" stroke-width="2"/>' },
    { nameFa: 'پیراهن تیم', unlock: level(3), svg: '<path d="M42 72Q50 78 58 72" fill="none" stroke="#fff" stroke-width="2.5"/><text x="50" y="97" font-size="15" font-weight="700" text-anchor="middle" fill="#fff" font-family="sans-serif">۷</text>' },
    { nameFa: 'شنل قهرمان', unlock: ach('winner_10'), back: '<path d="M18 100L30 70H70L82 100Z" fill="#C0392B"/>', svg: '<path d="M50 80l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" fill="#F2C230"/>' },
    { nameFa: 'جلیقهٔ سنتی', unlock: coins(200), svg: '<path d="M30 77Q40 72 45 74L47 100H24ZM70 77Q60 72 55 74L53 100H76Z" fill="#0005" stroke="#E6B84A" stroke-width="1.5"/>' },
    { nameFa: 'ردای شاهانه', unlock: ach('veteran'), svg: '<path d="M50 74V100" stroke="#E6B84A" stroke-width="3"/><path d="M30 76Q50 66 70 76Q60 84 50 82Q40 84 30 76Z" fill="#fff"/><g fill="#2B2B2B"><circle cx="38" cy="77" r="1"/><circle cx="50" cy="76" r="1"/><circle cx="62" cy="77" r="1"/></g>' }
  ],
  oc: [
    { nameFa: 'آبی', unlock: FREE, color: '#3B6FD8' },
    { nameFa: 'قرمز', unlock: FREE, color: '#D94848' },
    { nameFa: 'سبز', unlock: FREE, color: '#2E9E6A' },
    { nameFa: 'زرد', unlock: FREE, color: '#F2B33D' },
    { nameFa: 'بنفش', unlock: FREE, color: '#7A4FD1' },
    { nameFa: 'سرمه‌ای', unlock: FREE, color: '#2D3142' },
    { nameFa: 'نارنجی', unlock: coins(50), color: '#F28C38' },
    { nameFa: 'سفید', unlock: coins(50), color: '#E8E8E8' }
  ],
  a: [
    { nameFa: 'هیچ', unlock: FREE, svg: '' },
    { nameFa: 'عینک گرد', unlock: FREE, svg: `<g fill="none" stroke="${INK}" stroke-width="1.8"><circle cx="42" cy="47" r="6"/><circle cx="58" cy="47" r="6"/><path d="M48 47h4M36 46l-6-2M64 46l6-2"/></g>` },
    { nameFa: 'عینک آفتابی', unlock: coins(120), svg: '<path d="M34 43h32v3c0 6-3 9-8 9s-7-4-8-7c-1 3-3 7-8 7s-8-3-8-9z" fill="#1E1E1E"/><path d="M38 45h6M56 45h6" stroke="#fff6" stroke-width="1.5"/>' },
    { nameFa: 'تاج', unlock: ach('winner_25'), svg: '<path d="M34 26L36 12L43 20L50 8L57 20L64 12L66 26Z" fill="#F2C230" stroke="#C9971A" stroke-width="1.2"/><circle cx="50" cy="19" r="2" fill="#D94848"/>' },
    { nameFa: 'کلاه جشن', unlock: coins(80), svg: '<path d="M50 4L62 28H38Z" fill="#7A4FD1"/><path d="M44 16h12M41 22h18" stroke="#F2C230" stroke-width="2"/><circle cx="50" cy="4" r="3" fill="#F2C230"/>' },
    { nameFa: 'هدفون', unlock: coins(150), svg: '<path d="M27 48C27 30 37 20 50 20S73 30 73 48" fill="none" stroke="#2D3142" stroke-width="4"/><rect x="22" y="42" width="9" height="14" rx="4" fill="#D94848"/><rect x="69" y="42" width="9" height="14" rx="4" fill="#D94848"/>' },
    { nameFa: 'گل', unlock: FREE, svg: '<g transform="translate(66 30)" fill="#F28CB1"><circle cy="-4" r="3"/><circle cx="3.8" cy="-1.2" r="3"/><circle cx="2.4" cy="3.2" r="3"/><circle cx="-2.4" cy="3.2" r="3"/><circle cx="-3.8" cy="-1.2" r="3"/><circle r="2.2" fill="#F2C230"/></g>' },
    { nameFa: 'سبیل', unlock: coins(60), svg: '<path d="M41 54C45 51 48 53 50 55C52 53 55 51 59 54C56 57 52 57 50 56C48 57 44 57 41 54Z" fill="#3A2618"/>' },
    { nameFa: 'کلاه کپ', unlock: level(5), svg: '<path d="M28 38C28 26 38 20 50 20S72 26 72 38Z" fill="#3B6FD8"/><path d="M27 38H73Q73 42 70 42H30Q27 42 27 38Z" fill="#2E58B0"/><circle cx="50" cy="21" r="1.6" fill="#2E58B0"/>' },
    { nameFa: 'کلاه فارغ‌التحصیلی', unlock: ach('graduate'), svg: '<path d="M36 28V36Q50 42 64 36V28L50 34Z" fill="#2D3142"/><path d="M26 24L50 14L74 24L50 34Z" fill="#2D3142"/><path d="M70 25V36" stroke="#F2C230" stroke-width="1.5"/><circle cx="70" cy="37" r="2" fill="#F2C230"/>' }
  ],
  b: [
    { nameFa: 'آسمانی', unlock: FREE, svg: '<rect width="100" height="100" fill="#CFE3F7"/>' },
    { nameFa: 'هلویی', unlock: FREE, svg: '<rect width="100" height="100" fill="#F7D9C4"/>' },
    { nameFa: 'نعنایی', unlock: FREE, svg: '<rect width="100" height="100" fill="#D5F0DC"/>' },
    { nameFa: 'یاسی', unlock: FREE, svg: '<rect width="100" height="100" fill="#E9DDF7"/>' },
    { nameFa: 'آفتابی', unlock: coins(100), svg: '<rect width="100" height="100" fill="#FFF1B8"/><circle cx="82" cy="18" r="10" fill="#FFD54F"/><path d="M82 2v5M82 29v5M66 18h5M93 18h5M71 7l3 3M90 26l3 3M71 29l3-3M90 10l3-3" stroke="#FFD54F" stroke-width="2" stroke-linecap="round"/>' },
    { nameFa: 'تاس‌ها', unlock: coins(150), svg: '<rect width="100" height="100" fill="#F7E3D4"/><g fill="#fff" stroke="#E0B9A0"><rect x="8" y="10" width="15" height="15" rx="3" transform="rotate(-12 15 17)"/><rect x="77" y="56" width="15" height="15" rx="3" transform="rotate(14 84 63)"/><rect x="6" y="62" width="12" height="12" rx="3" transform="rotate(20 12 68)"/></g><g fill="#C68650"><circle cx="13" cy="15" r="1.5"/><circle cx="18" cy="20" r="1.5"/><circle cx="84" cy="63" r="1.5"/><circle cx="12" cy="68" r="1.5"/></g>' },
    { nameFa: 'شب پرستاره', unlock: level(8), svg: '<rect width="100" height="100" fill="#23284A"/><circle cx="80" cy="20" r="8" fill="#F5E6A8"/><circle cx="84" cy="17" r="7" fill="#23284A"/><g fill="#fff"><circle cx="15" cy="14" r="1.2"/><circle cx="30" cy="8" r=".9"/><circle cx="12" cy="40" r="1"/><circle cx="88" cy="44" r="1.1"/><circle cx="62" cy="8" r=".8"/><circle cx="20" cy="70" r=".9"/></g>' },
    { nameFa: 'شش‌ضلعی', unlock: ach('regular'), svg: '<rect width="100" height="100" fill="#DCEBD6"/><g fill="none" stroke="#9CC48F" stroke-width="1.5"><path d="M8 18l7-4 7 4v8l-7 4-7-4z"/><path d="M78 10l7-4 7 4v8l-7 4-7-4z"/><path d="M80 60l7-4 7 4v8l-7 4-7-4z"/><path d="M6 58l7-4 7 4v8l-7 4-7-4z"/></g>' }
  ],
  fr: [
    { nameFa: 'بدون قاب', unlock: FREE, svg: '' },
    { nameFa: 'سفید', unlock: FREE, svg: '<circle cx="50" cy="50" r="47" fill="none" stroke="#fff" stroke-width="6"/>' },
    { nameFa: 'چوبی', unlock: coins(150), svg: '<circle cx="50" cy="50" r="47" fill="none" stroke="#8B5A2B" stroke-width="6"/><circle cx="50" cy="50" r="47" fill="none" stroke="#B07A45" stroke-width="2" stroke-dasharray="6 4"/>' },
    { nameFa: 'لیگ برنز', unlock: league('bronze'), svg: '<circle cx="50" cy="50" r="47" fill="none" stroke="#B87333" stroke-width="6"/>' },
    { nameFa: 'لیگ نقره', unlock: league('silver'), svg: '<circle cx="50" cy="50" r="47" fill="none" stroke="#C0C7CF" stroke-width="6"/><circle cx="50" cy="50" r="43.5" fill="none" stroke="#fff8" stroke-width="1"/>' },
    { nameFa: 'لیگ طلا', unlock: league('gold'), svg: '<circle cx="50" cy="50" r="47" fill="none" stroke="#E6B84A" stroke-width="6"/><circle cx="50" cy="50" r="43" fill="none" stroke="#C9971A" stroke-width="1.5"/>' },
    { nameFa: 'لیگ پلاتین', unlock: league('platinum'), svg: '<circle cx="50" cy="50" r="47" fill="none" stroke="#2BB5B0" stroke-width="6"/><circle cx="50" cy="50" r="47" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="2 8"/>' },
    { nameFa: 'لیگ الماس', unlock: league('diamond'), svg: '<circle cx="50" cy="50" r="47" fill="none" stroke="#7FD6FF" stroke-width="6"/><circle cx="50" cy="50" r="42.5" fill="none" stroke="#3FA9E0" stroke-width="2"/><g fill="#fff"><path d="M50 0l3 3-3 3-3-3z"/><path d="M50 94l3 3-3 3-3-3z"/><path d="M0 50l3-3 3 3-3 3z"/><path d="M94 50l3-3 3 3-3 3z"/></g>' },
    { nameFa: 'لیگ استادان', unlock: league('master'), svg: '<circle cx="50" cy="50" r="47" fill="none" stroke="#7A4FD1" stroke-width="6"/><circle cx="50" cy="50" r="47" fill="none" stroke="#F2C230" stroke-width="2.5" stroke-dasharray="1 7" stroke-linecap="round"/>' }
  ],
  t: [
    { nameFa: 'بدون لقب', unlock: FREE },
    { nameFa: 'تازه‌وارد', unlock: FREE },
    { nameFa: 'اهل بازی', unlock: FREE },
    { nameFa: 'شب‌زنده‌دار', unlock: coins(200) },
    { nameFa: 'تاس‌باز', unlock: coins(200) },
    { nameFa: 'برندهٔ تازه‌کار', unlock: ach('first_win') },
    { nameFa: 'کهنه‌کار', unlock: ach('veteran') },
    { nameFa: 'استاد دانشگاه', unlock: ach('professor') },
    { nameFa: 'قله‌نورد', unlock: ach('level_20') },
    { nameFa: 'استاد بزرگ', unlock: ach('grandmaster') },
    { nameFa: 'رستم دستان', unlock: ach('winner_100') }
  ],
  bn: [
    { nameFa: 'ساده', unlock: FREE, css: 'linear-gradient(135deg, var(--secondary), var(--muted))' },
    { nameFa: 'غروب', unlock: FREE, css: 'linear-gradient(135deg, #F6A26B, #D94868)' },
    { nameFa: 'دریا', unlock: FREE, css: 'linear-gradient(135deg, #4FB3D9, #2D4FA8)' },
    { nameFa: 'جنگل', unlock: coins(150), css: 'linear-gradient(135deg, #7CC48A, #1F6B4A)' },
    { nameFa: 'کاشی فیروزه', unlock: coins(250), css: 'repeating-linear-gradient(45deg, #1F8A8A 0 14px, #2BB5B0 14px 28px)' },
    { nameFa: 'آسمان شب', unlock: level(10), css: 'radial-gradient(circle at 80% 20%, #F5E6A8 0 3%, transparent 4%), linear-gradient(160deg, #23284A, #4A3A7A)' },
    { nameFa: 'طلایی', unlock: ach('winner_25'), css: 'linear-gradient(135deg, #F7D774, #C9971A)' },
    { nameFa: 'شفق', unlock: league('diamond'), css: 'linear-gradient(135deg, #2BB5B0, #7A4FD1, #E04F9A)' }
  ],
  cb: [
    { nameFa: 'کلاسیک', unlock: FREE, rarity: 'common', art: art('diamonds', '#1F6B4A', '#F7D9C4') },
    { nameFa: 'شب', unlock: coins(120), rarity: 'common', art: art('stars', '#23284A', '#F5E6A8') },
    { nameFa: 'کاشی فیروزه', unlock: coins(250), rarity: 'rare', art: art('rings', '#1F8A8A', '#2BB5B0') },
    { nameFa: 'سرخ و طلا', unlock: level(12), rarity: 'epic', art: art('stripes', '#8E1F2F', '#E6B84A') },
    { nameFa: 'گوهر اشتراک', unlock: PREMIUM, rarity: 'legend', art: art('diamonds', '#7A4FD1', '#F2C230', '#E04F9A') }
  ],
  bk: [
    { nameFa: 'چوب ساده', unlock: FREE, rarity: 'common', art: art('solid', '#C9A06B') },
    { nameFa: 'مرمر', unlock: coins(200), rarity: 'rare', art: art('waves', '#E8E4DC', '#B9B2A4') },
    { nameFa: 'شطرنجی سبز', unlock: coins(300), rarity: 'rare', art: art('diamonds', '#2E7D5B', '#DCEBD6') },
    { nameFa: 'آسمان شب', unlock: league('gold'), rarity: 'epic', art: art('stars', '#23284A', '#4A3A7A') },
    { nameFa: 'زرنگار', unlock: PREMIUM, rarity: 'legend', art: art('rings', '#C9971A', '#F7D774') }
  ],
  em: [
    { nameFa: 'آفرین', unlock: FREE, rarity: 'common', art: { colors: ['#F2C230'], pattern: 'solid', glyph: 'star' } },
    { nameFa: 'خنده', unlock: FREE, rarity: 'common', art: { colors: ['#F28C38'], pattern: 'solid', glyph: 'smile' } },
    { nameFa: 'قلب', unlock: coins(60), rarity: 'common', art: { colors: ['#E04F9A'], pattern: 'solid', glyph: 'heart' } },
    { nameFa: 'جرقه', unlock: coins(150), rarity: 'rare', art: { colors: ['#7A4FD1'], pattern: 'stars', glyph: 'sparkles' } },
    { nameFa: 'آتش', unlock: level(7), rarity: 'epic', art: { colors: ['#D94848', '#F2B33D'], pattern: 'solid', glyph: 'flame' } },
    { nameFa: 'تاج', unlock: ach('winner_25'), rarity: 'legend', art: { colors: ['#C9971A', '#F7D774'], pattern: 'solid', glyph: 'crown' } },
    { nameFa: 'گوهر', unlock: PREMIUM, rarity: 'legend', art: { colors: ['#7A4FD1', '#2BB5B0'], pattern: 'solid', glyph: 'gem' } }
  ],
  bu: [
    { nameFa: 'ساده', unlock: FREE, rarity: 'common', art: art('solid', '#E8E8E8') },
    { nameFa: 'نعنایی', unlock: coins(80), rarity: 'common', art: art('solid', '#D5F0DC', '#2E9E6A') },
    { nameFa: 'غروب', unlock: coins(180), rarity: 'rare', art: art('waves', '#F6A26B', '#D94868') },
    { nameFa: 'یاسی خال‌دار', unlock: level(9), rarity: 'epic', art: art('dots', '#E9DDF7', '#7A4FD1') },
    { nameFa: 'شفق', unlock: PREMIUM, rarity: 'legend', art: art('waves', '#2BB5B0', '#7A4FD1', '#E04F9A') }
  ],
  sr: [
    { nameFa: 'ساده', unlock: FREE, rarity: 'common', art: art('solid', '#8D9A94') },
    { nameFa: 'دوخطی', unlock: coins(100), rarity: 'common', art: art('rings', '#8D9A94', '#E8E8E8') },
    { nameFa: 'خط‌چین طلایی', unlock: coins(220), rarity: 'rare', art: art('dots', '#E6B84A') },
    { nameFa: 'الماسی', unlock: league('diamond'), rarity: 'epic', art: art('rings', '#7FD6FF', '#3FA9E0') },
    { nameFa: 'پرتو', unlock: PREMIUM, rarity: 'legend', art: art('stars', '#7A4FD1', '#F2C230') }
  ]
};

export const COSMETICS: readonly CosmeticItem[] = (Object.keys(DEFS) as CosmeticSlot[])
  .flatMap((slot) => DEFS[slot].map((d, i) => ({ ...d, slot, i, key: `${slot}.${i}` })));
const BY_KEY = new Map(COSMETICS.map((c) => [c.key, c]));
export const cosmetic = (key: string): CosmeticItem | undefined => BY_KEY.get(key);
/** Shown rarity: explicit, else derived from how the item unlocks. */
export function rarityOf(c: CosmeticItem): Rarity {
  if (c.rarity) return c.rarity;
  const u = c.unlock;
  if ('premium' in u) return 'legend';
  if ('coins' in u) return u.coins >= 200 ? 'rare' : 'common';
  if ('free' in u) return 'common';
  return 'epic';
}
/** Catalogue slot -> equip kind, for the five table kinds. */
export const kindOfKey = (key: string): ItemKind | undefined => ITEM_KINDS.find((k) => key.startsWith(`${KIND_SLOT[k]}.`));
export const slotItems = (slot: CosmeticSlot): CosmeticItem[] => COSMETICS.filter((c) => c.slot === slot);

export type AvatarParts = Record<AvatarSlot, number>;
export const DEFAULT_AVATAR = 'v1:s1.f0.h1.hc1.e0.m0.o0.oc0.a0.b0.fr0';

/** Strict parse: every slot exactly once, in order, each index in the catalogue. Null for anything else. */
export function parseAvatar(key: string): AvatarParts | null {
  if (!key.startsWith('v1:')) return null;
  const parts = key.slice(3).split('.');
  if (parts.length !== AVATAR_SLOTS.length) return null;
  const out = {} as AvatarParts;
  for (const [n, slot] of AVATAR_SLOTS.entries()) {
    const m = /^([a-z]+)(\d{1,2})$/.exec(parts[n]!);
    if (!m || m[1] !== slot || !BY_KEY.has(`${slot}.${m[2]}`)) return null;
    out[slot] = Number(m[2]);
  }
  return out;
}
export const formatAvatar = (p: AvatarParts): string => `v1:${AVATAR_SLOTS.map((s) => `${s}${p[s]}`).join('.')}`;
/** Catalogue keys an avatar uses (what ownership is checked against). */
export const avatarItemKeys = (p: AvatarParts): string[] => AVATAR_SLOTS.map((s) => `${s}.${p[s]}`);

/** Inner SVG markup (viewBox 0 0 100 100) for a built avatar. Only catalogue strings reach it, never user text. */
export function avatarSvg(p: AvatarParts): string {
  const get = (s: AvatarSlot) => BY_KEY.get(`${s}.${p[s]}`)!;
  const fill = (x = '') => x.replaceAll('{skin}', get('s').color!).replaceAll('{hair}', get('hc').color!).replaceAll('{cloth}', get('oc').color!);
  const o = get('o');
  const h = get('h');
  return fill([
    get('b').svg, o.back,
    '<path d="M12 100C14 80 30 72 50 72S86 80 88 100Z" fill="{cloth}"/>', o.svg,
    h.back,
    '<rect x="44" y="60" width="12" height="14" fill="{skin}"/><rect x="44" y="60" width="12" height="6" fill="#000" opacity=".12"/>',
    get('f').svg, get('e').svg, get('m').svg, h.svg, get('a').svg, get('fr').svg
  ].join(''));
}

export function unlockFa(u: Unlock, achievementTitle?: (key: string) => string | undefined): string {
  if ('free' in u) return 'رایگان';
  if ('coins' in u) return `${u.coins.toLocaleString('fa-IR')} سکه`;
  if ('level' in u) return `سطح ${u.level.toLocaleString('fa-IR')}`;
  if ('achievement' in u) return `دستاورد «${achievementTitle?.(u.achievement) ?? u.achievement}»`;
  if ('premium' in u) return 'ویژهٔ اشتراک';
  return `لیگ ${LEAGUE_FA[u.league]} یا بالاتر`;
}
const LEAGUE_FA: Record<League, string> = { bronze: 'برنز', silver: 'نقره', gold: 'طلا', platinum: 'پلاتین', diamond: 'الماس', master: 'استادان' };
