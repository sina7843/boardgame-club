import type { Term } from '@bg/ui';
import { CARD_FA, CONTINENTS, TERRITORY_FA, type CardKind, type ContinentId, type TerritoryId } from './board.ts';

/** Risk terms. `fa` = Persian words used today (client text and server publicSummary labels); `bg` = Latin term for «فارسی بردگیمی». */
// NOTE: `set` must stay before `deck` (same Persian word «دسته»): the summary swap lets the later entry win, and the summary means the deck.
export const terms = {
  reinforcement: { fa: 'نیروی کمکی', bg: 'Reinforcement' }, fortify: { fa: 'جابه‌جایی', bg: 'Fortify' }, blitz: { fa: 'حمله سریع', bg: 'Blitz' },
  army: { fa: 'ارتش', bg: 'Army' }, armies: { fa: 'ارتش‌ها', bg: 'Armies' }, armiesEz: { fa: 'ارتش‌های', bg: 'Armies' }, armiesOwn: { fa: 'ارتش‌هایش', bg: 'their Armies' },
  reinforceArmy: { fa: 'ارتش کمکی', bg: 'Reinforcements' }, startArmy: { fa: 'ارتش آغازین', bg: 'Starting Armies' }, setupPhase: { fa: 'چیدن ارتش آغازین', bg: 'Initial Army Placement' },
  troops: { fa: 'سرباز', bg: 'Armies' },
  territory: { fa: 'قلمرو', bg: 'Territory' }, territoriesEz: { fa: 'قلمروهای', bg: 'Territories' }, territoriesYour: { fa: 'قلمروهایتان', bg: 'your Territories' },
  card: { fa: 'کارت', bg: 'Card' }, cardsEz: { fa: 'کارت‌های', bg: 'Cards' }, cardHis: { fa: 'کارتش', bg: 'Cards' }, cardAny: { fa: 'کارتی', bg: 'a Card' },
  set: { fa: 'دسته', bg: 'Set' }, deck: { fa: 'دسته', bg: 'Deck' },
  wild: { fa: 'جوکر', bg: 'Wild' }, continents: { fa: 'قاره‌ها', bg: 'Continents' },
  trade: { fa: 'معاوضه', bg: 'Trade-in' }, battle: { fa: 'نبرد', bg: 'Battle' }, lastBattle: { fa: 'آخرین نبرد', bg: 'Last Battle' },
  attack: { fa: 'حمله', bg: 'Attack' }, attackDo: { fa: 'حمله کنید', bg: 'Attack' }, occupy: { fa: 'اشغال', bg: 'Occupy' },
  attacker: { fa: 'مهاجم', bg: 'Attacker' }, defender: { fa: 'مدافع', bg: 'Defender' }, losses: { fa: 'تلفات', bg: 'Losses' },
  conquest: { fa: 'فتح', bg: 'Conquest' }, conquered: { fa: 'فتح شد', bg: 'Conquered' }, eliminated: { fa: 'حذف شد', bg: 'Eliminated' },
  die: { fa: 'تاس', bg: 'Dice' }, diceEz: { fa: 'تاس‌های', bg: 'Dice' }, diceRolling: { fa: 'تاس‌ها در حال چرخیدن', bg: 'Dice rolling' }, attackDice: { fa: 'تعداد تاس حمله', bg: 'Attack Dice' },
  round: { fa: 'دور', bg: 'Round' },
  endAttack: { fa: 'پایان حمله', bg: 'End Attack' }, endTurn: { fa: 'پایان نوبت', bg: 'End Turn' }, confirmOccupy: { fa: 'تأیید اشغال', bg: 'Confirm Occupy' },
  placeBtn: { fa: 'ثبت جای‌گذاری', bg: 'Place Armies' }, armiesIn: { fa: 'ارتش ورودی', bg: 'Armies Moving In' }, armiesMoving: { fa: 'ارتش‌های جابه‌جاشونده', bg: 'Armies to Move' },
  worldMapRisk: { fa: 'نقشه جهان ریسک', bg: 'Risk World Map' }, worldMap: { fa: 'نقشه جهان', bg: 'World Map' }
} satisfies Record<string, Term>;

const TERRITORY_EN: Record<TerritoryId, string> = {
  alaska: 'Alaska', northwestTerritory: 'Northwest Territory', greenland: 'Greenland', alberta: 'Alberta', ontario: 'Ontario', quebec: 'Quebec',
  westernUS: 'Western United States', easternUS: 'Eastern United States', centralAmerica: 'Central America',
  venezuela: 'Venezuela', peru: 'Peru', brazil: 'Brazil', argentina: 'Argentina',
  iceland: 'Iceland', scandinavia: 'Scandinavia', greatBritain: 'Great Britain', northernEurope: 'Northern Europe', westernEurope: 'Western Europe', southernEurope: 'Southern Europe', ukraine: 'Ukraine',
  northAfrica: 'North Africa', egypt: 'Egypt', eastAfrica: 'East Africa', congo: 'Congo', southAfrica: 'South Africa', madagascar: 'Madagascar',
  ural: 'Ural', siberia: 'Siberia', yakutsk: 'Yakutsk', kamchatka: 'Kamchatka', irkutsk: 'Irkutsk', mongolia: 'Mongolia', japan: 'Japan', afghanistan: 'Afghanistan', china: 'China', middleEast: 'Middle East', india: 'India', siam: 'Siam',
  indonesia: 'Indonesia', newGuinea: 'New Guinea', westernAustralia: 'Western Australia', easternAustralia: 'Eastern Australia'
};
const CONTINENT_EN: Record<ContinentId, string> = { na: 'North America', sa: 'South America', eu: 'Europe', af: 'Africa', as: 'Asia', au: 'Australia' };
const CARD_EN: Record<CardKind, string> = { infantry: 'Infantry', cavalry: 'Cavalry', artillery: 'Artillery', wild: 'Wild' };

/** Official English board names; `fa` is read from board.ts so the Persian output cannot drift. */
export const territoryTerm = Object.fromEntries(Object.entries(TERRITORY_EN).map(([id, bg]) => [id, { fa: TERRITORY_FA[id as TerritoryId], bg }])) as Record<TerritoryId, Term>;
export const continentTerm = Object.fromEntries(CONTINENTS.map((c) => [c.id, { fa: c.nameFa, bg: CONTINENT_EN[c.id] }])) as Record<ContinentId, Term>;
export const cardTerm = Object.fromEntries(Object.entries(CARD_EN).map(([k, bg]) => [k, { fa: CARD_FA[k as CardKind], bg }])) as Record<CardKind, Term>;
