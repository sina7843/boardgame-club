// Battleship bot. Hidden information (the enemy fleet), so it decides from its own projection only: a probability
// map counts every way the ships still afloat could lie across cells not yet ruled out, weighting placements that
// cover unsunk hits heavily (hunt, then finish the wounded ship). Placement is random.
import { pickByLevel, type GameBot } from '@bg/game-sdk';
import { bsModule, cellsOf, FLEET, SIZE, type BsAction, type BsState, type Dir } from './rules.ts';

export const bsBot: GameBot<BsState, BsAction> = {
  decide(state, seat, level, rng) {
    if (state.phase === 'place') return { type: 'placeRandom' };
    const enemy = bsModule.project(state, { kind: 'player', seat }).seas[1 - seat]!;
    const shot = new Map(enemy.shots.map((s) => [s.cell, s.hit]));
    const sunkCells = new Set(enemy.ships.flatMap((x) => cellsOf(x)!));
    const openHits = enemy.shots.filter((s) => s.hit && !sunkCells.has(s.cell)).map((s) => s.cell);
    const heat = new Array<number>(SIZE * SIZE).fill(0);
    for (const ship of FLEET.keys()) {
      if (enemy.sunk.includes(ship)) continue;
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) for (const dir of ['h', 'v'] as Dir[]) {
        const cells = cellsOf({ ship, x, y, dir });
        // A ship cannot lie on a miss or on a sunk ship; it may cover unsunk hits.
        if (!cells || cells.some((c) => sunkCells.has(c) || shot.get(c) === false)) continue;
        const covers = cells.filter((c) => openHits.includes(c)).length;
        const weight = covers ? 20 ** covers : 1;
        for (const c of cells) if (!shot.has(c)) heat[c]! += weight;
      }
    }
    const scored = heat.flatMap((score, cell) => (shot.has(cell) ? [] : [{ move: cell, score }])).sort((a, b) => b.score - a.score);
    // Levels: easy searches at random but finishes a wounded ship; medium picks among the five likeliest cells.
    if (level === 'easy' && !openHits.length) return { type: 'fire', cell: scored[rng.nextInt(scored.length)]!.move };
    if (level === 'medium') return { type: 'fire', cell: scored[rng.nextInt(Math.min(5, scored.length))]!.move };
    return { type: 'fire', cell: pickByLevel(scored, level, rng) };
  }
};
