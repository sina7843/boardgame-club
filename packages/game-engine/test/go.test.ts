import { describe, expect, it } from 'vitest';
import { areaScore, goModule, group, play, type GoState, type GoView, type Stone } from '@bg/game-go';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = goModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as GoState;
const game = (options: Record<string, unknown> = {}, seed = 1) => startGame(m, { playerCount: 2, seed, options: { firstMove: 'host', ...options } }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const at = (x: number, y: number, size = 9) => y * size + x;
/** Board from rows of '.', 'b', 'w'. */
const board = (rows: string[]) => rows.join('').split('').map((c) => (c === '.' ? null : c)) as (Stone | null)[];

describe('go rules', () => {
  it('sizes and komi from options; black first', () => {
    expect(st(game()).board).toHaveLength(81);
    expect(st(game({ size: 19 })).board).toHaveLength(361);
    expect(st(game({ komi: 6.5 })).komi).toBe(6.5);
    const snap = game();
    expect(reject(snap, 1, { type: 'place', at: 40 })).toBe('NOT_YOUR_TURN');
    expect(reject(snap, 0, { type: 'place', at: 81 })).toBe('OFF_BOARD');
  });

  it('captures groups without liberties; suicide is illegal unless it captures', () => {
    const b = board(['.b.......', 'bwb......', '.........', '.........', '.........', '.........', '.........', '.........', '.........']);
    const r = play(b, 9, at(1, 2), 'b', []);
    expect('board' in r && r.captured).toEqual([at(1, 1)]);
    // White playing into a point surrounded by black is suicide.
    const s = board(['.b.......', 'b.b......', '.b.......', '.........', '.........', '.........', '.........', '.........', '.........']);
    expect(play(s, 9, at(1, 1), 'w', [])).toEqual({ error: 'SUICIDE' });
    expect(group(s, 9, at(1, 0)).liberties.size).toBe(3); // (0,0), (2,0) and the empty (1,1)
  });

  it('ko: the immediate recapture of a single stone is refused (positional superko)', () => {
    let snap = game();
    // Classic ko shape around (3,1)/(4,1).
    Object.assign(st(snap), {
      board: board(['..bw.....', '.b.bw....', '..bw.....', '.........', '.........', '.........', '.........', '.........', '.........']),
      seen: [], turn: 'w'
    });
    st(snap).seen.push(st(snap).board.map((s) => s ?? '.').join(''));
    snap = act(snap, 1, { type: 'place', at: at(2, 1) }); // white (seat 1) takes the black stone on (3,1)
    expect(st(snap).board[at(3, 1)]).toBeNull();
    expect(reject(snap, 0, { type: 'place', at: at(3, 1) })).toBe('KO');
    const v = projectFor(m, snap, p(0)).view as GoView;
    expect(v.ko).toBe(at(3, 1));
  });

  it('area score: stones plus surrounded empty points, white gets komi', () => {
    const b = board(['.b.w.....'.slice(0, 9), 'bb.ww....', '.........', '.........', '.........', '.........', '.........', '.........', '.........']);
    const sc = areaScore(b, 9, [], 7.5);
    // Black owns (0,0) by enclosure; the big region touches both colours and is neutral.
    expect(sc.territory[at(0, 0)]).toBe('b');
    expect(sc.b).toBe(3 + 1);
    expect(sc.w).toBe(3 + 7.5);
    // Marking white dead turns its points over to black.
    expect(areaScore(b, 9, [at(3, 0), at(3, 1), at(4, 1)], 7.5).b).toBe(81);
  });

  it('two passes open scoring; marking clears acceptance; both accept to finish; resume returns to play', () => {
    let snap = game({ komi: 0.5 });
    snap = act(snap, 0, { type: 'place', at: at(4, 4) });
    snap = act(snap, 1, { type: 'place', at: at(0, 0) });
    snap = act(snap, 0, { type: 'pass' });
    snap = act(snap, 1, { type: 'pass' });
    expect(st(snap).phase).toBe('scoring');
    expect(reject(snap, 0, { type: 'place', at: 1 })).toBe('WRONG_PHASE');
    snap = act(snap, 0, { type: 'accept' });
    snap = act(snap, 1, { type: 'mark', at: at(0, 0) });
    expect(st(snap).accepted).toEqual([false, false]);
    const resumed = act(snap, 0, { type: 'resume' });
    expect(st(resumed).phase).toBe('play');
    expect(st(resumed).turn).toBe('w');
    snap = act(snap, 0, { type: 'accept' });
    snap = act(snap, 1, { type: 'accept' });
    expect(st(snap).outcome?.reason).toBe('score');
    expect(st(snap).score).toMatchObject({ b: 81, w: 0.5 });
    expect(st(snap).outcome?.placements).toEqual([{ seat: 0, place: 1, score: 81 }, { seat: 1, place: 2, score: 0.5 }]);
  });

  it('timeouts pass; three in a row lose; timeout in scoring accepts', () => {
    let snap = game();
    snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(snap).turn).toBe('w');
    let t = game();
    for (let k = 0; k < 3; k++) {
      t = (applyTimeout(m, t, 0) as StepResult).snapshot; // black times out (passes)
      if (st(t).outcome) break;
      t = act(t, 1, { type: 'place', at: k });
    }
    expect(st(t).outcome?.reason).toBe('timeout');
    let sc = game();
    sc = act(sc, 0, { type: 'pass' });
    sc = act(sc, 1, { type: 'pass' });
    sc = (applyTimeout(m, sc, 0) as StepResult).snapshot;
    expect(st(sc).outcome?.reason).toBe('score');
  });

  it('view hides the superko table; tutorial is legal and ends in a win', () => {
    expect(projectFor(m, game(), p(1)).view as GoView).not.toHaveProperty('seen');
    const t = goModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      expect(st(snap).outcome).toBeNull();
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    const s = st(snap);
    expect(s.captures).toEqual({ b: 3, w: 0 });
    expect(s.dead).toEqual([20]);
    expect(s.score).toMatchObject({ b: 55, w: 33.5 });
    expect(s.outcome).toEqual({ reason: 'score', placements: [{ seat: 0, place: 1, score: 55 }, { seat: 1, place: 2, score: 33.5 }] });
  });

  it('random 9×9 games: captures and scoring stay consistent and replay deterministically', () => {
    for (let g = 0; g < 15; g++) {
      const rng = createRng({ s: 5 + g });
      const setup = { playerCount: 2, seed: g, options: { size: 9 } };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 400 && !st(snap).outcome; n++) {
        const s = st(snap);
        let seat = s.colors.indexOf(s.turn);
        let action: Record<string, unknown> = { type: 'pass' };
        if (s.phase === 'scoring') { seat = s.accepted[0] ? 1 : 0; action = { type: 'accept' }; }
        else if (n < 120) {
          const empty = s.board.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
          for (let k = 0; k < 6; k++) {
            const cand = empty[rng.nextInt(empty.length)]!;
            if (!('error' in play(s.board, s.size, cand, s.turn, s.seen))) { action = { type: 'place', at: cand }; break; }
          }
        }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        // No group on the board is ever without liberties.
        const b = st(snap).board;
        for (let i = 0; i < b.length; i++) if (b[i]) expect(group(b, 9, i).liberties.size).toBeGreaterThan(0);
      }
      expect(st(snap).outcome?.reason).toBe('score');
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
