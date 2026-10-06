// Shared game SDK contract. Rules modules depend only on this package.
// Phase 00 defines the manifest/catalog schema used by the registry and seed;
// the engine runtime (EngineContext RNG/logical time, command handling) arrives in DRAGON-01.
import { z } from 'zod';

export const paceSchema = z.enum(['live', 'turn']);
export const competitionSchema = z.enum(['friendly', 'ranked']);
export const difficultySchema = z.enum(['easy', 'medium', 'hard']);
export const accessSchema = z.enum(['free', 'premium']);

/** A value a rule variant can take. */
export const optionValueSchema = z.union([z.string().max(40), z.number(), z.boolean()]);
export type OptionValue = z.infer<typeof optionValueSchema>;

/**
 * A rule variant the module supports (e.g. who moves first). The module declares every possible choice and the
 * default that reproduces its standard rules; the admin panel narrows what is offered per game, and the chosen
 * values reach `setup` through `SetupContext.options` (recorded with the start input, so replay is exact).
 */
export const gameOptionSchema = z.strictObject({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]{0,30}$/),
  labelFa: z.string().min(1),
  descriptionFa: z.string().min(1).optional(),
  choices: z.array(z.strictObject({ value: optionValueSchema, labelFa: z.string().min(1) })).min(2),
  default: optionValueSchema
}).refine((o) => o.choices.some((c) => c.value === o.default), 'default must be one of the choices');
export type GameOption = z.infer<typeof gameOptionSchema>;

export const gameManifestSchema = z.strictObject({
  gameId: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/),
  rulesVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  stateSchemaVersion: z.number().int().positive(),
  supportedModes: z.strictObject({
    pace: z.array(paceSchema).min(1),
    competition: z.array(competitionSchema).min(1)
  }),
  playerCounts: z.strictObject({ min: z.number().int().min(1), max: z.number().int().min(1) })
    .refine((p) => p.min <= p.max, 'min must be <= max'),
  options: z.array(gameOptionSchema).default([]),
  capabilities: z.array(z.enum(['public-state', 'hidden-information', 'simultaneous-actions', 'seeded-rng'])),
  clientBundleRef: z.string().min(1),
  assetsRef: z.string().min(1)
});
export type GameManifest = z.infer<typeof gameManifestSchema>;

/** Persian catalog/detail metadata. Shown before a player joins a table (FR-03). */
export const gameCatalogEntrySchema = z.strictObject({
  nameFa: z.string().min(1),
  nameOriginal: z.string().min(1),
  summaryFa: z.string().min(1),
  rulesFa: z.array(z.string().min(1)).min(1),
  minutes: z.strictObject({ min: z.number().int().positive(), max: z.number().int().positive() }),
  difficulty: difficultySchema,
  access: accessSchema,
  /** Original engine-proof fixture, not a commercial title. Must be labelled in the UI. */
  isTestGame: z.boolean(),
  timeoutPolicyFa: z.string().min(1),
  resignPolicyFa: z.string().min(1),
  tutorialFa: z.string().min(1)
});
export type GameCatalogEntry = z.infer<typeof gameCatalogEntrySchema>;

export interface GameDefinition {
  manifest: GameManifest;
  catalog: GameCatalogEntry;
}

export function defineGame(def: GameDefinition): GameDefinition {
  return { manifest: gameManifestSchema.parse(def.manifest), catalog: gameCatalogEntrySchema.parse(def.catalog) };
}

// ---- Engine contract (Requirements §6) ----
// Rules modules are pure: no network, database, wall clock or Math.random. Randomness and time come only
// from the EngineContext the engine passes in, so every game is deterministically replayable.

export type Actor = { kind: 'player'; seat: number } | { kind: 'engine' };
export type Viewer = { kind: 'player'; seat: number } | { kind: 'spectator' };
export type Validation = { ok: true } | { ok: false; errorCode: string };

/** Modules ask for a named deadline; the platform turns it into a due time from the table's time settings. */
export type ScheduleChange = { kind: 'set'; deadlineKey: 'turn' } | { kind: 'clear'; deadlineKey: 'turn' };

export interface Transition<State> {
  nextState: State;
  /** Internal events may contain hidden information; persisted server-side, never sent to clients. */
  internalEvents: { type: string; [key: string]: unknown }[];
  scheduleChanges: ScheduleChange[];
}

export interface ActionHint { type: string; [key: string]: unknown }

export interface Outcome {
  /** place 1 = best; equal places mean a shared placement (ties/draws). */
  placements: { seat: number; place: number; score?: number }[];
  reason: 'win' | 'draw' | 'score' | 'timeout' | 'resign';
}

export interface EngineRng { nextInt(maxExclusive: number): number }
export interface SetupContext { playerCount: number; options: Record<string, unknown>; rng: EngineRng }
export interface EngineContext { rng: EngineRng; logicalTime: number }
export interface TimeoutEvent { deadlineKey: 'turn' }

export interface GameModule<State = unknown, Action extends { type: string } = { type: string }, View = unknown> {
  manifest: GameManifest;
  /** Runtime schema for untrusted client actions. */
  actionSchema: z.ZodType<Action>;
  setup(ctx: SetupContext): State;
  validate(state: State, actor: Actor, action: Action): Validation;
  apply(state: State, actor: Actor, action: Action, ctx: EngineContext): Transition<State>;
  project(state: State, viewer: Viewer): View;
  legalActions(state: State, viewer: Viewer): ActionHint[];
  outcome(state: State): Outcome | null;
  onTimeout(state: State, event: TimeoutEvent, ctx: EngineContext): Transition<State>;
  /** Seats the game is currently waiting on (public information: who must act, never what they chose). */
  pendingSeats(state: State): number[];
  /** Scripted interactive tutorial; the opponent is a fixed script, not an AI. */
  tutorial: TutorialScript<Action>;
}

export interface TutorialStep<Action> {
  instructionFa: string;
  /** Exact action the learner must take, or null for any legal action. */
  expected: Action | null;
  /** Scripted reply for the tutorial seat 1 after the learner's action, if the game waits on it. */
  reply: Action | null;
}

export interface TutorialScript<Action> {
  /** Fixed seed so setup is reproducible (e.g. the learner moves first). */
  seed: number;
  introFa: string;
  steps: TutorialStep<Action>[];
  completedFa: string;
}

/**
 * Future AI seat contract (no implementation in this delivery). A bot gets only the permitted projection and
 * legal actions for its own seat and submits through the normal command path with its own participant id.
 */
export interface BotAdapter {
  readonly participantId: string;
  decide(input: { view: unknown; legalActions: ActionHint[]; revision: number }): Promise<{ type: string } | null>;
}
