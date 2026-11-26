import type { Term } from '@bg/ui';

/** Blood Rage terms (official English names). `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی».
 *  Every inflected spelling that occurs in the client (plural, ezafe, suffixes) is its own entry so each one converts. */
export const terms = {
  rage: { fa: 'خشم', bg: 'Rage' }, axe: { fa: 'تبر', bg: 'Axes' }, horn: { fa: 'شاخ', bg: 'Horns' }, glory: { fa: 'افتخار', bg: 'Glory' },
  age: { fa: 'عصر', bg: 'Age' }, ages: { fa: 'عصرها', bg: 'Ages' }, godsGifts: { fa: 'هدایای خدایان', bg: "Gods' Gifts" },
  quest: { fa: 'مأموریت', bg: 'Quest' }, quests: { fa: 'مأموریت‌ها', bg: 'Quests' }, questsEz: { fa: 'مأموریت‌های', bg: 'Quests' }, questAny: { fa: 'مأموریتی', bg: 'a Quest' },
  questAlt: { fa: 'ماموریت', bg: 'Quest' }, questsAlt: { fa: 'ماموریت‌ها', bg: 'Quests' },
  ragnarok: { fa: 'راگناروک', bg: 'Ragnarök' }, valhalla: { fa: 'والهالا', bg: 'Valhalla' }, releaseValhalla: { fa: 'آزادی از والهالا', bg: 'Release Valhalla' },
  pillage: { fa: 'غارت', bg: 'Pillage' }, march: { fa: 'لشکرکشی', bg: 'March' }, invade: { fa: 'یورش', bg: 'Invade' }, upgrade: { fa: 'ارتقا', bg: 'Upgrade' }, upgradeEz: { fa: 'ارتقای', bg: 'Upgrade' },
  // pieces and cards
  card: { fa: 'کارت', bg: 'Card' }, cards: { fa: 'کارت‌ها', bg: 'Cards' }, cardsEz: { fa: 'کارت‌های', bg: 'Cards' }, cardAny: { fa: 'کارتی', bg: 'a Card' },
  figure: { fa: 'مهره', bg: 'Figure' }, figures: { fa: 'مهره‌ها', bg: 'Figures' }, figuresEz: { fa: 'مهره‌های', bg: 'Figures' }, figureAny: { fa: 'مهره‌ای', bg: 'a Figure' }, figureEz: { fa: 'مهرهٔ', bg: 'Figure' },
  leader: { fa: 'سردار', bg: 'Leader' }, warrior: { fa: 'جنگجو', bg: 'Warrior' }, warriorEz: { fa: 'جنگجوی', bg: 'Warrior' }, ship: { fa: 'کشتی', bg: 'Ship' }, monster: { fa: 'هیولا', bg: 'Monster' },
  battle: { fa: 'نبرد', bg: 'Battle' }, battles: { fa: 'نبردها', bg: 'Battles' }, battleAny: { fa: 'نبردی', bg: 'a Battle' },
  province: { fa: 'استان', bg: 'Province' }, village: { fa: 'روستا', bg: 'Village' }, villageEz: { fa: 'روستای', bg: 'Village' }, clan: { fa: 'قبیله', bg: 'Clan' }, clanEz: { fa: 'قبیلهٔ', bg: 'Clan' },
  fjord: { fa: 'آبدره', bg: 'Fjord' }, stat: { fa: 'ویژگی', bg: 'Stat' }, stats: { fa: 'ویژگی‌ها', bg: 'Stats' }, step: { fa: 'پله', bg: 'Step' }, stepEz: { fa: 'پلهٔ', bg: 'Step' },
  reserve: { fa: 'ذخیره', bg: 'Reserve' }, strength: { fa: 'قدرت', bg: 'Strength' }, cost: { fa: 'هزینه', bg: 'Cost' }, reward: { fa: 'پاداش', bg: 'Reward' },
  // phases and actions
  action: { fa: 'اقدام', bg: 'Action' }, actions: { fa: 'اقدام‌ها', bg: 'Actions' }, actionAny: { fa: 'اقدامی', bg: 'an Action' }, phase: { fa: 'فاز', bg: 'Phase' },
  discardPhase: { fa: 'دور ریختن', bg: 'Discard' }, discarded: { fa: 'دورریخته', bg: 'Discarded' }, pass: { fa: 'کنار کشیدن', bg: 'Pass' }, passed: { fa: 'کنار کشید', bg: 'Passed' },
  outOfRage: { fa: 'خشم تمام شد', bg: 'Out of Rage' }, onMap: { fa: 'روی نقشه', bg: 'On Map' }, firstPlayer: { fa: 'بازیکن اول', bg: 'First Player' }, phaseLabel: { fa: 'مرحله', bg: 'Phase' },
  destroyed: { fa: 'نابود شده', bg: 'Destroyed' }, doom: { fa: 'نشان نابودی', bg: 'Doom Marker' }, lastBattle: { fa: 'آخرین نبرد', bg: 'Last Battle' }, pillager: { fa: 'غارتگر', bg: 'Pillager' },
  // gods named in the gifts and clan-action prompts
  frigg: { fa: 'فریگا', bg: 'Frigg' }, loki: { fa: 'لوکی', bg: 'Loki' }, odin: { fa: 'اودین', bg: 'Odin' }, heimdall: { fa: 'هایمدال', bg: 'Heimdall' }, thor: { fa: 'تور', bg: 'Thor' }, tyr: { fa: 'تیر', bg: 'Tyr' }
} satisfies Record<string, Term>;

const SWAP = new Map<string, Term>(Object.values(terms).filter((t) => t.bg !== t.fa).map((t) => [t.fa, t]));
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SWAP_RE = new RegExp(`(?<![؀-ۿ‌])(?:${[...SWAP.keys()].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![؀-ۿ‌])`, 'g');
/** Swap every whole-word term inside a Persian string (sentences keep their grammar words). */
export const swapTerms = (text: string, lang: 'fa' | 'fa-bg'): string => (lang === 'fa-bg' ? text.replace(SWAP_RE, (w) => SWAP.get(w)?.bg ?? w) : text);
