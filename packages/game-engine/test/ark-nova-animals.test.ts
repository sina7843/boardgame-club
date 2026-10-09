import { describe, expect, it } from 'vitest';
import { ANIMAL, PROJECT, REG, SPONSOR, arkNovaModule, core, hex, nameOf, type Icon, type State } from '@bg/game-ark-nova';
import { applyAction, startGame, type EngineSnapshot } from '../src/index.ts';

const m = arkNovaModule as never;
const rng = { nextInt: () => 0 };
function state(n = 2): State {
  let snap: EngineSnapshot = startGame(m, { playerCount: n, seed: 3, options: {} }).snapshot;
  for (let seat = 0; seat < n; seat++) {
    const d = (snap.state as State).drafts[seat]!;
    const r = applyAction(m, snap, { kind: 'player', seat }, { type: 'draft', keep: d.cards.slice(0, 4), ...(d.maps.length ? { map: d.maps[0] } : {}) }, 0);
    if ('ok' in r) throw new Error(r.errorCode);
    snap = r.snapshot;
  }
  const s = snap.state as State;
  for (const p of s.players) { p.zoo = []; p.partners = []; p.unis = []; }
  return s;
}
const score = (s: State, id: number, seat = 0) => REG.scoring.get(id)!.score(core.ctx(s, seat, rng));
const animalIds = (pred: (a: (typeof ANIMAL)[number]) => boolean) => Object.values(ANIMAL).filter(pred).map((a) => a.id);
/** An animal whose only category icon is `cat` (single icon). */
const pure = (cat: Icon) => animalIds((a) => a.icons.filter((i) => i === cat).length === 1 && a.icons.every((i) => i === cat || !['bird', 'herbivore', 'predator', 'primate', 'reptile', 'bear', 'pet'].includes(i)))[0]!;

describe('ark nova animals chunk: names', () => {
  it('every Animal 401-528 has a Persian name returned by nameOf', () => {
    for (let id = 401; id <= 528; id++) {
      expect(ANIMAL[id], `animal ${id}`).toBeDefined();
      const fa = nameOf(id);
      expect(fa, `${id}`).not.toBe(ANIMAL[id]!.name);
      expect(fa, `${id}`).toMatch(/^[؀-ۿ‌ ]+$/);
    }
  });
  it('every project 101-132 has a Persian name and condition text', () => {
    for (let id = 101; id <= 132; id++) {
      expect(PROJECT[id]).toBeDefined();
      const pr = REG.projects.get(id)!;
      expect(nameOf(id)).toBe(pr.nameFa);
      expect(pr.nameFa).not.toBe(PROJECT[id]!.name);
      expect(pr.nameFa).toMatch(/^[؀-ۿ‌ ]+$/);
      expect(pr.textFa!.length).toBeGreaterThan(10);
    }
    expect(REG.projects.get(118)!.textFa).toContain('۱ اعتبار');
    expect(REG.projects.get(124)!.textFa).toContain('همکار');
  });
  it('scoring cards 1-11 are all registered with Persian text', () => {
    for (let id = 1; id <= 11; id++) expect(REG.scoring.get(id)?.textFa.length, `${id}`).toBeGreaterThan(5);
  });
});

describe('ark nova final scoring cards', () => {
  it('2 Small Animal Zoo: 3/6/8/10 small animals', () => {
    const s = state();
    const smalls = animalIds((a) => !a.std || a.size <= 2);
    const big = animalIds((a) => a.std && a.size >= 3);
    const at = (n: number) => { s.players[0]!.zoo = [...smalls.slice(0, n), ...big.slice(0, 5)]; return score(s, 2); };
    expect([at(0), at(2), at(3), at(5), at(6), at(7), at(8), at(9), at(10), at(12)]).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('5 Conservation Zoo: projects supported 3/4/5/6', () => {
    const s = state();
    const at = (n: number) => { s.players[0]!.supported = n; return score(s, 5); };
    expect([2, 3, 4, 5, 6, 8].map(at)).toEqual([0, 1, 2, 3, 4, 4]);
  });

  it('7 Favorite Zoo: reputation 6/9/12/15', () => {
    const s = state();
    const at = (n: number) => { s.players[0]!.rep = n; return score(s, 7); };
    expect([5, 6, 8, 9, 11, 12, 14, 15].map(at)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });

  it('8 Sponsored Zoo: sponsor cards (not animals) 3/6/8/10', () => {
    const s = state();
    const sp = Object.keys(SPONSOR).map(Number);
    const at = (n: number) => { s.players[0]!.zoo = [401, 402, 403, ...sp.slice(0, n)]; return score(s, 8); };
    expect([2, 3, 5, 6, 7, 8, 9, 10].map(at)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });

  it('10 Climbing Park / 11 Aquatic Park: rock and water icons from card requirements', () => {
    const s = state();
    const rocky = animalIds((a) => a.rock === 1);
    const wet = animalIds((a) => a.water === 1);
    s.players[0]!.zoo = rocky.slice(0, 1); expect(score(s, 10)).toBe(1);
    s.players[0]!.zoo = rocky.slice(0, 2); expect(score(s, 10)).toBe(1);
    s.players[0]!.zoo = rocky.slice(0, 3); expect(score(s, 10)).toBe(2);
    s.players[0]!.zoo = rocky.slice(0, 5); expect(score(s, 10)).toBe(3);
    s.players[0]!.zoo = rocky.slice(0, 7); expect(score(s, 10)).toBe(4);
    s.players[0]!.zoo = []; expect(score(s, 10)).toBe(0);
    s.players[0]!.zoo = wet.slice(0, 1); expect(score(s, 11)).toBe(0);
    s.players[0]!.zoo = wet.slice(0, 2); expect(score(s, 11)).toBe(1);
    s.players[0]!.zoo = wet.slice(0, 4); expect(score(s, 11)).toBe(2);
    s.players[0]!.zoo = wet.slice(0, 6); expect(score(s, 11)).toBe(3);
    s.players[0]!.zoo = wet.slice(0, 8); expect(score(s, 11)).toBe(4);
    expect(core.count(s, 0, 'water')).toBe(8);
  });

  it('6 Naturalists\' Zoo: empty building spaces (Build-II spaces count) 6/12/18/24', () => {
    const s = state();
    const p = s.players[0]!;
    const spaces = core.buildingSpaces(p);
    const upgrade = core.mapOf(p).upgrade;
    expect(spaces).toEqual(expect.arrayContaining(upgrade));
    const at = (empty: number) => {
      p.buildings = [{ id: 1, kind: 'e5', cells: spaces.slice(empty) }];
      expect(spaces.length - spaces.slice(empty).length).toBe(empty);
      return score(s, 6);
    };
    expect([5, 6, 11, 12, 17, 18, 23, 24, 30].map(at)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
    // Covered rock/water (not building spaces) never count as empty.
    p.buildings = [{ id: 1, kind: 'e5', cells: [...spaces.slice(6), ...core.mapOf(p).water] }];
    expect(score(s, 6)).toBe(1);
  });

  describe('4 Architectural Zoo', () => {
    const cover = (s: State, cells: string[]) => { s.players[0]!.buildings = [{ id: 1, kind: 'e5', cells }]; };
    it('nothing built: 0; whole map covered: 4', () => {
      const s = state();
      cover(s, []);
      expect(score(s, 4)).toBe(0);
      cover(s, core.buildingSpaces(s.players[0]!));
      expect(score(s, 4)).toBe(4);
    });
    it('each condition separately', () => {
      const s = state();
      const p = s.players[0]!;
      const map = core.mapOf(p);
      const spaces = core.buildingSpaces(p);
      const bs = new Set(spaces);
      const linked = (t: string[], cov: string[]) => t.every((w) => hex.neighbors(w).some((x) => cov.includes(x)));
      // Water only: cover the building spaces next to water, then free every neighbour of one rock space.
      const only = (yes: string[], no: string[]) => {
        const ring = hex.around(yes).filter((x) => bs.has(x));
        for (const r of no) {
          const cov = ring.filter((x) => !hex.neighbors(r).includes(x));
          if (linked(yes, cov)) return cov;
        }
        throw new Error('no such layout');
      };
      const waterOnly = only(map.water, map.rock);
      cover(s, waterOnly);
      expect(linked(map.rock, waterOnly)).toBe(false);
      expect(score(s, 4)).toBe(1);
      const rockOnly = only(map.rock, map.water);
      cover(s, rockOnly);
      expect(linked(map.water, rockOnly)).toBe(false);
      expect(score(s, 4)).toBe(1);
      // All border building spaces covered.
      const border = spaces.filter(hex.isBorder);
      cover(s, border);
      expect(score(s, 4)).toBe(1 + (linked(map.water, border) ? 1 : 0) + (linked(map.rock, border) ? 1 : 0));
      // Everything except one border space: water + rock linked, border and full map fail.
      const missing = border.find((b) => linked(map.water, spaces.filter((x) => x !== b)) && linked(map.rock, spaces.filter((x) => x !== b)))!;
      cover(s, spaces.filter((x) => x !== missing));
      expect(score(s, 4)).toBe(2);
      // Everything except one interior space: border holds too.
      const inner = spaces.find((b) => !hex.isBorder(b) && linked(map.water, spaces.filter((x) => x !== b)) && linked(map.rock, spaces.filter((x) => x !== b)))!;
      cover(s, spaces.filter((x) => x !== inner));
      expect(score(s, 4)).toBe(3);
    });
    it('a covered water space does not need to be connected; a water space whose only neighbour is uncovered breaks it', () => {
      const s = state();
      const map = core.mapOf(s.players[0]!);
      const bs = new Set(core.buildingSpaces(s.players[0]!));
      const nearRock = new Set(hex.around(map.rock));
      const ring = hex.around(map.water).filter((x) => bs.has(x) && !nearRock.has(x));
      // Drop every ring cell next to one water space: that space is no longer connected.
      const lonely = map.water[0]!;
      const cut = ring.filter((x) => !hex.neighbors(lonely).includes(x));
      cover(s, cut);
      expect(score(s, 4)).toBe(0);
      // Cover the lonely water space itself (Diversity Researcher): it is ignored, so all remaining water is connected.
      s.players[0]!.buildings.push({ id: 2, kind: 'e1', cells: [lonely] });
      const others = map.water.filter((w) => w !== lonely);
      const cov = [...cut, lonely];
      expect(others.every((w) => hex.neighbors(w).some((x) => cov.includes(x)))).toBe(true);
      expect(score(s, 4)).toBe(1);
    });
  });

  describe('9 Diverse Species Zoo', () => {
    it('compares with the player to the right (previous seat), ties score nothing, max 4', () => {
      const s = state(3);
      const [bird, herb, pred, prim, rep, pet] = (['bird', 'herbivore', 'predator', 'primate', 'reptile', 'pet'] as Icon[]).map(pure);
      // Seat 1's right is seat 0. Seat 2's zoo must not matter for seat 1.
      s.players[1]!.zoo = [bird!, herb!, pred!];
      s.players[0]!.zoo = [bird!];
      s.players[2]!.zoo = [];
      expect(score(s, 9, 1)).toBe(2); // bird tied, herbivore + predator won
      s.players[0]!.zoo = [];
      expect(score(s, 9, 1)).toBe(3);
      s.players[1]!.zoo = [bird!, herb!, pred!, prim!, rep!, pet!];
      expect(score(s, 9, 1)).toBe(4); // 6 categories won, capped at 4
      // Seat 0's right is seat 2 (wraps around).
      s.players[0]!.zoo = [bird!];
      s.players[2]!.zoo = [];
      expect(score(s, 9, 0)).toBe(1);
      s.players[2]!.zoo = [bird!];
      expect(score(s, 9, 0)).toBe(0);
      // Strictly more: 2 vs 1 scores.
      s.players[0]!.zoo = [bird!, pure('bird')!, ...animalIds((a) => a.icons.includes('bird')).filter((x) => x !== bird).slice(0, 1)];
      expect(core.count(s, 0, 'bird')).toBeGreaterThan(1);
      expect(score(s, 9, 0)).toBe(1);
    });
    it('glossary example: 4 predator, 2 bird, 2 bear, 1 herbivore, 1 reptile vs 4 reptile, 3 primate, 2 pet → 4', () => {
      const s = state(2);
      const pick = (cat: Icon, n: number) => {
        const out: number[] = [];
        for (const id of animalIds((a) => a.icons.includes(cat))) {
          out.push(id);
          const c = core.icons({ ...s, players: [{ ...s.players[0]!, zoo: out }] } as State, 0);
          if (c[cat] >= n) break;
        }
        return out;
      };
      s.players[0]!.zoo = [...pick('predator', 4), ...pick('bird', 2), ...pick('herbivore', 1)];
      s.players[1]!.zoo = [...pick('reptile', 4), ...pick('primate', 3), ...pick('pet', 2)];
      const mine = core.icons(s, 0);
      const theirs = core.icons(s, 1);
      const won = (['bird', 'herbivore', 'predator', 'primate', 'reptile', 'bear', 'pet'] as Icon[]).filter((k) => mine[k] > theirs[k]).length;
      expect(score(s, 9, 0)).toBe(Math.min(4, won));
      expect(score(s, 9, 0)).toBeGreaterThanOrEqual(3);
      // 2-player: seat 1's right is seat 0.
      const lost = (['bird', 'herbivore', 'predator', 'primate', 'reptile', 'bear', 'pet'] as Icon[]).filter((k) => theirs[k] > mine[k]).length;
      expect(score(s, 9, 1)).toBe(Math.min(4, lost));
    });
  });
});
