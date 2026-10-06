# Ranking, seasons, XP, missions and achievements

Code: `packages/play/src/rating.ts`, `packages/play/src/progression.ts`, outbox consumers in `packages/play/src/jobs.ts`,
API `apps/api/src/modules/progression/routes.ts`. Evidence: `docs/evidence/phase-03/rating-simulation.md`
(`pnpm --filter @bg/play simulate`).

## Inputs (never client claims)

| Event | Source | Used for |
|---|---|---|
| MatchCompleted | outbox `table.finished` written in the same transaction as the canonical `game_results` row | rating (ranked only), XP, missions, achievements |
| TutorialCompleted | outbox `tutorial.completed`, re-checked against the finished tutorial table and its result | tutorial XP, missions, achievements |
| GameMilestone | derived from the above: first completed game of a title, first place, first ranked game | XP, achievements |

There is no endpoint that accepts results, milestones, mission completions or XP from a client (tested: those
paths return 404; manual rewards require the admin role and a reason). Cancelled tables have no result and award
nothing. Tutorials never affect ratings.

## Rating model

Weng–Lin Bayesian approximation, Bradley–Terry full pairing (Weng & Lin, JMLR 2011, Algorithm 1; the model
family used by OpenSkill), implemented in ~50 lines without a dependency.

- Each player/game/pace has `N(mu, sigma²)`; start `mu = 25`, `sigma = 25/3`; `beta = 25/6`, `tau = 25/300`
  (added variance before each game), `kappa = 0.0001`.
- A 2–4 player result is all pairwise comparisons; equal places are ties (`s = ½`) — shared placement in
  sealed-bids is handled natively. Resignation and timeout are ordinary last places produced by the game module.
- **Public rating = round(60·mu)** (1500 for a new player). The conservative `mu − 3·sigma` was rejected after
  simulation: it rises with volume alone (≈1000 → 1780 for a 50% player over 200 games).
- Certainty gates instead: **provisional** for the first 5 games; **leaderboard** requires ≥10 games and
  `sigma ≤ 6`. Ratings are separate per game and per pace (live / turn-based).
- Ranked tables exist only through ranked matchmaking (skill window on `60·mu`); hand-made tables are friendly.
  Premium never changes queue order, rating or anything in a game.
- Exactly-once: `rating_history` is unique per (result, user, mode) and checked first; rating rows are locked in a
  stable order. Redelivered or reordered events apply each result once; when two results of the same player arrive
  out of order they are applied in arrival order (each once), which is the documented behaviour.

Simulation summary (seeded): rank correlation between true and rated skill 0.97 (2/3/4 players); a strong
newcomer can be one or two league bands off in the first games (provisional label); alternating results against
the same opponent leave both at ≈1500; ties between equals change nothing.

## Seasons and leagues

- At most one active season (unique partial index). Config per season: `minGames` (default 5) and league
  thresholds on the public rating — bronze < 1350 ≤ silver < 1500 ≤ gold < 1650 ≤ platinum < 1800 ≤ diamond <
  1950 ≤ master. Values are tunable defaults.
- After `minGames` ranked games in the season, the placement follows skill only; game count never moves a league.
- **Closing freezes the season** (`POST /admin/seasons/:id/close`): a database trigger rejects any insert/update/
  delete of that season's placements unless the transaction set `app.season_correction`, which only the audited
  correction endpoint does (`POST /admin/seasons/:id/corrections`, reason required). Finishers receive a cosmetic
  `season.badge` ledger entry once. Closed-season leaderboards show the frozen placements.

## XP and account level (rules version 1)

| Rule | Amount | Limits |
|---|---|---|
| `xp.match_completed` | 20 (also for losses) | 5 when the same opponent set was met ≥3 times in 24 h; counts toward the daily cap |
| `xp.first_place` | 10 (only if someone placed lower) | 0 with a repeated opponent; daily cap |
| daily cap | 300 XP from the two match rules per Tehran day | further matches are recorded with amount 0 and the reason |
| `xp.new_title` | 25, once per game per player | — |
| `xp.tutorial` | 30, once per game per player (replays give nothing) | — |
| achievement | 15 per achievement, once | — |
| mission | per mission definition, once per week | — |
| manual | any ±1000 by an admin with a reason | audited |

Level `n` needs `50·n·(n−1)` total XP (0, 100, 300, 600, …). XP, missions and achievements never influence
rating or matchmaking. Every ledger row has a Persian reason, including zero-amount rows, so players can see why
a reward was or was not given.

Idempotency: every ledger row has a unique `source_key` (e.g. `match:{result}:{user}:xp.match_completed`,
`tutorial:{game}:{user}`, `mission:{key}:v{n}:{week}:{user}`, `achievement:{key}:{user}`). Per-user work is
serialized with an advisory lock; missions and achievements are recomputed from ledger facts rather than
incremented, so retries cannot double-count.

## Missions (weekly, Saturday-based week in Tehran) and achievements

| Mission | Goal | XP |
|---|---|---|
| سه میز کامل | complete 3 tables (any result) | 50 |
| تنوع | complete tables in 2 different games | 40 |
| یک بازی تازه یاد بگیر | finish a tutorial or a first game in a new title | 40 |

Achievements: first game, first win, two different games, two tutorials, ranked debut, 20 games.
Mastery per game (separate from XP and rating): new → learner (tutorial or 1 game) → player (5) → seasoned (20 +
5 ranked) → master (50 + 20 ranked + 15 wins).

## UX rules

Rewards are shown only after the game (result panel, «پیشرفت»), never as pop-ups during a table. Season rewards
are cosmetic. Free players see their results, ratings and history; weekly trend analysis and season comparison are
premium (no gameplay advantage).
