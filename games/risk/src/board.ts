// Classic RISK world map: 42 territories in 6 continents, standard adjacencies (incl. the sea lanes
// Alaska–Kamchatka, Greenland–Iceland, Brazil–North Africa, …). Indexes are stable: they key state arrays and cards.

export type ContinentId = 'na' | 'sa' | 'eu' | 'af' | 'as' | 'au';
export interface Continent { id: ContinentId; nameFa: string; bonus: number }

export const CONTINENTS: readonly Continent[] = [
  { id: 'na', nameFa: 'آمریکای شمالی', bonus: 5 },
  { id: 'sa', nameFa: 'آمریکای جنوبی', bonus: 2 },
  { id: 'eu', nameFa: 'اروپا', bonus: 5 },
  { id: 'af', nameFa: 'آفریقا', bonus: 3 },
  { id: 'as', nameFa: 'آسیا', bonus: 7 },
  { id: 'au', nameFa: 'استرالیا', bonus: 2 }
];

export const TERRITORY_IDS = [
  // North America (9)
  'alaska', 'northwestTerritory', 'greenland', 'alberta', 'ontario', 'quebec', 'westernUS', 'easternUS', 'centralAmerica',
  // South America (4)
  'venezuela', 'peru', 'brazil', 'argentina',
  // Europe (7)
  'iceland', 'scandinavia', 'greatBritain', 'northernEurope', 'westernEurope', 'southernEurope', 'ukraine',
  // Africa (6)
  'northAfrica', 'egypt', 'eastAfrica', 'congo', 'southAfrica', 'madagascar',
  // Asia (12)
  'ural', 'siberia', 'yakutsk', 'kamchatka', 'irkutsk', 'mongolia', 'japan', 'afghanistan', 'china', 'middleEast', 'india', 'siam',
  // Australia (4)
  'indonesia', 'newGuinea', 'westernAustralia', 'easternAustralia'
] as const;
export type TerritoryId = (typeof TERRITORY_IDS)[number];

export const TERRITORY_FA: Record<TerritoryId, string> = {
  alaska: 'آلاسکا', northwestTerritory: 'قلمرو شمال‌غربی', greenland: 'گرینلند', alberta: 'آلبرتا', ontario: 'انتاریو',
  quebec: 'کبک', westernUS: 'غرب آمریکا', easternUS: 'شرق آمریکا', centralAmerica: 'آمریکای مرکزی',
  venezuela: 'ونزوئلا', peru: 'پرو', brazil: 'برزیل', argentina: 'آرژانتین',
  iceland: 'ایسلند', scandinavia: 'اسکاندیناوی', greatBritain: 'بریتانیا', northernEurope: 'اروپای شمالی',
  westernEurope: 'اروپای غربی', southernEurope: 'اروپای جنوبی', ukraine: 'اوکراین',
  northAfrica: 'شمال آفریقا', egypt: 'مصر', eastAfrica: 'شرق آفریقا', congo: 'کنگو', southAfrica: 'آفریقای جنوبی', madagascar: 'ماداگاسکار',
  ural: 'اورال', siberia: 'سیبری', yakutsk: 'یاکوتسک', kamchatka: 'کامچاتکا', irkutsk: 'ایرکوتسک', mongolia: 'مغولستان',
  japan: 'ژاپن', afghanistan: 'افغانستان', china: 'چین', middleEast: 'خاورمیانه', india: 'هند', siam: 'سیام',
  indonesia: 'اندونزی', newGuinea: 'گینه نو', westernAustralia: 'استرالیای غربی', easternAustralia: 'استرالیای شرقی'
};

const CONTINENT_SIZES: [ContinentId, number][] = [['na', 9], ['sa', 4], ['eu', 7], ['af', 6], ['as', 12], ['au', 4]];
/** Continent of each territory (by index). */
export const CONTINENT_OF: readonly ContinentId[] = CONTINENT_SIZES.flatMap(([c, k]) => Array<ContinentId>(k).fill(c));

const BORDERS: [TerritoryId, TerritoryId][] = [
  ['alaska', 'northwestTerritory'], ['alaska', 'alberta'], ['alaska', 'kamchatka'],
  ['northwestTerritory', 'alberta'], ['northwestTerritory', 'ontario'], ['northwestTerritory', 'greenland'],
  ['greenland', 'ontario'], ['greenland', 'quebec'], ['greenland', 'iceland'],
  ['alberta', 'ontario'], ['alberta', 'westernUS'],
  ['ontario', 'westernUS'], ['ontario', 'easternUS'], ['ontario', 'quebec'],
  ['quebec', 'easternUS'],
  ['westernUS', 'easternUS'], ['westernUS', 'centralAmerica'], ['easternUS', 'centralAmerica'],
  ['centralAmerica', 'venezuela'],
  ['venezuela', 'peru'], ['venezuela', 'brazil'], ['peru', 'brazil'], ['peru', 'argentina'], ['brazil', 'argentina'],
  ['brazil', 'northAfrica'],
  ['iceland', 'greatBritain'], ['iceland', 'scandinavia'],
  ['scandinavia', 'greatBritain'], ['scandinavia', 'northernEurope'], ['scandinavia', 'ukraine'],
  ['greatBritain', 'northernEurope'], ['greatBritain', 'westernEurope'],
  ['northernEurope', 'ukraine'], ['northernEurope', 'southernEurope'], ['northernEurope', 'westernEurope'],
  ['westernEurope', 'southernEurope'], ['westernEurope', 'northAfrica'],
  ['southernEurope', 'ukraine'], ['southernEurope', 'middleEast'], ['southernEurope', 'egypt'], ['southernEurope', 'northAfrica'],
  ['ukraine', 'middleEast'], ['ukraine', 'afghanistan'], ['ukraine', 'ural'],
  ['northAfrica', 'egypt'], ['northAfrica', 'eastAfrica'], ['northAfrica', 'congo'],
  ['egypt', 'middleEast'], ['egypt', 'eastAfrica'],
  ['eastAfrica', 'congo'], ['eastAfrica', 'southAfrica'], ['eastAfrica', 'madagascar'], ['eastAfrica', 'middleEast'],
  ['congo', 'southAfrica'], ['southAfrica', 'madagascar'],
  ['ural', 'siberia'], ['ural', 'china'], ['ural', 'afghanistan'],
  ['siberia', 'yakutsk'], ['siberia', 'irkutsk'], ['siberia', 'mongolia'], ['siberia', 'china'],
  ['yakutsk', 'kamchatka'], ['yakutsk', 'irkutsk'],
  ['kamchatka', 'irkutsk'], ['kamchatka', 'mongolia'], ['kamchatka', 'japan'],
  ['irkutsk', 'mongolia'], ['mongolia', 'japan'], ['mongolia', 'china'],
  ['afghanistan', 'china'], ['afghanistan', 'india'], ['afghanistan', 'middleEast'],
  ['china', 'siam'], ['china', 'india'], ['middleEast', 'india'], ['india', 'siam'],
  ['siam', 'indonesia'],
  ['indonesia', 'newGuinea'], ['indonesia', 'westernAustralia'],
  ['newGuinea', 'westernAustralia'], ['newGuinea', 'easternAustralia'], ['westernAustralia', 'easternAustralia']
];

export const T = Object.fromEntries(TERRITORY_IDS.map((id, i) => [id, i])) as Record<TerritoryId, number>;
export const BORDER_PAIRS: readonly [number, number][] = BORDERS.map(([a, b]) => [T[a], T[b]]);
/** Neighbours of each territory (symmetric, sorted). */
export const ADJ: readonly number[][] = TERRITORY_IDS.map((_, i) =>
  BORDER_PAIRS.flatMap(([a, b]) => (a === i ? [b] : b === i ? [a] : [])).sort((x, y) => x - y));

export const continentTerritories = (c: ContinentId) => CONTINENT_OF.flatMap((x, i) => (x === c ? [i] : []));

// ---------- cards ----------
export type CardKind = 'infantry' | 'cavalry' | 'artillery' | 'wild';
export const CARD_FA: Record<CardKind, string> = { infantry: 'پیاده‌نظام', cavalry: 'سواره‌نظام', artillery: 'توپخانه', wild: 'جوکر' };
/** 42 territory cards (0–41, kind by index: 14 of each) + 2 wild cards (42, 43). */
export const CARD_COUNT = 44;
export const cardKind = (c: number): CardKind => (c >= 42 ? 'wild' : (['infantry', 'cavalry', 'artillery'] as const)[c % 3]!);
export const cardTerritory = (c: number): number | null => (c < 42 ? c : null);

/** Three cards form a set: three of a kind, one of each, or any two plus a wild. */
export function isSet(cards: readonly number[]): boolean {
  if (cards.length !== 3 || new Set(cards).size !== 3) return false;
  const kinds = cards.map(cardKind);
  if (kinds.includes('wild')) return true;
  const n = new Set(kinds).size;
  return n === 1 || n === 3;
}

/** Armies for the n-th set traded in the whole game (0-based): 4, 6, 8, 10, 12, 15, then +5 each. */
export const setValue = (k: number) => (k < 5 ? 4 + 2 * k : 15 + 5 * (k - 5));

export const STARTING_ARMIES: Record<number, number> = { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20 };
export const MAJORITY = 30;
