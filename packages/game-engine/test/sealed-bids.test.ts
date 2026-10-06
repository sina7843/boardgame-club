import { describe, expect, it } from 'vitest';
import { rankByScore, sealedBidsModule, type SealedBidsState, type SealedBidsView } from '@bg/game-sealed-bids';
import { applyAction, applyTimeout, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = sealedBidsModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as SealedBidsState;
const view = (s: EngineSnapshot, seat: number | null) =>
  projectFor(m, s, seat === null ? { kind: 'spectator' } : p(seat)).view as SealedBidsView;

function act(snap: EngineSnapshot, seat: number, action: unknown): StepResult {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(r.errorCode);
  return r;
}
function round(snap: EngineSnapshot, bids: number[]): StepResult {
  let last!: StepResult;
  bids.forEach((token, seat) => { last = act(snap, seat, { type: 'bid', token }); snap = last.snapshot; });
  return last;
}

describe('sealed-bids rules', () => {
  it('setup: 2–4 players, full hands, seeded seat order persisted and deterministic', () => {
    for (const n of [2, 3, 4]) {
      const s = st(startGame(m, { playerCount: n, seed: 11 }).snapshot);
      expect(s.hands).toEqual(Array(n).fill([1, 2, 3, 4, 5]));
      expect([...s.seatOrder].sort()).toEqual([...Array(n).keys()]);
      expect(st(startGame(m, { playerCount: n, seed: 11 }).snapshot).seatOrder).toEqual(s.seatOrder);
    }
    expect(() => startGame(m, { playerCount: 5, seed: 1 })).toThrow();
  });

  it('a sealed bid is hidden from opponents and spectators until every seat has submitted', () => {
    const snap0 = startGame(m, { playerCount: 3, seed: 3 }).snapshot;
    const r = act(snap0, 0, { type: 'bid', token: 4 });
    expect(r.scheduleChanges).toEqual([]);
    const own = view(r.snapshot, 0);
    expect(own.myBid).toBe(4);
    expect(own.myHand).toEqual([1, 2, 3, 4, 5]);
    for (const other of [1, 2, null]) {
      const v = view(r.snapshot, other);
      expect(v.submitted).toEqual([true, false, false]);
      expect(v.history).toEqual([]);
      expect(v.myBid).toBeNull();
      const json = JSON.stringify(v);
      expect(json).not.toContain('"myBid":4');
      expect(json).not.toContain('pending');
      expect(json).not.toContain('hands');
    }
    expect(view(r.snapshot, null).myHand).toBeNull();
  });

  it('cannot alter a commitment, bid an unused token twice, or act after resigning', () => {
    let snap = act(startGame(m, { playerCount: 2, seed: 3 }).snapshot, 0, { type: 'bid', token: 5 }).snapshot;
    expect(applyAction(m, snap, p(0), { type: 'bid', token: 4 }, 0)).toEqual({ ok: false, errorCode: 'ALREADY_COMMITTED' });
    snap = act(snap, 1, { type: 'bid', token: 1 }).snapshot;
    expect(applyAction(m, snap, p(0), { type: 'bid', token: 5 }, 0)).toEqual({ ok: false, errorCode: 'TOKEN_UNAVAILABLE' });
    expect(applyAction(m, snap, p(0), { type: 'bid', token: 6 }, 0)).toEqual({ ok: false, errorCode: 'INVALID_ACTION' });
    expect(applyAction(m, snap, p(2), { type: 'bid', token: 1 }, 0)).toEqual({ ok: false, errorCode: 'NOT_A_PLAYER' });
  });

  it('reveals atomically: unique highest wins the round prize, tie for highest scores nothing, tokens consumed', () => {
    const s0 = startGame(m, { playerCount: 3, seed: 3 }).snapshot;
    const r1 = round(s0, [2, 5, 1]);
    expect(r1.internalEvents.some((e) => e.type === 'revealed')).toBe(true);
    expect(r1.scheduleChanges).toEqual([{ kind: 'set', deadlineKey: 'turn' }]);
    expect(st(r1.snapshot).scores).toEqual([0, 1, 0]);
    expect(st(r1.snapshot).hands[1]).toEqual([1, 2, 3, 4]);
    const r2 = round(r1.snapshot, [4, 4, 2]);
    expect(st(r2.snapshot).scores).toEqual([0, 1, 0]);
    expect(view(r2.snapshot, null).history.map((h) => h.winner)).toEqual([1, null]);
    expect(view(r2.snapshot, 2).round).toBe(3);
  });

  it('after five rounds the largest score wins and equal scores share placement', () => {
    let snap = startGame(m, { playerCount: 2, seed: 9 }).snapshot;
    let last!: StepResult;
    for (const bids of [[5, 1], [1, 5], [2, 2], [3, 4], [4, 3]]) { last = round(snap, bids); snap = last.snapshot; }
    // seat0 wins rounds 1,5 → 1+5=6; seat1 wins rounds 2,4 → 2+4=6; round 3 tied.
    expect(last.outcome).toEqual({ reason: 'score', placements: [{ seat: 0, score: 6, place: 1 }, { seat: 1, score: 6, place: 1 }] });
    expect(last.scheduleChanges).toEqual([{ kind: 'clear', deadlineKey: 'turn' }]);
    expect(rankByScore([3, 7, 3, 1]).map((x) => x.place)).toEqual([2, 1, 2, 4]);
    expect(view(snap, null).history).toHaveLength(5);
  });

  it('timeout commits the lowest unused token for missing seats in stable seat order, then resolves', () => {
    let snap = startGame(m, { playerCount: 3, seed: 5 }).snapshot;
    snap = round(snap, [1, 2, 3]).snapshot;
    snap = act(snap, 1, { type: 'bid', token: 5 }).snapshot;
    const r = applyTimeout(m, snap, 0);
    const autos = r.internalEvents.filter((e) => e.type === 'auto-committed');
    const order = st(snap).seatOrder.filter((s) => s !== 1);
    expect(autos.map((e) => e.seat)).toEqual(order);
    expect(autos.find((e) => e.seat === 0)?.token).toBe(2);
    expect(autos.find((e) => e.seat === 2)?.token).toBe(1);
    expect(st(r.snapshot).history[1]!.bids).toEqual([2, 5, 1]);
  });

  it('resignation auto-commits the lowest token for the rest of the game; all-resigned game still ends', () => {
    let snap = startGame(m, { playerCount: 2, seed: 5 }).snapshot;
    snap = act(snap, 0, { type: 'resign' }).snapshot;
    expect(view(snap, 1).submitted).toEqual([true, false]);
    expect(applyAction(m, snap, p(0), { type: 'bid', token: 3 }, 0)).toEqual({ ok: false, errorCode: 'ALREADY_RESIGNED' });
    snap = act(snap, 1, { type: 'bid', token: 3 }).snapshot;
    expect(st(snap).history[0]!.bids).toEqual([1, 3]);
    const end = act(snap, 1, { type: 'resign' });
    expect(end.outcome?.reason).toBe('score');
    expect(st(end.snapshot).history).toHaveLength(5);
  });

  it('deterministic replay reproduces the exact state and RNG', () => {
    const inputs = [
      { kind: 'action' as const, actor: p(0), action: { type: 'bid', token: 3 }, logicalTime: 1 },
      { kind: 'timeout' as const, logicalTime: 2 },
      { kind: 'action' as const, actor: p(1), action: { type: 'resign' }, logicalTime: 3 }
    ];
    const a = replay(m, { playerCount: 3, seed: 77 }, inputs);
    const b = replay(m, { playerCount: 3, seed: 77 }, inputs);
    expect(b).toEqual(a);
    expect(replay(m, { playerCount: 3, seed: 78 }, inputs).rng).not.toEqual(a.rng);
  });

  it('tutorial script completes all five rounds', () => {
    const t = sealedBidsModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed }).snapshot;
    let last!: StepResult;
    const mine = [1, 2, 5, 3, 4];
    t.steps.forEach((step, i) => {
      last = act(snap, 0, { type: 'bid', token: mine[i] }); snap = last.snapshot;
      last = act(snap, 1, step.reply); snap = last.snapshot;
    });
    expect(last.outcome).not.toBeNull();
  });
});
