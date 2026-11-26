import { getTermsLang, type Term } from '@bg/ui';

/** Unmatched terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  attack: { fa: 'حمله', bg: 'Attack' }, defense: { fa: 'دفاع', bg: 'Defense' }, versatile: { fa: 'همه‌کاره', bg: 'Versatile' },
  scheme: { fa: 'نقشه', bg: 'Scheme' }, boost: { fa: 'تقویت', bg: 'Boost' }, maneuver: { fa: 'مانور', bg: 'Maneuver' },
  sidekick: { fa: 'یاور', bg: 'Sidekick' }, ranged: { fa: 'دوربرد', bg: 'Ranged' }, melee: { fa: 'نزدیک‌زن', bg: 'Melee' },
  deck: { fa: 'دسته', bg: 'Deck' }, discard: { fa: 'دورریخته', bg: 'Discard' },
  // HUD / server summary labels (rules.ts publicSummary)
  health: { fa: 'سلامتی', bg: 'Health' }, cards: { fa: 'کارت', bg: 'Cards' }, hand: { fa: 'دست', bg: 'Hand' }, damage: { fa: 'آسیب', bg: 'Damage' },
  combat: { fa: 'نبرد', bg: 'Combat' }, space: { fa: 'خانه', bg: 'Space' }, zone: { fa: 'منطقه', bg: 'Zone' }, fighter: { fa: 'مبارز', bg: 'Fighter' }, hero: { fa: 'قهرمان', bg: 'Hero' },
  action: { fa: 'اقدام', bg: 'Action' }, effect: { fa: 'اثر', bg: 'Effect' }, value: { fa: 'ارزش', bg: 'Value' }, fog: { fa: 'نشان مه', bg: 'Fog token' },
  board: { fa: 'میدان', bg: 'Board' }, duel: { fa: 'نبرد تن‌به‌تن', bg: '1v1 Duel' }, ffa: { fa: 'همه علیه همه', bg: 'Free-for-all' }, zones: { fa: 'منطقه‌ها', bg: 'Zones' },
  move: { fa: 'حرکت', bg: 'Move' }, big: { fa: 'بزرگ', bg: 'Big' }, small: { fa: 'کوچک', bg: 'Small' }, actions: { fa: 'اقدام‌ها', bg: 'Actions' }, draw: { fa: 'کشیدن', bg: 'Draw' }, spaces: { fa: 'خانه‌ها', bg: 'Spaces' },
  noCards: { fa: ' (کارتی نیست)', bg: ' (no Cards)' }, noTarget: { fa: ' (هدفی نیست)', bg: ' (no target)' }, endMove: { fa: 'پایان حرکت', bg: 'End Move' },
  discardPile: { fa: 'کارت‌های دورریخته', bg: 'Discard pile' }, events: { fa: 'رویدادها', bg: 'Log' }, abilityLabel: { fa: 'توانایی ویژه', bg: 'Special ability' },
  aliceBig: { fa: 'آلیس بزرگ', bg: 'Alice (Big)' }, aliceSmall: { fa: 'آلیس کوچک', bg: 'Alice (Small)' }, vanished: { fa: 'ناپدید', bg: 'Vanished' },
  exhausted: { fa: ' (خسته!)', bg: ' (Exhausted!)' }, defeated: { fa: 'شکست', bg: 'Defeated' }, atRange: { fa: ' (از دور)', bg: ' (Ranged)' },
  mvPick: { fa: 'قهرمان برگزید', bg: 'Picked a Hero' }, mvAttack: { fa: 'حمله کرد', bg: 'Attacked' }, mvScheme: { fa: 'نقشه بازی کرد', bg: 'Played a Scheme' },
  mvOut: { fa: 'حذف شد', bg: 'Eliminated' }, mvTime: { fa: 'زمانش تمام شد', bg: 'Ran out of time' }
} satisfies Record<string, Term>;

// Longest match first. Inflected / plural forms are their own entries so the Latin word never gets a Persian «‌ها».
const PROSE: [string, string][] = [
  ['میدان نبرد', 'Battlefield'], ['پس از نبرد', 'After combat'], ['حین نبرد', 'During combat'], ['هر مبارز', 'Any Fighter'], ['نشان مه', 'Fog token'],
  ['دور بریزید', 'Discard'], ['دور بریزد', 'discard'], ['دور ریختن', 'discarding'], ['دور ریخت', 'discarded'],
  ['کارت‌های', 'Cards'], ['کارت‌ها', 'Cards'], ['کارتی', 'a Card'], ['کارت', 'Card'],
  ['حمله‌ها', 'Attacks'], ['حمله', 'Attack'], ['دفاع', 'Defense'], ['تقویت', 'Boost'], ['نقشه', 'Scheme'], ['مانور', 'Maneuver'],
  ['مبارزان', 'Fighters'], ['مبارزی', 'a Fighter'], ['مبارز', 'Fighter'], ['قهرمان', 'Hero'], ['یاور', 'Sidekick'],
  ['آسیب', 'Damage'], ['سلامتی', 'Health'], ['منطقه', 'Zone'], ['دسته', 'Deck'], ['دست', 'Hand'], ['دورریخته', 'Discard'],
  ['از دور', 'at range'], ['بکشید', 'Draw'], ['کشید', 'drew'], ['نبرد', 'Combat'], ['فوری', 'Immediate'], ['ارزش', 'Value'], ['خانه', 'space'],
  ['اقدام‌ها', 'Actions'], ['اقدام', 'Action'], ['اثرهای', 'Effects'], ['اثر', 'Effect'], ['دوربرد', 'Ranged'], ['نزدیک‌زن', 'Melee'], ['همه‌کاره', 'Versatile']
];
const L = '[\\u0600-\\u06FF\\u200c]';
const PROSE_RE = new RegExp(`(?<!${L})(${[...PROSE].sort((a, b) => b[0].length - a[0].length).map(([f]) => f).join('|')})(?!${L})`, 'g');
const PROSE_MAP = new Map(PROSE);
/** Persian sentence with its term words in Latin (isolated so they never reorder). Identity in `fa`. */
export const prose = (s: string): string => (getTermsLang() === 'fa-bg' ? s.replace(PROSE_RE, (m) => `⁨${PROSE_MAP.get(m) ?? m}⁩`) : s);
/** Hero / sidekick / card / board name: official English in «فارسی بردگیمی». */
export const nm = (fa: string, en: string): string => (getTermsLang() === 'fa-bg' && en ? en : fa);
