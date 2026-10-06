// Skill rating: Weng–Lin Bayesian approximation, Bradley–Terry full-pairing model
// (R. C. Weng & C.-J. Lin, "A Bayesian Approximation Method for Online Ranking", JMLR 12, 2011 — Algorithm 1;
// the same model family as the OpenSkill libraries). Each player has a Gaussian skill N(mu, sigma²).
// Free-for-all games with 2–4 players are treated as all pairwise comparisons; equal places are ties (s = ½).
// Pure functions: no I/O. Parameters are configuration, documented in docs/PROGRESSION.md.

export interface Skill { mu: number; sigma: number }

export interface RatingParams {
  mu0: number;
  sigma0: number;
  /** Performance noise per game. */
  beta: number;
  /** Added uncertainty before every game so sigma never collapses and skill can still move. */
  tau: number;
  /** Floor on the variance shrink factor (numerical safety). */
  kappa: number;
}

export const DEFAULT_RATING: RatingParams = { mu0: 25, sigma0: 25 / 3, beta: 25 / 6, tau: 25 / 300, kappa: 0.0001 };

export const newSkill = (p: RatingParams = DEFAULT_RATING): Skill => ({ mu: p.mu0, sigma: p.sigma0 });

/**
 * Update skills from one result. `place` 1 = best; equal places are ties (shared placement).
 * Returns new skills in the input order. Order of players does not matter.
 */
export function rate(players: { skill: Skill; place: number }[], p: RatingParams = DEFAULT_RATING): Skill[] {
  if (players.length < 2) throw new Error('rating needs at least two players');
  const pre = players.map(({ skill }) => ({ mu: skill.mu, var: skill.sigma ** 2 + p.tau ** 2 }));
  return players.map((me, i) => {
    let omega = 0;
    let delta = 0;
    const si = pre[i]!;
    players.forEach((other, q) => {
      if (q === i) return;
      const sq = pre[q]!;
      const c = Math.sqrt(si.var + sq.var + 2 * p.beta ** 2);
      const pIq = 1 / (1 + Math.exp((sq.mu - si.mu) / c));
      const s = me.place < other.place ? 1 : me.place === other.place ? 0.5 : 0;
      const gamma = Math.sqrt(si.var) / c;
      omega += (si.var / c) * (s - pIq);
      delta += gamma * (si.var / c ** 2) * pIq * (1 - pIq);
    });
    return { mu: si.mu + omega, sigma: Math.sqrt(si.var * Math.max(1 - delta, p.kappa)) };
  });
}

/**
 * Public rating = skill mean on a 1500 baseline (mu0 × 60). Deliberately NOT the conservative mu − 3σ: that value
 * rises with games played alone (σ shrinks), which would let volume buy leagues. Certainty is applied as an
 * eligibility gate instead (see ELIGIBILITY), so frequency never substitutes for skill (Requirements §11).
 */
export const displayRating = (s: Skill): number => Math.round(60 * s.mu);

/** Matchmaking uses the same scale (unrounded); the DRAGON-02 baseline 1500 equals a new player's mean. */
export const matchRating = (s: Skill): number => 60 * s.mu;

export interface Eligibility {
  /** Games before a rating stops being shown as provisional. */
  provisionalGames: number;
  /** Leaderboard: minimum games and maximum uncertainty. */
  leaderboardMinGames: number;
  leaderboardMaxSigma: number;
}
export const ELIGIBILITY: Eligibility = { provisionalGames: 5, leaderboardMinGames: 10, leaderboardMaxSigma: 6 };

export const LEAGUES = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'] as const;
export type League = (typeof LEAGUES)[number];

export interface SeasonConfig {
  /** Ranked games in the season before a player is placed in a league. */
  minGames: number;
  /** Minimum display rating per league (bronze is the floor). */
  thresholds: Record<Exclude<League, 'bronze'>, number>;
}

export const DEFAULT_SEASON: SeasonConfig = {
  minGames: 5,
  thresholds: { silver: 1350, gold: 1500, platinum: 1650, diamond: 1800, master: 1950 }
};

export function leagueFor(display: number, cfg: SeasonConfig = DEFAULT_SEASON): League {
  let league: League = 'bronze';
  for (const l of LEAGUES.slice(1) as Exclude<League, 'bronze'>[]) if (display >= cfg.thresholds[l]) league = l;
  return league;
}
