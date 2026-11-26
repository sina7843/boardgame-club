import type { Term } from '@bg/ui';

/** Ark Nova terms (official English names). `fa` = Persian words used today (client text and server publicSummary labels); `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  animals: { fa: 'حیوانات', bg: 'Animals' }, cards: { fa: 'کارت‌ها', bg: 'Cards' }, build: { fa: 'ساخت', bg: 'Build' },
  association: { fa: 'انجمن', bg: 'Association' }, sponsors: { fa: 'حامیان', bg: 'Sponsors' },
  break: { fa: 'استراحت', bg: 'Break' }, breakAlt: { fa: 'وقفه', bg: 'Break' }, display: { fa: 'ویترین', bg: 'Display' },
  reputation: { fa: 'اعتبار', bg: 'Reputation' }, appeal: { fa: 'جذابیت', bg: 'Appeal' },
  conservation: { fa: 'حفاظت', bg: 'Conservation' }, conservationPoints: { fa: 'امتیاز حفاظت', bg: 'Conservation Points' },
  venom: { fa: 'زهر', bg: 'Venom' }, multiplier: { fa: 'دوبرابرکننده', bg: 'Multiplier' }, constriction: { fa: 'فشار', bg: 'Constriction' },
  pilfering: { fa: 'دستبرد', bg: 'Pilfering' }, partnerZoo: { fa: 'باغ‌وحش همکار', bg: 'Partner Zoo' }, university: { fa: 'دانشگاه', bg: 'University' },
  cardsEz: { fa: 'کارت‌های', bg: 'Cards' }, money: { fa: 'پول', bg: 'Money' }, token: { fa: 'نشان', bg: 'Token' }, xToken: { fa: 'نشان X', bg: 'X-Token' }, xTokenAction: { fa: 'کنش نشان X', bg: 'X-Token Action' },
  zoo: { fa: 'باغ‌وحش', bg: 'Zoo' }, myZoo: { fa: 'باغ‌وحش من', bg: 'My Zoo' }, pettingZoo: { fa: 'باغ‌وحش کودکان', bg: 'Petting Zoo' },
  enclosureEz: { fa: 'محوطهٔ', bg: 'Enclosure' }, space: { fa: 'خانه', bg: 'Space' }, spaceEz: { fa: 'خانهٔ', bg: 'Space' },
  kiosk: { fa: 'کیوسک', bg: 'Kiosk' }, pavilion: { fa: 'آلاچیق', bg: 'Pavilion' }, reptileHouse: { fa: 'خانهٔ خزندگان', bg: 'Reptile House' }, aviary: { fa: 'قفس بزرگ پرندگان', bg: 'Large Bird Aviary' },
  sponsor: { fa: 'حامی', bg: 'Sponsor' }, sponsorLevel: { fa: 'حامی سطح', bg: 'Sponsor Level' }, animal: { fa: 'حیوان', bg: 'Animal' }, card: { fa: 'کارت', bg: 'Card' },
  action: { fa: 'کنش', bg: 'Action' }, actionCards: { fa: 'کارت‌های کنش', bg: 'Action Cards' }, strength: { fa: 'قدرت', bg: 'Strength' },
  project: { fa: 'پروژه', bg: 'Project' }, conservationProject: { fa: 'پروژهٔ حفاظت', bg: 'Conservation Project' },
  playedProjects: { fa: 'پروژه‌های بازی‌شده', bg: 'Played Projects' }, baseProjects: { fa: 'پروژه‌های پایه', bg: 'Base Projects' }, supportedProjects: { fa: 'پروژه‌های پشتیبانی‌شده', bg: 'Supported Projects' },
  release: { fa: 'در طبیعت رها کرد', bg: 'Released into the Wild' }, upgrade: { fa: 'ارتقا', bg: 'Upgrade' }, donate: { fa: 'اهدا', bg: 'Donate' },
  income: { fa: 'درآمد', bg: 'Income' }, breakIncome: { fa: 'درآمد استراحت', bg: 'Break Income' }, worker: { fa: 'کارمند', bg: 'Worker' },
  finalScoring: { fa: 'امتیاز پایانی', bg: 'Final Scoring' }, finalCard: { fa: 'کارت امتیاز پایانی', bg: 'Final Scoring Card' },
  hand: { fa: 'دست', bg: 'Hand' }, yourHand: { fa: 'دست شما', bg: 'Your Hand' }, scoreBoard: { fa: 'بورد امتیاز', bg: 'Score Board' },
  deck: { fa: 'دسته', bg: 'Deck' }, discard: { fa: 'دورریخته', bg: 'Discard' }, map: { fa: 'نقشه', bg: 'Map' }, zooMap: { fa: 'نقشهٔ باغ‌وحش', bg: 'Zoo Map' },
  initialDraft: { fa: 'انتخاب آغازین', bg: 'Initial Draft' }, startingCards: { fa: 'کارت‌های آغازین', bg: 'Starting Cards' },
  confirm: { fa: 'تأیید', bg: 'Confirm' }, undoBtn: { fa: 'برگرد', bg: 'Undo' }, skipBtn: { fa: 'رد کردن', bg: 'Skip' }, rotateBtn: { fa: 'چرخش', bg: 'Rotate' },
  associationBoard: { fa: 'بورد انجمن', bg: 'Association Board' }
} satisfies Record<string, Term>;

export const iconTerm: Record<string, Term> = {
  bird: { fa: 'پرنده', bg: 'Bird' }, herbivore: { fa: 'گیاه‌خوار', bg: 'Herbivore' }, predator: { fa: 'شکارچی', bg: 'Predator' }, primate: { fa: 'نخستی', bg: 'Primate' },
  reptile: { fa: 'خزنده', bg: 'Reptile' }, bear: { fa: 'خرس', bg: 'Bear' }, pet: terms.pettingZoo,
  africa: { fa: 'آفریقا', bg: 'Africa' }, americas: { fa: 'آمریکا', bg: 'Americas' }, asia: { fa: 'آسیا', bg: 'Asia' }, australia: { fa: 'استرالیا', bg: 'Australia' },
  europe: { fa: 'اروپا', bg: 'Europe' }, science: { fa: 'پژوهش', bg: 'Research' }, rock: { fa: 'صخره', bg: 'Rock' }, water: { fa: 'آب', bg: 'Water' }
};
export const uniTerm: Record<string, Term> = {
  science: { fa: 'دانشگاه پژوهشی (۲ پژوهش)', bg: 'Science University (2 Research)' },
  rep: { fa: 'دانشگاه اعتبار (۱ پژوهش + ۲ اعتبار)', bg: 'Reputation University (1 Research + 2 Reputation)' },
  hand: { fa: 'دانشگاه کتابخانه (۱ اعتبار، سقف دست ۵)', bg: 'Library University (1 Reputation, hand limit 5)' }
};

/** Persian texts built by the engine (prompts, options, abilities) reach the table as plain strings: swap whole-word terms. */
const SWAP: [string, Term][] = [
  ...Object.values(terms), ...Object.values(iconTerm)
].filter((t) => t.bg !== t.fa).map((t) => [t.fa, t] as [string, Term]);
const SWAP_MAP = new Map(SWAP);
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SWAP_RE = new RegExp(`(?<![؀-ۿ‌])(?:${[...SWAP_MAP.keys()].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![؀-ۿ‌])`, 'g');
export const swapTerms = (text: string, lang: 'fa' | 'fa-bg'): string => (lang === 'fa-bg' ? text.replace(SWAP_RE, (w) => SWAP_MAP.get(w)?.bg ?? w) : text);
