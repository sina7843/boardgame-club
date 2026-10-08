// The Crew: The Quest for Planet Nine («خدمه: سیارهٔ نهم»), cooperative trick-taking for 3–5 (2 only in the
// tutorial). One mission per table (host picks 1–10). Task cards are revealed with order tokens; the commander drafts
// first, then clockwise until all are taken. A task is fulfilled when its owner wins the trick containing the task
// card; anyone else winning it fails the mission. Numbered tokens must be fulfilled in that relative order, "last"
// must be the final task. Everyone wins together when all tasks are done; any failure (or running out of tricks)
// loses together. The factory `crewModule` is shared with the Deep Sea edition. Hidden: hands only.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameManifest, GameModule, Outcome, TutorialScript, Transition, Viewer } from '@bg/game-sdk';
import { theCrew } from './definition.ts';
import { DECK, commKind, deal, handsEmpty, legalCards, playCard, shuffle, sortHand, suit, type Play, type TrickCore } from './trick.ts';

export type TaskStatus = 'open' | 'done' | 'failed';
export interface CrewTask { id: number; owner: number | null; status: TaskStatus; card?: string; order?: number | 'last'; cond?: string; arg?: string; n?: number; difficulty?: number }
export interface CrewState extends TrickCore {
  phase: 'draft' | 'play';
  tasks: CrewTask[];
  drafter: number;
  doneOrder: number[];
  mission: number;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type CrewView = Omit<CrewState, 'hands' | 'timeouts'> & { hand: string[] | null; handCounts: number[] };

export const crewAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('draftTask'), task: z.number().int().min(0).max(40) }),
  z.strictObject({ type: z.literal('play'), card: z.enum(DECK as [string, ...string[]]) }),
  z.strictObject({ type: z.literal('communicate'), card: z.enum(DECK as [string, ...string[]]) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type CrewAction = z.infer<typeof crewAction>;

export interface Edition {
  makeTasks(rng: EngineRng, mission: number, core: TrickCore): CrewTask[];
  /** Update task statuses after a trick (`trick` set) or at the end of the hand (`trick` null). */
  evaluate(s: CrewState, trick: { winner: number; cards: Play[] } | null): void;
  tutorialSetup(s: CrewState): void;
  tutorial: TutorialScript<CrewAction>;
}

type Events = Transition<CrewState>['internalEvents'];
const finish = (s: CrewState, events: Events): Transition<CrewState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const team = (s: CrewState, won: boolean, reason: Outcome['reason']): Outcome =>
  ({ placements: s.hands.map((_, seat) => ({ seat, place: won ? 1 : 2, score: s.tasks.filter((t) => t.status === 'done').length })), reason });

function settle(s: CrewState) {
  if (s.tasks.some((t) => t.status === 'failed')) s.outcome = team(s, false, 'score');
  else if (s.tasks.every((t) => t.status === 'done')) s.outcome = team(s, true, 'win');
  else if (handsEmpty(s)) s.outcome = team(s, false, 'score');
}

export function crewModule(manifest: GameManifest, edition: Edition): GameModule<CrewState, CrewAction, CrewView> {
  const mod: GameModule<CrewState, CrewAction, CrewView> = {
    manifest,
    actionSchema: crewAction,

    setup({ playerCount, rng, options }) {
      const tutorial = options.deal === 'tutorial';
      if ((playerCount < 3 && !tutorial) || playerCount < 2 || playerCount > 5) throw new Error('the crew needs 3–5 players');
      const core = deal(rng, playerCount);
      const mission = Number(options.mission ?? 1);
      const s: CrewState = { ...core, phase: 'draft', tasks: [], drafter: core.commander, doneOrder: [], mission, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null };
      s.tasks = edition.makeTasks(rng, mission, core);
      if (tutorial) edition.tutorialSetup(s);
      return s;
    },

    validate(s, actor, a) {
      if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
      if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
      const seat = actor.seat;
      switch (a.type) {
        case 'resign': return { ok: true };
        case 'draftTask':
          if (s.phase !== 'draft' || s.drafter !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
          return s.tasks.some((t) => t.id === a.task && t.owner === null) ? { ok: true } : { ok: false, errorCode: 'TASK_TAKEN' };
        case 'communicate':
          if (s.phase !== 'play' || s.trick.length) return { ok: false, errorCode: 'BETWEEN_TRICKS_ONLY' };
          if (s.commsUsed[seat]) return { ok: false, errorCode: 'ALREADY_COMMUNICATED' };
          return commKind(s.hands[seat]!, a.card) ? { ok: true } : { ok: false, errorCode: 'CANNOT_COMMUNICATE' };
        case 'play':
          if (s.phase !== 'play' || s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
          return legalCards(s, seat).includes(a.card) ? { ok: true } : { ok: false, errorCode: s.hands[seat]!.includes(a.card) ? 'MUST_FOLLOW_SUIT' : 'NOT_IN_HAND' };
      }
    },

    apply(s, actor, a) {
      const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
      s.seq += 1;
      if (a.type === 'resign') { s.outcome = team(s, false, 'resign'); return finish(s, [{ type: 'resigned', seat }]); }
      s.timeouts[seat] = 0;
      if (a.type === 'draftTask') {
        s.tasks.find((t) => t.id === a.task)!.owner = seat;
        if (s.tasks.every((t) => t.owner !== null)) { s.phase = 'play'; s.current = s.commander; }
        else s.drafter = (seat + 1) % s.players;
      } else if (a.type === 'communicate') {
        s.comms[seat] = { card: a.card, kind: commKind(s.hands[seat]!, a.card)! };
        s.commsUsed[seat] = true;
      } else {
        const done = playCard(s, seat, a.card);
        if (done) {
          edition.evaluate(s, done);
          if (handsEmpty(s)) edition.evaluate(s, null);
          settle(s);
        }
      }
      return finish(s, [{ type: a.type, seat }]);
    },

    project(s, viewer) {
      const { hands, timeouts: _t, ...rest } = structuredClone(s);
      const me = viewer.kind === 'player' ? viewer.seat : -1;
      return { ...rest, hand: hands[me] ?? null, handCounts: hands.map((h) => h.length) };
    },

    legalActions(s, viewer: Viewer) {
      if (s.outcome || viewer.kind !== 'player') return [];
      const seat = viewer.seat;
      const out: ActionHint[] = [];
      if (s.phase === 'draft' && s.drafter === seat) s.tasks.forEach((t) => { if (t.owner === null) out.push({ type: 'draftTask', task: t.id }); });
      if (s.phase === 'play') {
        if (s.current === seat) legalCards(s, seat).forEach((card) => out.push({ type: 'play', card }));
        if (!s.trick.length && !s.commsUsed[seat]) s.hands[seat]!.forEach((card) => { const kind = commKind(s.hands[seat]!, card); if (kind) out.push({ type: 'communicate', card, kind }); });
      }
      out.push({ type: 'resign' });
      return out;
    },

    outcome: (s) => s.outcome,

    onTimeout(s, _e, ctx) {
      if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
      const seat = mod.pendingSeats(s)[0]!;
      const missed = s.timeouts[seat]! + 1;
      const action: CrewAction = s.phase === 'draft' ? { type: 'draftTask', task: s.tasks.find((t) => t.owner === null)!.id } : { type: 'play', card: legalCards(s, seat)[0]! };
      const t = mod.apply(s, { kind: 'player', seat }, action, ctx);
      s.timeouts[seat] = missed;
      return { ...t, internalEvents: [{ type: 'timed-out' }] };
    },

    pendingSeats: (s) => (s.outcome ? [] : s.phase === 'draft' ? [s.drafter] : [s.current]),
    tutorial: edition.tutorial
  };
  return mod;
}

// ---------- Planet Nine ----------

/** Missions 1–10: number of task cards and their order tokens. */
export const MISSIONS: { tasks: number; orders: (number | 'last')[] }[] = [
  { tasks: 1, orders: [] }, { tasks: 2, orders: [] }, { tasks: 2, orders: [1, 2] }, { tasks: 3, orders: [] }, { tasks: 3, orders: [1] },
  { tasks: 3, orders: ['last'] }, { tasks: 4, orders: [] }, { tasks: 3, orders: [1, 2, 3] }, { tasks: 4, orders: [1, 'last'] }, { tasks: 5, orders: [] }
];

const nineEdition: Edition = {
  makeTasks(rng, mission, core) {
    const spec = MISSIONS[Math.min(Math.max(mission, 1), MISSIONS.length) - 1]!;
    const cards = shuffle(rng, DECK.filter((c) => suit(c) !== 'r' && c !== core.aside)).slice(0, spec.tasks);
    return cards.map((card, id) => ({ id, owner: null, status: 'open' as const, card, ...(spec.orders[id] !== undefined ? { order: spec.orders[id] } : {}) }));
  },
  evaluate(s, trick) {
    if (!trick) return;
    const hit = s.tasks.filter((t) => t.card && trick.cards.some((p) => p.card === t.card))
      .sort((a, b) => (typeof a.order === 'number' ? a.order : 99) - (typeof b.order === 'number' ? b.order : 99));
    for (const t of hit) {
      if (trick.winner !== t.owner) { t.status = 'failed'; continue; }
      const numbered = s.tasks.filter((x) => typeof x.order === 'number');
      const earlier = typeof t.order === 'number' && numbered.some((x) => (x.order as number) < (t.order as number) && x.status !== 'done');
      const lastOpen = t.order === 'last' && s.tasks.some((x) => x !== t && x.status !== 'done');
      const lastDone = s.tasks.some((x) => x.order === 'last' && x.status === 'done');
      t.status = earlier || lastOpen || lastDone ? 'failed' : 'done';
      if (t.status === 'done') s.doneOrder.push(t.id);
    }
  },
  tutorialSetup(s) {
    Object.assign(s, {
      players: 2, hands: [sortHand(['p9', 'b2', 'r4']), sortHand(['p3', 'b5', 'g7'])], aside: null, commander: 0, current: 0, drafter: 0,
      won: [[], []], comms: [null, null], commsUsed: [false, false], timeouts: [0, 0],
      tasks: [{ id: 0, owner: null, status: 'open', card: 'p3' }]
    });
  },
  tutorial: {
    seed: 9,
    options: { deal: 'tutorial' },
    introFa: 'ماموریت: شما باید کارت «صورتی ۳» را در یک دست ببرید. شما فرمانده‌اید (موشک ۴ دارید) و اول بازی می‌کنید.',
    steps: [
      { instructionFa: 'وظیفهٔ «صورتی ۳» را بردارید.', expected: { type: 'draftTask', task: 0 }, reply: null },
      { instructionFa: 'یک ارتباط: «آبی ۲» تنها کارت آبی شماست؛ نشانش دهید تا هم‌تیمی بداند.', expected: { type: 'communicate', card: 'b2' }, reply: null },
      { instructionFa: 'صورتی ۹ را بازی کنید؛ هم‌تیمی باید صورتی بیاید و صورتی ۳ را به شما می‌دهد.', expected: { type: 'play', card: 'p9' }, reply: { type: 'play', card: 'p3' } }
    ],
    completedFa: 'ماموریت موفق! صورتی ۳ را بردید و وظیفه انجام شد.'
  }
};

export const crewModuleNine = crewModule(theCrew.manifest, nineEdition);
