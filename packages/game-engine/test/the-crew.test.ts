import { describe, expect, it } from 'vitest';
import { DECK, commKind, crewModuleNine, legalCards, trickWinner, type CrewState, type CrewView } from '@bg/game-the-crew';
import { deepSeaModule } from '@bg/game-crew-deep-sea';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as CrewState;
const make = (mod: unknown) => {
  const m = mod as never;
  const game = (players = 4, seed = 1, mission = '1') => startGame(m, { playerCount: players, seed, options: { mission } }).snapshot;
  const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
    const r = applyAction(m, snap, p(seat), action, 0);
    if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
    return r.snapshot;
  };
  const reject = (snap: EngineSnapshot, seat: number, action: unknown) => { const r = applyAction(m, snap, p(seat), action, 0); return 'ok' in r ? r.errorCode : 'ACCEPTED'; };
  const draftAll = (snap: EngineSnapshot) => { while (st(snap).phase === 'draft') snap = act(snap, st(snap).drafter, { type: 'draftTask', task: st(snap).tasks.find((t) => t.owner === null)!.id }); return snap; };
  return { m, game, act, reject, draftAll };
};
const edit = (snap: EngineSnapshot, f: (s: CrewState) => void): EngineSnapshot => { const s = structuredClone(st(snap)); f(s); return { ...snap, state: s }; };

describe('the crew: shared trick core', () => {
  it('40 cards; follow suit; rockets trump; commander holds rocket 4', () => {
    expect(DECK).toHaveLength(40);
    expect(trickWinner([{ seat: 0, card: 'p3' }, { seat: 1, card: 'p9' }, { seat: 2, card: 'b9' }])).toBe(1);
    expect(trickWinner([{ seat: 0, card: 'p3' }, { seat: 1, card: 'p9' }, { seat: 2, card: 'r1' }])).toBe(2);
    expect(commKind(['p2', 'p5', 'p7', 'b1'], 'p7')).toBe('top');
    expect(commKind(['p2', 'p5', 'p7', 'b1'], 'p5')).toBeNull();
    expect(commKind(['p2', 'p5', 'p7', 'b1'], 'b1')).toBe('only');
    const { game } = make(crewModuleNine);
    const s = st(game(3, 2));
    expect(s.hands.map((h) => h.length)).toEqual([13, 13, 13]);
    expect(s.aside).not.toBe('r4');
    expect(s.hands[s.commander]).toContain('r4');
    expect(legalCards({ ...s, trick: [{ seat: 0, card: 'p1' }] }, 1).every((c) => !s.hands[1]!.some((x) => x[0] === 'p') || c[0] === 'p')).toBe(true);
  });
});

describe('the crew: planet nine', () => {
  const { m, game, act, reject, draftAll } = make(crewModuleNine);

  it('draft from the commander; communication between tricks only; must follow suit', () => {
    let snap = game(4, 3, '4');
    expect(st(snap).tasks).toHaveLength(3);
    const cmd = st(snap).commander;
    expect(st(snap).drafter).toBe(cmd);
    expect(reject(snap, (cmd + 1) % 4, { type: 'draftTask', task: 0 })).toBe('NOT_YOUR_TURN');
    snap = draftAll(snap);
    expect(st(snap).tasks.map((t) => t.owner)).toEqual([cmd, (cmd + 1) % 4, (cmd + 2) % 4]);
    const lead = st(snap).hands[cmd]!.find((c) => c[0] !== 'r')!;
    snap = act(snap, cmd, { type: 'play', card: lead });
    const next = (cmd + 1) % 4;
    expect(reject(snap, next, { type: 'communicate', card: st(snap).hands[next]![0] })).toBe('BETWEEN_TRICKS_ONLY');
    const off = st(snap).hands[next]!.find((c) => c[0] !== lead[0]);
    if (off && st(snap).hands[next]!.some((c) => c[0] === lead[0])) expect(reject(snap, next, { type: 'play', card: off })).toBe('MUST_FOLLOW_SUIT');
  });

  it('a task fails when someone else wins it; numbered order is enforced', () => {
    let snap = edit(game(3, 1, '3'), (s) => {
      s.hands = [['p9', 'b1'], ['p5', 'b2'], ['p1', 'b3']]; s.commander = 0; s.current = 0; s.drafter = 0;
      s.tasks = [{ id: 0, owner: null, status: 'open', card: 'p5', order: 2 }, { id: 1, owner: null, status: 'open', card: 'b2', order: 1 }];
    });
    snap = act(snap, 0, { type: 'draftTask', task: 0 });
    snap = act(snap, 1, { type: 'draftTask', task: 1 });
    snap = act(snap, 0, { type: 'play', card: 'p9' });
    snap = act(snap, 1, { type: 'play', card: 'p5' });
    snap = act(snap, 2, { type: 'play', card: 'p1' });
    expect(st(snap).tasks[0]!.status).toBe('failed');
    expect(st(snap).outcome).toMatchObject({ reason: 'score' });
    expect(st(snap).outcome!.placements.every((x) => x.place === 2)).toBe(true);
  });

  it('hands are hidden; communicated cards are public', () => {
    let snap = draftAll(game(4, 5));
    const s = st(snap);
    const seat = s.current;
    const v = projectFor(m, snap, p((seat + 1) % 4)).view as CrewView;
    expect(v).not.toHaveProperty('hands');
    expect(v.handCounts).toEqual([10, 10, 10, 10]);
    const card = s.hands[seat]!.find((c) => commKind(s.hands[seat]!, c))!;
    snap = act(snap, seat, { type: 'communicate', card });
    expect((projectFor(m, snap, p((seat + 1) % 4)).view as CrewView).comms[seat]).toMatchObject({ card });
  });

  it('timeouts draft and play; resign fails the mission', () => {
    let t = game(3);
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).phase).toBe('play');
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).trick).toHaveLength(1);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome).toMatchObject({ reason: 'resign' });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = crewModuleNine.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) { snap = act(snap, 0, step.expected); if (step.reply) snap = act(snap, 1, step.reply); }
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
    expect(st(snap).outcome?.reason).toBe('win');
  });

  it('random missions end and replay deterministically', () => {
    for (let g = 0; g < 20; g++) {
      const rng = createRng({ s: 3 + g });
      const setup = { playerCount: 3 + (g % 3), seed: g, options: { mission: String(1 + (g % 10)) } };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 200 && !st(snap).outcome; n++) {
        const seat = crewModuleNine.pendingSeats(st(snap))[0]!;
        const legal = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type === 'play' || h.type === 'draftTask');
        const { type, ...rest } = legal[rng.nextInt(legal.length)]!;
        const action = { type, ...rest };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  });
});

describe('the crew: deep sea', () => {
  const { m, game, act } = make(deepSeaModule);

  it('tasks are revealed until the difficulty target is reached', () => {
    for (const target of ['3', '7', '11']) {
      const s = st(game(4, 7, target));
      const sum = s.tasks.reduce((n, t) => n + t.difficulty!, 0);
      expect(sum).toBeGreaterThanOrEqual(Number(target));
      expect(sum - s.tasks.at(-1)!.difficulty!).toBeLessThan(Number(target));
    }
  });

  it('conditions resolve during play and at the end', () => {
    let snap = edit(game(3, 1), (s) => {
      s.hands = [['p9', 'b1'], ['p5', 'b2'], ['p1', 'b3']]; s.commander = 0; s.current = 0; s.drafter = 0; s.phase = 'play';
      s.tasks = [
        { id: 0, owner: 0, status: 'open', cond: 'nine', difficulty: 1 }, { id: 1, owner: 1, status: 'open', cond: 'noTricks', difficulty: 3 },
        { id: 2, owner: 2, status: 'open', cond: 'lastTrick', difficulty: 2 }
      ];
    });
    snap = act(snap, 0, { type: 'play', card: 'p9' });
    snap = act(snap, 1, { type: 'play', card: 'p5' });
    snap = act(snap, 2, { type: 'play', card: 'p1' });
    expect(st(snap).tasks.map((t) => t.status)).toEqual(['done', 'open', 'open']);
    snap = act(snap, 0, { type: 'play', card: 'b1' });
    snap = act(snap, 1, { type: 'play', card: 'b2' });
    snap = act(snap, 2, { type: 'play', card: 'b3' });
    expect(st(snap).tasks.map((t) => t.status)).toEqual(['done', 'done', 'done']);
    expect(st(snap).outcome?.reason).toBe('win');
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = deepSeaModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) { snap = act(snap, 0, step.expected); if (step.reply) snap = act(snap, 1, step.reply); }
    expect(st(snap).outcome?.reason).toBe('win');
  });

  it('random missions end and replay deterministically', () => {
    for (let g = 0; g < 20; g++) {
      const rng = createRng({ s: 9 + g });
      const setup = { playerCount: 3 + (g % 3), seed: g, options: { mission: ['3', '5', '7', '9', '11'][g % 5]! } };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 200 && !st(snap).outcome; n++) {
        const seat = deepSeaModule.pendingSeats(st(snap))[0]!;
        const legal = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type === 'play' || h.type === 'draftTask');
        const { type, ...rest } = legal[rng.nextInt(legal.length)]!;
        const action = { type, ...rest };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  });
});
