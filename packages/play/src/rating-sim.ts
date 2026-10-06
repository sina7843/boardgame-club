// Rating simulation used as evidence before enabling ranked play (Requirements §11).
// Run: pnpm --filter @bg/play simulate > docs/evidence/phase-03/rating-simulation.md
// Deterministic (seeded). Outcomes are drawn from hidden "true" skills with Gaussian performance noise.
import { DEFAULT_RATING, displayRating, newSkill, rate, type Skill } from './rating.ts';

let seed = 20261006;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
const beta = DEFAULT_RATING.beta;

// Gumbel performance noise makes pairwise outcomes logistic, i.e. consistent with the Bradley–Terry model being
// evaluated (scale √2·beta ≈ the model's c once sigma is small). Gaussian noise would mis-scale the 'true' skills.
const gumbel = () => -Math.log(-Math.log(rand() + 1e-12));

/** Places from noisy performances; performances within `tieBand` share a place (draws / equal scores). */
function playOut(trueSkills: number[], tieBand = 0): number[] {
  const perf = trueSkills.map((t) => t + Math.SQRT2 * beta * gumbel());
  return perf.map((p) => 1 + perf.filter((o) => o > p + tieBand).length);
}

function spearman(a: number[], b: number[]): number {
  const rank = (xs: number[]) => xs.map((x) => xs.filter((y) => y < x).length);
  const ra = rank(a); const rb = rank(b);
  const n = a.length;
  const d2 = ra.reduce((acc, r, i) => acc + (r - rb[i]!) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

const f = (x: number, d = 2) => x.toFixed(d);
const out: string[] = [];
const line = (s = '') => out.push(s);

line('# Rating simulation (DRAGON-03)');
line();
line(`Model: Weng–Lin Bradley–Terry full pairing. Parameters: mu0 ${DEFAULT_RATING.mu0}, sigma0 ${f(DEFAULT_RATING.sigma0)}, beta ${f(beta)}, tau ${f(DEFAULT_RATING.tau, 3)}.`);
line('Display rating = round(60·mu) (1500 = new player). Leaderboard/league eligibility: ≥10 games and sigma ≤ 6.');
line('Seeded LCG, so the numbers below are reproducible.');
line();
line('Design note: an earlier draft displayed the conservative mu − 3·sigma. The repeated-opponent run below showed it');
line('rising from 1000 to ≈1780 for a 50% player purely because sigma shrinks with volume, so display and leagues now use');
line('the mean and certainty is enforced as an eligibility gate instead.');
line();

// 1. Population convergence, 2–4 player games
for (const size of [2, 3, 4]) {
  const n = 40;
  const truth = Array.from({ length: n }, () => 25 + 6 * gauss());
  const skills: Skill[] = truth.map(() => newSkill());
  const games = 1500;
  for (let g = 0; g < games; g++) {
    const idx: number[] = [];
    while (idx.length < size) { const k = Math.floor(rand() * n); if (!idx.includes(k)) idx.push(k); }
    const places = playOut(idx.map((k) => truth[k]!), size === 2 ? 0.3 : 0.15);
    const next = rate(idx.map((k, j) => ({ skill: skills[k]!, place: places[j]! })));
    idx.forEach((k, j) => { skills[k] = next[j]!; });
  }
  const rho = spearman(truth, skills.map((s) => s.mu));
  const meanSigma = skills.reduce((a, s) => a + s.sigma, 0) / n;
  line(`## ${size}-player games: ${n} players, ${games} games (≈${Math.round((games * size) / n)} each)`);
  line(`- Rank correlation (Spearman) between true skill and rated mu: **${f(rho, 3)}**`);
  line(`- Mean sigma: ${f(meanSigma)} (from ${f(DEFAULT_RATING.sigma0)})`);
  line();
}

// 2. New account: how many games until rating is meaningful
{
  const truth = 32; // strong newcomer
  let me = newSkill();
  const field = 25;
  line('## New account (strong newcomer, true mu 32, opponents at 25)');
  line('| games | mu | sigma | display |');
  line('|---|---|---|---|');
  for (let g = 1; g <= 30; g++) {
    const places = playOut([truth, field], 0.3);
    me = rate([{ skill: me, place: places[0]! }, { skill: { mu: field, sigma: 2 }, place: places[1]! }])[0]!;
    if ([1, 3, 5, 10, 20, 30].includes(g)) line(`| ${g} | ${f(me.mu)} | ${f(me.sigma)} | ${displayRating(me)} |`);
  }
  line('- Provisional label for the first 5 games; leaderboard/league eligibility after 10 games with sigma ≤ 6,');
  line('  Compare the display column with the true 1920: early estimates can be one or two league bands off, which is why');
  line('  new ratings are labelled provisional and the leaderboard is gated on certainty. These are tunable');
  line('  (provisional games, beta, tau) and should be revisited with real match data.');
  line();
}

// 3. Repeated opponent: equal players farming each other
{
  let a = newSkill(); let b = newSkill();
  for (let g = 0; g < 200; g++) {
    const aWins = g % 2 === 0;
    [a, b] = rate([{ skill: a, place: aWins ? 1 : 2 }, { skill: b, place: aWins ? 2 : 1 }]) as [Skill, Skill];
  }
  line('## Repeated opponent (same pair, 200 alternating results)');
  line(`- Final mu: ${f(a.mu)} / ${f(b.mu)}; display ${displayRating(a)} / ${displayRating(b)}.`);
  line('- Alternating results do not inflate either public rating: means stay at the prior. Collusion (one side always losing on');
  line('  purpose) is not something a rating formula can stop; it is handled by moderation signals and by XP limiting');
  line('  repeated-opponent rewards, and ranked tables can only be created through matchmaking.');
  line();
}

// 4. Resignation / timeout: an ordinary last place
{
  const [w1, l1] = rate([{ skill: newSkill(), place: 1 }, { skill: newSkill(), place: 2 }]);
  line('## Resignation and timeout');
  line(`- A resignation or timeout is recorded by the game module as a last place; the update equals any other loss:`);
  line(`  winner ${f(w1!.mu)} / loser ${f(l1!.mu)} (from 25.00). Platform incidents freeze deadlines, so system`);
  line('  failures do not produce timeouts; cancelled tables have no result and are never rated.');
  line();
}

// 5. Ties
{
  const [a, b] = rate([{ skill: { mu: 25, sigma: 4 }, place: 1 }, { skill: { mu: 25, sigma: 4 }, place: 1 }]);
  const [s, w] = rate([{ skill: { mu: 30, sigma: 3 }, place: 1 }, { skill: { mu: 20, sigma: 3 }, place: 1 }]);
  const four = rate([1, 1, 3, 3].map((place) => ({ skill: newSkill(), place })));
  line('## Ties and shared placement');
  line(`- Equal players draw: ${f(a!.mu)} / ${f(b!.mu)} (no change in mean).`);
  line(`- Strong (30) draws weak (20): strong → ${f(s!.mu)}, weak → ${f(w!.mu)}.`);
  line(`- Four players, places 1,1,3,3 (sealed-bids shared scores): ${four.map((x) => f(x.mu)).join(', ')}.`);
  line();
}

process.stdout.write(out.join('\n') + '\n');
