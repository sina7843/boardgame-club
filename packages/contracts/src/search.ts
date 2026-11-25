// Game search shared by the header (client) and GET /games?q= (server searchText): aliases, Finglish and typos.
import { normalizeSearch } from './text.ts';

/**
 * Other names people type for each game: alternative Persian names (design/GAME_NAMES.md, old site names) and
 * common Finglish spellings. nameFa/nameOriginal come from the catalog and are not repeated here.
 */
export const GAME_ALIASES: Record<string, string[]> = {
  abalone: ['آبالون', 'abalon', 'ablon', 'abaloon'],
  amlak: ['املاک', 'تجارت املاک', 'monopoli', 'monopol', 'amlak', 'emlak'],
  'ark-nova': ['آرک نووا', 'ark nova', 'arknova', 'ark noova'],
  azul: ['azool', 'azol'],
  backgammon: ['تخته نرد', 'نرد', 'takhte nard', 'takhtenard', 'takhte', 'nard', 'tachte nard', 'bakgamon'],
  battleship: ['نبرد دریایی', 'نبرد کشتی‌ها', 'کشتی‌های جنگی', 'battle ship', 'batelship', 'nabard daryayi'],
  'blood-rage': ['بلود ریج', 'blad rej', 'blood rej', 'bladrage', 'bloodrage'],
  bohnanza: ['بوهنانزا', 'بونانزا', 'jaliz', 'jaaliz', 'bonanza'],
  brass: ['برس بیرمنگام', 'بیرمنگام', 'beras', 'bras', 'birmingam', 'birmangam'],
  'camel-up': ['کمل آپ', 'شتر سواری', 'shotor savari', 'shotorsavari', 'kamel ap', 'camelup'],
  carcassonne: ['کارکاسن', 'karkason', 'karkasoon', 'carcasson', 'karkasun'],
  catan: ['مهاجران کاتان', 'katan', 'kataan', 'catan settlers', 'mohajeran katan'],
  century: ['سنچری', 'جاده ادویه', 'قرن', 'تجارت ادویه', 'senchori', 'senchery', 'jade abrisham', 'jadeh abrisham', 'spice road'],
  checkers: ['دام', 'دامه', 'chekerz', 'chekers', 'dam', 'draughts'],
  chess: ['shatranj', 'shatrange', 'shatrang', 'shatranc'],
  citadels: ['سیتادلز', 'کهن دژ', 'sitadelz', 'citadel', 'dezh', 'dej', 'kohan dezh'],
  'cockroach-poker': ['سوسکی', 'سوسک دغل‌باز', 'کاکروچ پوکر', 'soosk', 'sosk', 'sooski', 'kakrooch poker'],
  coup: ['کوپ', 'koodeta', 'kudeta', 'kodeta', 'koop'],
  'crew-deep-sea': ['گروه اعماق دریا', 'خدمه اعماق دریا', 'kroo', 'krew', 'crew deep sea', 'aamagh darya'],
  cryptid: ['kriptid', 'criptid', 'kreptid'],
  'dice-throne': ['dais toron', 'dice tron', 'daystron', 'dais teron'],
  dominion: ['dominyon', 'dominiun', 'doominion'],
  'el-dorado': ['در جست‌وجوی الدورادو', 'ال دورادو', 'eldorado', 'el dorado', 'mabad eldorado'],
  'for-sale': ['فور سیل', 'haraji', 'harraji', 'forsale', 'for seil'],
  'gaia-project': ['گایا پراجکت', 'گایا', 'gaya', 'gaia', 'gaya project', 'proje gaya'],
  go: ['وی‌چی', 'weiqi', 'baduk'],
  hanabi: ['hanaabi', 'hanabee'],
  heat: ['هیت تخته گاز', 'تخته گاز', 'hit', 'heet'],
  'high-society': ['های سوسایتی', 'قشر مرفه', 'جامعه اشرافی', 'tabaghe ashrafi', 'hay sosaiti', 'highsociety'],
  hive: ['هایو', 'kandoo', 'kando', 'hayv'],
  jaipur: ['جیپور', 'jaypur', 'jeypur', 'jaipoor'],
  'king-of-tokyo': ['کینگ آف توکیو', 'padeshah tokyo', 'king of tokio', 'kingoftokyo', 'tokyo'],
  kingdomino: ['کینگ دومینو', 'کینگدومینو', 'king domino', 'kingdomeno'],
  'line-three': ['ایکس او', 'سه خطی', 'xo', 'tic tac toe', 'tictactoe', 'dooz', 'doz'],
  'lost-cities': ['لاست سیتیز', 'shahrhaye gomshode', 'lost sitis', 'lostcities'],
  'love-letter': ['لاو لتر', 'نامه‌ای به گیلاس', 'nameh asheghane', 'name asheghane', 'lav leter', 'loveletter'],
  ludo: ['menc', 'monch', 'manch', 'mench', 'monj', 'loodo'],
  'machi-koro': ['machikoro', 'machi koro', 'maachi koro'],
  'no-thanks': ['نو تنکس', 'na mersi', 'nah mersi', 'no tanks', 'nothanks'],
  onitama: ['oonitama', 'onitamaa'],
  othello: ['ریورسی', 'رورسی', 'otelo', 'otello', 'reversi'],
  patchwork: ['پچورک', 'pachwork', 'pach work', 'patchvork'],
  'point-salad': ['پوینت سالاد', 'salad emtiaz', 'point salad', 'poynt salad'],
  quoridor: ['koridor', 'kooridor', 'quridor'],
  'race-galaxy': ['ریس فور گلکسی', 'race galaxy', 'reis for galaxy', 'galaxy'],
  'res-arcana': ['رس آرکانا', 'jadooye kohan', 'jadoye kohan', 'res arkana', 'resarcana'],
  risk: ['risc', 'riskk'],
  santorini: ['santorin', 'santoreeni'],
  scout: ['eskat', 'eskaat', 'skaut'],
  'sea-salt-paper': ['سی سالت اند پیپر', 'namak daryayi', 'sea salt', 'si salt'],
  'sealed-bids': ['مزایده', 'mozayede', 'mozayede sarbaste', 'sealed bid'],
  set: ['sett', 'set card'],
  'six-nimmt': ['شش نیمت', 'شیش قلو', 'شش قلو', 'shish ghaloo', 'shesh nimt', '6 nimt', 'six nimmt'],
  skull: ['اسکال', 'jomjome', 'jomjomeh', 'eskal'],
  'snakes-ladders': ['مار و پله', 'mar pele', 'marpele', 'maar o pele', 'snakes and ladders'],
  'space-base': ['پایگاه فضایی', 'speis bis', 'spacebase', 'espace base'],
  splendor: ['اسپلندور', 'kahroba', 'kahruba', 'esplendor', 'splender'],
  'star-realms': ['استار رلمز', 'ghalamro setaregan', 'star relms', 'starrealms'],
  'sushi-go': ['سوشی گو پارتی', 'sooshi go', 'sushigo', 'sushi'],
  tak: ['taak', 'tack'],
  'terraforming-mars': ['تررافورمینگ مارس', 'زمین‌ساز', 'teraforming', 'terraforming', 'teraforming mars', 'mars'],
  'the-crew': ['گروه', 'خدمه', 'کرو', 'the crew', 'kroo', 'krew'],
  'the-mind': ['د مایند', 'مایند', 'zehn', 'maind', 'mind'],
  'ticket-to-ride': ['بلیط حرکت', 'بلیط برای سواری', 'شاهراه', 'tiket to raid', 'ticket to raid', 'shahrah', 'belit harekat'],
  unmatched: ['بی‌همتا', 'انمچد', 'anmached', 'unmached', 'bi hamta'],
  uno: ['oono', 'ono', 'oonoo'],
  'wonders-duel': ['سون واندرز دوئل', 'عجایب هفتگانه', 'seven wonders duel', '7 wonders', 'son wonders', 'ajayeb'],
  yahtzee: ['yatzi', 'yatzy', 'yahtzi', 'yatsi']
};

/** Optimal-string-alignment Damerau-Levenshtein distance (adjacent swaps count as one edit). */
export function damerauLevenshtein(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

/** Edits a query token may be off by: none under 4 chars (no false hits on short queries), 1 for 4 to 7, 2 for 8+. */
const typoBudget = (len: number) => (len < 4 ? 0 : len < 8 ? 1 : 2);

/** Text the server stores in games.searchText so `GET /games?q=` also finds aliases. */
export function gameSearchText(g: { id: string; nameFa: string; nameOriginal: string }): string {
  return normalizeSearch([g.nameFa, g.nameOriginal, ...(GAME_ALIASES[g.id] ?? [])].join(' '));
}

type Searchable = { id: string; nameFa: string; nameOriginal: string };

/** 0 exact/prefix · 1 name contains · 2 alias · 3 typo · -1 no match. */
function rank(g: Searchable, q: string): number {
  const qc = q.replace(/ /g, '');
  const names = [g.nameFa, g.nameOriginal].map(normalizeSearch);
  const aliases = (GAME_ALIASES[g.id] ?? []).map(normalizeSearch);
  const compact = (s: string) => s.replace(/[ :!&.-]/g, '');
  if (names.some((n) => n.startsWith(q) || compact(n).startsWith(qc))) return 0;
  if (names.some((n) => n.includes(q) || compact(n).includes(qc))) return 1;
  if (aliases.some((a) => a.startsWith(q) || compact(a).startsWith(qc) || (qc.length >= 3 && compact(a).includes(qc)))) return 2;
  // Typos: every query token is close to (or a prefix of) a word of a name or alias, or the whole query to a whole name.
  const all = [...names, ...aliases];
  const words = all.flatMap((s) => s.split(/[ :!&.-]+/)).filter(Boolean);
  const near = (t: string, w: string) => {
    const k = typoBudget(t.length);
    return k > 0 && (damerauLevenshtein(t, w) <= k || (w.length > t.length && damerauLevenshtein(t, w.slice(0, t.length)) <= k));
  };
  const tokens = q.split(' ');
  if (tokens.every((t) => words.some((w) => w.startsWith(t) || near(t, w)))) return 3;
  if (all.some((s) => near(qc, compact(s)))) return 3;
  return -1;
}

/** Games matching the query, best first (stable within a rank). Empty query: none. */
export function matchGames<T extends Searchable>(query: string, games: readonly T[]): T[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  return games.map((g) => ({ g, r: rank(g, q) })).filter((x) => x.r >= 0).sort((a, b) => a.r - b.r).map((x) => x.g);
}
