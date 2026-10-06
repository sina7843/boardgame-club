# Rating simulation (DRAGON-03)

Model: Weng–Lin Bradley–Terry full pairing. Parameters: mu0 25, sigma0 8.33, beta 4.17, tau 0.083.
Display rating = round(60·mu) (1500 = new player). Leaderboard/league eligibility: ≥10 games and sigma ≤ 6.
Seeded LCG, so the numbers below are reproducible.

Design note: an earlier draft displayed the conservative mu − 3·sigma. The repeated-opponent run below showed it
rising from 1000 to ≈1780 for a 50% player purely because sigma shrinks with volume, so display and leagues now use
the mean and certainty is enforced as an eligibility gate instead.

## 2-player games: 40 players, 1500 games (≈75 each)
- Rank correlation (Spearman) between true skill and rated mu: **0.973**
- Mean sigma: 3.09 (from 8.33)

## 3-player games: 40 players, 1500 games (≈113 each)
- Rank correlation (Spearman) between true skill and rated mu: **0.969**
- Mean sigma: 1.89 (from 8.33)

## 4-player games: 40 players, 1500 games (≈150 each)
- Rank correlation (Spearman) between true skill and rated mu: **0.977**
- Mean sigma: 1.50 (from 8.33)

## New account (strong newcomer, true mu 32, opponents at 25)
| games | mu | sigma | display |
|---|---|---|---|
| 1 | 28.34 | 7.78 | 1700 |
| 3 | 27.61 | 6.90 | 1657 |
| 5 | 31.57 | 6.25 | 1894 |
| 10 | 28.47 | 5.22 | 1708 |
| 20 | 29.51 | 4.14 | 1770 |
| 30 | 33.49 | 3.56 | 2010 |
- Provisional label for the first 5 games; leaderboard/league eligibility after 10 games with sigma ≤ 6,
  Compare the display column with the true 1920: early estimates can be one or two league bands off, which is why
  new ratings are labelled provisional and the leaderboard is gated on certainty. These are tunable
  (provisional games, beta, tau) and should be revisited with real match data.

## Repeated opponent (same pair, 200 alternating results)
- Final mu: 24.87 / 25.13; display 1492 / 1508.
- Alternating results do not inflate either public rating: means stay at the prior. Collusion (one side always losing on
  purpose) is not something a rating formula can stop; it is handled by moderation signals and by XP limiting
  repeated-opponent rewards, and ranked tables can only be created through matchmaking.

## Resignation and timeout
- A resignation or timeout is recorded by the game module as a last place; the update equals any other loss:
  winner 27.64 / loser 22.36 (from 25.00). Platform incidents freeze deadlines, so system
  failures do not produce timeouts; cancelled tables have no result and are never rated.

## Ties and shared placement
- Equal players draw: 25.00 / 25.00 (no change in mean).
- Strong (30) draws weak (20): strong → 29.63, weak → 20.37.
- Four players, places 1,1,3,3 (sealed-bids shared scores): 30.27, 30.27, 19.73, 19.73.

