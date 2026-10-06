// Shared game engine. Pure TypeScript: no HTTP, database, wall clock or commerce. The server persists what it
// returns (state, rngState, events, schedule changes) and supplies logicalTime; the same code runs in tests.
import { lineThreeModule } from '@bg/game-line-three';
import { sealedBidsModule } from '@bg/game-sealed-bids';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, ScheduleChange, Viewer } from '@bg/game-sdk';

// ---------- Deterministic RNG (mulberry32). State is one uint32, persisted with each snapshot, never projected. ----------
export interface RngState { s: number }

export function createRng(state: RngState): EngineRng & { state(): RngState } {
  let s = state.s >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    nextInt(maxExclusive: number) {
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1) throw new Error('nextInt needs a positive integer');
      return Math.floor(next() * maxExclusive);
    },
    state: () => ({ s })
  };
}

// ---------- Registry of reviewed modules, keyed by gameId and rulesVersion ----------
type AnyModule = GameModule<unknown, { type: string }, unknown>;

export class GameRegistry {
  private readonly modules = new Map<string, Map<string, AnyModule>>();

  constructor(modules: readonly GameModule<never, never, never>[] = []) {
    for (const m of modules) this.register(m);
  }

  register(module: GameModule<never, never, never>): void {
    const { gameId, rulesVersion } = module.manifest;
    const versions = this.modules.get(gameId) ?? new Map<string, AnyModule>();
    if (versions.has(rulesVersion)) throw new Error(`${gameId}@${rulesVersion} already registered`);
    versions.set(rulesVersion, module as unknown as AnyModule);
    this.modules.set(gameId, versions);
  }

  /** Resolve the exact pinned version of a live table. Old versions stay resolvable while registered. */
  resolve(gameId: string, rulesVersion: string): AnyModule {
    const m = this.modules.get(gameId)?.get(rulesVersion);
    if (!m) throw new Error(`Game module ${gameId}@${rulesVersion} is not registered`);
    return m;
  }

  has(gameId: string, rulesVersion: string): boolean {
    return !!this.modules.get(gameId)?.has(rulesVersion);
  }

  all(): AnyModule[] {
    return [...this.modules.values()].flatMap((v) => [...v.values()]);
  }
}

/** Reviewed in-repo modules. Adding a game = adding its module here (docs/ADDING_A_GAME.md). */
export const reviewedModules = [lineThreeModule, sealedBidsModule] as unknown as GameModule<never, never, never>[];
export const createDefaultRegistry = () => new GameRegistry(reviewedModules);

// ---------- Running the game ----------
export interface EngineSnapshot { state: unknown; rng: RngState }

export interface StepResult {
  snapshot: EngineSnapshot;
  internalEvents: { type: string; [key: string]: unknown }[];
  scheduleChanges: ScheduleChange[];
  outcome: Outcome | null;
  pendingSeats: number[];
}

export type StepRejection = { ok: false; errorCode: string };

export function startGame(module: AnyModule, input: { playerCount: number; options?: Record<string, unknown>; seed: number }): StepResult {
  const rng = createRng({ s: input.seed });
  const state = module.setup({ playerCount: input.playerCount, options: input.options ?? {}, rng });
  return {
    snapshot: { state, rng: rng.state() },
    internalEvents: [{ type: 'started', playerCount: input.playerCount }],
    scheduleChanges: [{ kind: 'set', deadlineKey: 'turn' }],
    outcome: module.outcome(state),
    pendingSeats: module.pendingSeats(state)
  };
}

/** Validate and apply one action. A rejection never produces a new snapshot. */
export function applyAction(module: AnyModule, snap: EngineSnapshot, actor: Actor, rawAction: unknown, logicalTime: number): StepResult | StepRejection {
  const parsed = module.actionSchema.safeParse(rawAction);
  if (!parsed.success) return { ok: false, errorCode: 'INVALID_ACTION' };
  const validation = module.validate(snap.state, actor, parsed.data);
  if (!validation.ok) return { ok: false, errorCode: validation.errorCode };
  const rng = createRng(snap.rng);
  const t = module.apply(structuredClone(snap.state), actor, parsed.data, { rng, logicalTime });
  return toStep(module, t, rng.state());
}

export function applyTimeout(module: AnyModule, snap: EngineSnapshot, logicalTime: number): StepResult {
  const rng = createRng(snap.rng);
  const t = module.onTimeout(structuredClone(snap.state), { deadlineKey: 'turn' }, { rng, logicalTime });
  return toStep(module, t, rng.state());
}

function toStep(module: AnyModule, t: { nextState: unknown; internalEvents: StepResult['internalEvents']; scheduleChanges: ScheduleChange[] }, rng: RngState): StepResult {
  return {
    snapshot: { state: t.nextState, rng },
    internalEvents: t.internalEvents,
    scheduleChanges: t.scheduleChanges,
    outcome: module.outcome(t.nextState),
    pendingSeats: module.pendingSeats(t.nextState)
  };
}

/** Authorized view for one viewer. This is the only game data that may leave the server. */
export function projectFor(module: AnyModule, snap: EngineSnapshot, viewer: Viewer): { view: unknown; legalActions: ActionHint[] } {
  return { view: module.project(snap.state, viewer), legalActions: module.legalActions(snap.state, viewer) };
}

export type ReplayInput =
  | { kind: 'action'; actor: Actor; action: unknown; logicalTime: number }
  | { kind: 'timeout'; logicalTime: number };

/** Deterministic replay from seed + recorded inputs (debugging / verification; internal only). */
export function replay(module: AnyModule, setup: { playerCount: number; seed: number }, inputs: ReplayInput[]): EngineSnapshot {
  let snap = startGame(module, setup).snapshot;
  for (const input of inputs) {
    const r = input.kind === 'timeout' ? applyTimeout(module, snap, input.logicalTime) : applyAction(module, snap, input.actor, input.action, input.logicalTime);
    if ('ok' in r) throw new Error(`replay rejected input: ${r.errorCode}`);
    snap = r.snapshot;
  }
  return snap;
}

export type { AnyModule };
