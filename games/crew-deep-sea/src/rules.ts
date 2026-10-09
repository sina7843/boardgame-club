// The Crew: Mission Deep Sea («خدمه: اعماق دریا»), cooperative trick-taking for 3–5 (2 only in the tutorial). Same
// trick core and communication as Planet Nine (shared `crewModule`), but tasks are conditions with a difficulty
// value: tasks are revealed until their difficulty reaches the mission target, then drafted from the commander.
// The condition set is an original selection in the spirit of the published game (not its exact card list).
import { crewModule, shuffle, suit, rank, cardFa, sortHand, DECK, type CrewTask, type Edition } from '@bg/game-the-crew';
import { crewDeepSea } from './definition.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
type Cond = 'card' | 'firstTrick' | 'nine' | 'fiveTrick' | 'lastTrick' | 'noColor' | 'rocket' | 'noRockets' | 'noNines' | 'lowTrick' | 'moreThan' | 'tricksExact' | 'noTricks' | 'winWith1' | 'allColors';
export const DIFFICULTY: Record<Cond, number> = {
  card: 1, firstTrick: 1, nine: 1, fiveTrick: 1, lastTrick: 2, noColor: 2, rocket: 2, noRockets: 2, noNines: 2, lowTrick: 2, moreThan: 2,
  tricksExact: 3, noTricks: 3, winWith1: 3, allColors: 3
};
const SUIT_FA: Record<string, string> = { p: 'صورتی', b: 'آبی', g: 'سبز', y: 'زرد' };

export function taskLabel(t: CrewTask): string {
  switch (t.cond as Cond) {
    case 'card': return `کارت ${cardFa(t.arg!)} را ببرید`;
    case 'firstTrick': return 'دست اول را ببرید';
    case 'nine': return 'دست‌کم یک ۹ ببرید';
    case 'fiveTrick': return 'دست‌کم یک ۵ ببرید';
    case 'lastTrick': return 'دست آخر را ببرید';
    case 'noColor': return `هیچ کارت ${SUIT_FA[t.arg!]} نبرید`;
    case 'rocket': return `موشک ${fa(rank(t.arg!))} را ببرید`;
    case 'noRockets': return 'هیچ موشکی نبرید';
    case 'noNines': return 'هیچ ۹ نبرید';
    case 'lowTrick': return 'دستی ببرید که همهٔ کارت‌هایش ۵ یا کمتر باشد (بی‌موشک)';
    case 'moreThan': return `کارت ${SUIT_FA[t.arg![0]!]} بیشتری از ${SUIT_FA[t.arg![1]!]} ببرید`;
    case 'tricksExact': return `دقیقاً ${fa(t.n!)} دست ببرید`;
    case 'noTricks': return 'هیچ دستی نبرید';
    case 'winWith1': return 'دستی را با یک کارت ۱ ببرید';
    case 'allColors': return 'از هر چهار رنگ دست‌کم یک کارت ببرید';
  }
  return '';
}

export const TARGETS = [3, 5, 7, 9, 11];

const edition: Edition = {
  makeTasks(rng, mission, core) {
    const target = TARGETS.includes(mission) ? mission : 3;
    const pool = shuffle(rng, Object.keys(DIFFICULTY) as Cond[]);
    const cards = shuffle(rng, DECK.filter((c) => suit(c) !== 'r' && c !== core.aside));
    const suits = shuffle(rng, ['p', 'b', 'g', 'y']);
    const out: CrewTask[] = [];
    let sum = 0;
    for (const cond of pool) {
      if (sum >= target) break;
      const t: CrewTask = { id: out.length, owner: null, status: 'open', cond, difficulty: DIFFICULTY[cond] };
      if (cond === 'card') t.arg = cards.pop()!;
      if (cond === 'noColor') t.arg = suits[0]!;
      if (cond === 'moreThan') t.arg = `${suits[1]}${suits[2]}`;
      if (cond === 'rocket') t.arg = `r${1 + rng.nextInt(3)}`;
      if (cond === 'tricksExact') t.n = 1 + rng.nextInt(2);
      out.push(t);
      sum += DIFFICULTY[cond];
    }
    return out;
  },
  evaluate(s, trick) {
    for (const t of s.tasks) {
      if (t.status !== 'open' || t.owner === null) continue;
      const o = t.owner;
      const mine = s.won[o]!.flat();
      const coloured = (cs: string[]) => cs.filter((c) => suit(c) !== 'r');
      if (trick) {
        const cards = trick.cards.map((p) => p.card);
        const w = trick.winner === o;
        const has = (f: (c: string) => boolean) => cards.some(f);
        switch (t.cond as Cond) {
          case 'card': case 'rocket': if (cards.includes(t.arg!)) t.status = w ? 'done' : 'failed'; break;
          case 'firstTrick': if (s.tricks === 1) t.status = w ? 'done' : 'failed'; break;
          case 'nine': if (w && has((c) => suit(c) !== 'r' && rank(c) === 9)) t.status = 'done'; break;
          case 'fiveTrick': if (w && has((c) => suit(c) !== 'r' && rank(c) === 5)) t.status = 'done'; break;
          case 'noColor': if (w && has((c) => suit(c) === t.arg)) t.status = 'failed'; break;
          case 'noRockets': if (w && has((c) => suit(c) === 'r')) t.status = 'failed'; break;
          case 'noNines': if (w && has((c) => suit(c) !== 'r' && rank(c) === 9)) t.status = 'failed'; break;
          case 'lowTrick': if (w && !has((c) => suit(c) === 'r' || rank(c) > 5)) t.status = 'done'; break;
          case 'tricksExact': if (s.won[o]!.length > t.n!) t.status = 'failed'; break;
          case 'noTricks': if (w) t.status = 'failed'; break;
          case 'winWith1': { const mineCard = trick.cards.find((p) => p.seat === o)?.card; if (w && mineCard && suit(mineCard) !== 'r' && rank(mineCard) === 1) t.status = 'done'; break; }
          case 'allColors': if (['p', 'b', 'g', 'y'].every((x) => coloured(mine).some((c) => suit(c) === x))) t.status = 'done'; break;
          default: break;
        }
      } else {
        switch (t.cond as Cond) {
          case 'lastTrick': t.status = s.lastTrick?.winner === o ? 'done' : 'failed'; break;
          case 'noColor': case 'noRockets': case 'noNines': case 'noTricks': t.status = 'done'; break;
          case 'tricksExact': t.status = s.won[o]!.length === t.n ? 'done' : 'failed'; break;
          case 'moreThan': { const n = (x: string) => mine.filter((c) => suit(c) === x).length; t.status = n(t.arg![0]!) > n(t.arg![1]!) ? 'done' : 'failed'; break; }
          default: t.status = 'failed';
        }
      }
    }
  },
  tutorialSetup(s) {
    // Two players, four cards each, three condition tasks: one resolved during play (a nine), two checked at the end
    // of the hand (the teammate wins exactly one trick, the learner wins the last trick).
    Object.assign(s, {
      players: 2, hands: [sortHand(['p9', 'g2', 'b8', 'r4']), sortHand(['p3', 'g6', 'y5', 'b4'])], aside: null, commander: 0, current: 0, drafter: 0,
      won: [[], []], comms: [null, null], commsUsed: [false, false], timeouts: [0, 0],
      tasks: [
        { id: 0, owner: null, status: 'open', cond: 'nine', difficulty: 1 }, { id: 1, owner: null, status: 'open', cond: 'tricksExact', n: 1, difficulty: 3 },
        { id: 2, owner: null, status: 'open', cond: 'lastTrick', difficulty: 2 }
      ]
    });
  },
  tutorial: {
    seed: 11,
    options: { deal: 'tutorial' },
    introFa: 'در کرو همه با هم می‌برید یا می‌بازید. در اعماق دریا هر وظیفه یک شرط است برای صاحبش. این ماموریت دونفره سه وظیفه دارد (جمع سختی ۶): «دست‌کم یک ۹ ببرید» (سختی ۱)، «دقیقاً ۱ دست ببرید» (سختی ۳) و «دست آخر را ببرید» (سختی ۲). هر کدام چهار کارت دارید و شما موشک ۴ دارید، پس فرمانده‌اید: اول وظیفه برمی‌دارید و دست اول را شروع می‌کنید.',
    steps: [
      { instructionFa: 'وظیفهٔ «دست‌کم یک ۹ ببرید» را بردارید؛ صورتی ۹ دارید و هم‌تیمی فقط صورتی ۳ دارد. وظیفه‌ها به نوبت، از فرمانده به بعد، یکی‌یکی برداشته می‌شوند.', expected: { type: 'draftTask', task: 0 }, reply: { type: 'draftTask', task: 1 } },
      { instructionFa: 'هم‌تیمی «دقیقاً ۱ دست ببرید» را برداشت. وظیفهٔ آخر، «دست آخر را ببرید»، را شما بردارید؛ موشک ۴ قوی‌ترین کارت بازی است.', expected: { type: 'draftTask', task: 2 }, reply: null },
      { instructionFa: 'دست اول را با صورتی ۹ شروع کنید. هر کس باید از خال کارت اول پیروی کند، پس هم‌تیمی صورتی ۳ را می‌دهد و بزرگ‌ترین کارت خال اول دست را می‌برد. وظیفهٔ ۹ همین‌جا انجام می‌شود.', expected: { type: 'play', card: 'p9' }, reply: { type: 'play', card: 'p3' } },
      { instructionFa: 'وظیفهٔ ۹ انجام شد. حالا هم‌تیمی باید دقیقاً یک دست ببرد: سبز ۲ را بازی کنید تا او با سبز ۶ این دست را ببرد. اگر یک دست دیگر هم ببرد، وظیفه‌اش همان لحظه شکست می‌خورد.', expected: { type: 'play', card: 'g2' }, reply: { type: 'play', card: 'g6' } },
      { instructionFa: 'هم‌تیمی برد و دست بعد را او شروع می‌کند. بین دو دست، هر کس یک بار در کل ماموریت می‌تواند بی‌حرف یک کارت رنگی را نشان دهد: بالاترین، پایین‌ترین یا تنها کارت آن رنگ در دستش. «ارتباط» را بزنید و آبی ۸ را نشان دهید که تنها آبی شماست؛ هم‌تیمی می‌فهمد آبی ۴ او دست آبی را نمی‌برد.', expected: { type: 'communicate', card: 'b8' }, reply: { type: 'play', card: 'y5' } },
      { instructionFa: 'هم‌تیمی زرد ۵ را شروع کرد. زرد ندارید، پس هر کارتی مجاز است. موشک ۴ را بازی کنید: موشک‌ها از همهٔ رنگ‌ها قوی‌ترند، این دست مال شما می‌شود و هم‌تیمی همان یک دستش را نگه می‌دارد.', expected: { type: 'play', card: 'r4' }, reply: null },
      { instructionFa: 'آبی ۸ را بازی کنید. هم‌تیمی باید با آبی ۴ پیروی کند و شما دست آخر را می‌برید.', expected: { type: 'play', card: 'b8' }, reply: { type: 'play', card: 'b4' } }
    ],
    completedFa: 'ماموریت موفق! وظیفهٔ ۹ در دست اول انجام شد. دو وظیفهٔ دیگر در پایان سنجیده شدند: هم‌تیمی دقیقاً ۱ دست برد (سبز) و شما دست آخر را با آبی ۸ بردید. هر سه وظیفه انجام شد، پس کل خدمه با هم برد؛ کافی بود یکی شکست بخورد تا همه ببازید.'
  }
};

export const deepSeaModule = crewModule(crewDeepSea.manifest, edition);
