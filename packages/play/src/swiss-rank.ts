// Swiss ranking for head-to-head events, following the FIDE Tie-Break Regulations (Handbook C.07, in force from
// 1 March 2026). Pure: works on per-player round records, so it is testable without a database.
//
// Order applied to players on equal points (published in the tournament rules, Art. 4.1):
//   1. Buchholz Cut-1   (Art. 8, 14.1)  sum of opponents' scores, lowest dropped
//   2. Buchholz         (Art. 8.1)
//   3. Average rating of opponents (Art. 10.1)  played games only, rounded half up; skipped unless EVERY player
//                                     has a rating (Art. 10: rating-based tie-breaks are dropped with unrated players)
//   4. Sonneborn-Berger (Art. 9)
//   5. Direct encounter (Art. 6)        only among the tied players, forfeits excluded
//   6. Number of wins   (Art. 7)        won rounds including byes and forfeits
//   7. Wins with Black  (played games only)
// Players still tied share the rank (FIDE: drawing of lots; the platform splits the prize instead).
//
// Unplayed rounds (Art. 15-16): a bye or forfeit is scored against a virtual opponent. Reading used here:
// score = own points before the round + the points awarded for it + a draw for every later round; capped at a draw
// per round, and for forfeits at the scheduled opponent's final score.

export type RoundKind = 'played' | 'forfeitWin' | 'forfeitLoss' | 'bye' | 'requestedBye';

export interface RoundRecord {
  round: number;
  kind: RoundKind;
  result: number;
  /** The real (or scheduled, for a forfeit) opponent; null for byes. */
  opponent: string | null;
  /** Played games only: the side the player had (first mover = White in chess). */
  side: 'first' | 'second' | null;
}

export interface PlayerRecord { id: string; rounds: RoundRecord[] }

export interface FideStats {
  points: number;
  buchholzCut1: number;
  buchholz: number;
  sonnebornBerger: number;
  /** Average rating of opponents actually played; null when no ratings were given. */
  aro: number | null;
  /** Tournament performance rating (played games only; null without ratings or without a played game). */
  tpr: number | null;
  wins: number;
  blackWins: number;
}

/** Display rating per player before the event; the ARO criterion is used only when this covers every player. */
export type Ratings = ReadonlyMap<string, number>;

const EPS = 1e-9;
const DRAW = 0.5;

/**
 * Rating difference for a score fraction p: the normal-distribution model behind the FIDE conversion table
 * (sigma = 200 x sqrt 2), clamped to +-800 like the table. Approximates the published table within a few points.
 */
export function ratingDifference(p: number): number {
  if (p <= 0) return -800;
  if (p >= 1) return 800;
  // Acklam's rational approximation of the inverse normal CDF.
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  let z: number;
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); z = (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1); }
  else if (p > 1 - lo) { const q = Math.sqrt(-2 * Math.log(1 - p)); z = -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1); }
  else { const q = p - 0.5, r = q * q; z = (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1); }
  return Math.max(-800, Math.min(800, Math.round(z * 200 * Math.SQRT2)));
}

/** Performance rating: average opponent rating plus the rating difference for the score achieved over the games played. */
export const performanceRating = (aro: number, score: number, games: number): number => aro + ratingDifference(score / games);

/** ARO is meaningful only when every player has a rating. */
const complete = (players: PlayerRecord[], ratings?: Ratings): ratings is Ratings => !!ratings && players.every((p) => ratings.has(p.id));

export function fideStats(players: PlayerRecord[], totalRounds: number, ratings?: Ratings): Map<string, FideStats> {
  const useAro = complete(players, ratings);
  const points = new Map(players.map((p) => [p.id, p.rounds.reduce((s, r) => s + r.result, 0)]));
  const out = new Map<string, FideStats>();
  for (const p of players) {
    let before = 0;
    const bh: number[] = [];
    let sb = 0, wins = 0, blackWins = 0;
    for (const r of [...p.rounds].sort((a, b) => a.round - b.round)) {
      const real = r.kind === 'played' ? (points.get(r.opponent!) ?? 0) : null;
      let their: number;
      if (real !== null) their = real;
      else {
        const virtual = before + r.result + DRAW * Math.max(0, totalRounds - r.round);
        const cap = r.kind === 'forfeitWin' || r.kind === 'forfeitLoss' ? (points.get(r.opponent ?? '') ?? DRAW * totalRounds) : DRAW * totalRounds;
        their = Math.min(virtual, cap);
      }
      bh.push(their);
      sb += r.result * their;
      if (r.result === 1) { wins++; if (r.kind === 'played' && r.side === 'second') blackWins++; }
      before += r.result;
    }
    const total = bh.reduce((s, x) => s + x, 0);
    const met = useAro ? p.rounds.filter((r) => r.kind === 'played' && r.opponent).map((r) => ratings.get(r.opponent!) ?? 0) : [];
    const aro = useAro ? (met.length ? Math.floor(met.reduce((s, x) => s + x, 0) / met.length + 0.5) : 0) : null;
    const playedScore = p.rounds.filter((r) => r.kind === 'played').reduce((x, r) => x + r.result, 0);
    const tpr = aro !== null && met.length ? performanceRating(aro, playedScore, met.length) : null;
    out.set(p.id, { points: points.get(p.id)!, buchholzCut1: bh.length ? total - Math.min(...bh) : 0, buchholz: total, sonnebornBerger: sb, aro, tpr, wins, blackWins });
  }
  return out;
}

/** Direct encounter among `group` (Art. 6): split off whoever is guaranteed first, repeat; the rest stay tied. */
export function directEncounter(group: string[], byId: Map<string, PlayerRecord>): string[][] {
  const mini = (ids: string[]) => new Map(ids.map((id) => {
    const per = new Map<string, number[]>();
    for (const r of byId.get(id)!.rounds) if (r.kind === 'played' && r.opponent && ids.includes(r.opponent)) per.set(r.opponent, [...(per.get(r.opponent) ?? []), r.result]);
    const score = [...per.values()].reduce((s, rs) => s + rs.reduce((a, b) => a + b, 0) / rs.length, 0);
    return [id, { score, missing: ids.length - 1 - per.size }] as const;
  }));
  const parts: string[][] = [];
  let rest = group;
  while (rest.length > 1) {
    const m = mini(rest);
    const top = rest.find((p) => rest.every((q) => q === p || m.get(p)!.score > m.get(q)!.score + m.get(q)!.missing + EPS));
    if (!top) break;
    parts.push([top]);
    rest = rest.filter((x) => x !== top);
  }
  if (!parts.length) return [group];
  parts.push(rest);
  return parts;
}

/** Players grouped by final standing, best first; players in one group are tied and share the rank. */
export function fideRank(players: PlayerRecord[], totalRounds: number, ratings?: Ratings): string[][] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const stats = fideStats(players, totalRounds, ratings);
  const by = (f: (s: FideStats) => number) => (group: string[]): string[][] => {
    const buckets: string[][] = [];
    for (const id of [...group].sort((a, b) => f(stats.get(b)!) - f(stats.get(a)!))) {
      const last = buckets.at(-1);
      if (last && Math.abs(f(stats.get(last[0]!)!) - f(stats.get(id)!)) < EPS) last.push(id); else buckets.push([id]);
    }
    return buckets;
  };
  const criteria = [
    by((s) => s.buchholzCut1), by((s) => s.buchholz),
    ...(complete(players, ratings) ? [by((s) => s.aro ?? 0)] : []),
    by((s) => s.sonnebornBerger),
    (g: string[]) => directEncounter(g, byId), by((s) => s.wins), by((s) => s.blackWins)
  ];
  const resolve = (group: string[], i: number): string[][] => {
    if (group.length < 2 || i >= criteria.length) return [group];
    return criteria[i]!(group).flatMap((part) => resolve(part, i + 1));
  };
  return by((s) => s.points)(players.map((p) => p.id)).flatMap((g) => resolve(g, 0));
}
