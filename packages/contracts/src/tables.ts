import { z } from 'zod';
import { competitionSchema, optionValueSchema, paceSchema } from '@bg/game-sdk';
import { publicProfile } from './api.ts';

/** Allowed per-turn time budgets. Live: seconds per move/round; turn-based: durable deadline per turn. */
export const TIME_OPTIONS = {
  live: [15, 30, 60, 120, 300],
  turn: [12 * 3600, 24 * 3600, 48 * 3600, 72 * 3600]
} as const;

export const tableStatusSchema = z.enum(['open', 'active', 'paused', 'finished', 'cancelled']);
export const visibilitySchema = z.enum(['public', 'private']);

export const createTableBody = z.strictObject({
  gameId: z.string().min(1).max(64),
  pace: paceSchema,
  competition: competitionSchema.default('friendly'),
  visibility: visibilitySchema.default('private'),
  capacity: z.number().int().min(1).max(16),
  turnSeconds: z.number().int().positive(),
  reminders: z.boolean().default(true),
  /** Rule variants chosen by the host; omitted keys use the game's default. */
  options: z.record(z.string().max(32), optionValueSchema).default({})
});
export type CreateTableBody = z.infer<typeof createTableBody>;

export const tableSettings = z.object({ turnSeconds: z.number().int(), reminders: z.boolean(), options: z.record(z.string(), optionValueSchema).optional() });

export const seatView = z.object({
  seat: z.number().int(),
  kind: z.enum(['human', 'script']),
  user: publicProfile.nullable(),
  ready: z.boolean()
});

export const tableLobby = z.object({
  id: z.uuid(),
  gameId: z.string(),
  gameNameFa: z.string(),
  gameNameOriginal: z.string(),
  status: tableStatusSchema,
  pace: paceSchema,
  competition: competitionSchema,
  visibility: visibilitySchema,
  capacity: z.number().int(),
  settings: tableSettings,
  rulesVersion: z.string(),
  stateSchemaVersion: z.number().int(),
  clientBundleRef: z.string(),
  isTutorial: z.boolean(),
  isMatchmade: z.boolean(),
  /** Matchmade tables: accept before this time or the match is dissolved. */
  readyDeadline: z.iso.datetime().nullable(),
  hostId: z.uuid(),
  seats: z.array(seatView),
  mySeat: z.number().int().nullable(),
  /** Only returned to participants of a private table. */
  inviteCode: z.string().nullable(),
  policies: z.object({ timeoutFa: z.string(), resignFa: z.string(), disconnectFa: z.string() }),
  /** Rule variants of this table in words (chosen at creation, or the game's defaults for matchmade tables). */
  variants: z.array(z.object({ labelFa: z.string(), valueFa: z.string() })),
  createdAt: z.iso.datetime()
});
export type TableLobby = z.infer<typeof tableLobby>;

export const outcomeSchema = z.object({
  reason: z.enum(['win', 'draw', 'score', 'timeout', 'resign']),
  placements: z.array(z.object({ seat: z.number().int(), place: z.number().int(), score: z.number().optional() }))
});

/** Everything a viewer may know about a table at one revision. Built only from module.project(). */
export const tableSnapshot = z.object({
  table: tableLobby,
  game: z.object({
    revision: z.number().int(),
    view: z.unknown(),
    legalActions: z.array(z.object({ type: z.string() }).loose()),
    pendingSeats: z.array(z.number().int()),
    deadline: z.object({ dueAt: z.iso.datetime(), frozen: z.boolean() }).nullable(),
    result: outcomeSchema.nullable(),
    tutorial: z.object({
      step: z.number().int(), total: z.number().int(), instructionFa: z.string(), introFa: z.string(),
      expected: z.object({ type: z.string() }).loose().nullable()
    }).nullable()
  }).nullable(),
  incident: z.object({ reasonFa: z.string(), startedAt: z.iso.datetime() }).nullable(),
  serverTime: z.iso.datetime()
});
export type TableSnapshot = z.infer<typeof tableSnapshot>;

export const commandBody = z.strictObject({
  commandId: z.uuid(),
  expectedRevision: z.number().int().min(0),
  action: z.object({ type: z.string().min(1).max(64) }).loose()
});

export const commandResult = z.object({
  status: z.enum(['accepted', 'rejected']),
  revision: z.number().int(),
  errorCode: z.string().nullable(),
  duplicate: z.boolean(),
  snapshot: tableSnapshot
});
export type CommandResult = z.infer<typeof commandResult>;

export const receiptLookup = z.union([
  z.object({ found: z.literal(false) }),
  z.object({ found: z.literal(true), status: z.enum(['accepted', 'rejected']), revision: z.number().int(), errorCode: z.string().nullable() })
]);

export const myTableItem = z.object({
  id: z.uuid(),
  gameId: z.string(),
  gameNameFa: z.string(),
  status: tableStatusSchema,
  pace: paceSchema,
  isTutorial: z.boolean(),
  isMyTurn: z.boolean(),
  deadline: z.iso.datetime().nullable(),
  players: z.number().int(),
  capacity: z.number().int(),
  updatedRevision: z.number().int()
});
export type MyTableItem = z.infer<typeof myTableItem>;

export const openTableItem = z.object({
  id: z.uuid(), gameId: z.string(), gameNameFa: z.string(), pace: paceSchema, players: z.number().int(),
  capacity: z.number().int(), turnSeconds: z.number().int(), host: publicProfile
});

export const notificationItem = z.object({
  id: z.uuid(),
  kind: z.enum(['turn', 'reminder', 'finished', 'invite', 'match', 'message', 'friend_request', 'club']),
  /** In-app destination; the target page re-checks authorization. */
  href: z.string(),
  tableId: z.uuid().nullable(),
  textFa: z.string(),
  createdAt: z.iso.datetime(),
  read: z.boolean()
});
export type NotificationItem = z.infer<typeof notificationItem>;

export const tutorialProgressItem = z.object({
  gameId: z.string(), status: z.enum(['in_progress', 'completed', 'skipped']), tableId: z.uuid().nullable()
});

/** Persian text for command-level rejection codes (status 200, `rejected`). */
export const GAME_ERRORS_FA: Record<string, string> = {
  STALE_REVISION: 'وضعیت میز تغییر کرده است؛ آخرین وضعیت نمایش داده شد. حرکت را دوباره بررسی کنید.',
  TABLE_NOT_ACTIVE: 'این میز در جریان نیست.',
  INVALID_ACTION: 'این حرکت معتبر نیست.',
  NOT_YOUR_TURN: 'نوبت شما نیست.',
  CELL_OCCUPIED: 'این خانه پر است.',
  ACTION_TAKEN: 'این اکشن در این دور قبلاً گرفته شده است.',
  ACTION_USED: 'از این اکشن در این نسل استفاده کرده‌اید.',
  ALREADY_BUILT: 'اینجا قبلاً ساخته شده است.',
  ALREADY_CHOSEN: 'قبلاً انتخاب کرده‌اید.',
  ANIMAL_FORBIDDEN: 'این حیوان را نمی‌شود اینجا گذاشت.',
  ANSWER_PENDING: 'اول به انتخاب بازمانده پاسخ دهید.',
  AWARD_TAKEN: 'این جایزه قبلاً تأمین مالی شده است.',
  BAD_AMOUNT: 'مقدار انتخاب‌شده معتبر نیست.',
  BAD_BUILDING: 'این ساختمان را اینجا نمی‌شود ساخت.',
  BAD_CARDS: 'کارت‌های انتخاب‌شده معتبر نیستند.',
  BAD_CELLS: 'این خانه‌ها برای ساختن مناسب نیستند.',
  BAD_CHOICE: 'این گزینه معتبر نیست.',
  BAD_COUNT: 'تعداد انتخاب‌شده درست نیست.',
  BAD_DRAFT: 'این کارت را نمی‌شود در درفت برداشت.',
  BAD_LINK: 'این مسیر معتبر نیست.',
  BAD_LOCATION: 'این مکان معتبر نیست.',
  BAD_MAP: 'این نقشه معتبر نیست.',
  BAD_PAYMENT: 'پرداخت با هزینهٔ کارت جور نیست.',
  BAD_SHAPE: 'شکل این ساختمان جا نمی‌شود.',
  BAD_SLOT: 'این جایگاه معتبر نیست.',
  BAD_SPACE: 'این خانه برای این کاشی مجاز نیست.',
  BAD_TARGET: 'هدف انتخاب‌شده معتبر نیست.',
  BOOSTER_UNAVAILABLE: 'این بوستر در دسترس نیست.',
  BUILD_NOT_ADJACENT: 'ساختمان باید کنار ساختمان‌های قبلی باشد.',
  CANNOT_AFFORD: 'منابع کافی برای این کار ندارید.',
  CANNOT_CONVERT: 'این تبدیل ممکن نیست.',
  CANNOT_DEVELOP: 'این کاشی را نمی‌شود توسعه داد.',
  CANNOT_PLAY: 'این کارت را الان نمی‌شود بازی کرد.',
  CANNOT_USE: 'الان نمی‌شود از این استفاده کرد.',
  CARD_CANNOT_BUILD: 'این کارت اجازهٔ ساختن در این مکان را نمی‌دهد.',
  CELL_BLOCKED: 'این خانه مسدود است.',
  CELL_COVERED: 'این خانه پوشیده است.',
  CELL_TERRAIN: 'نوع زمین این خانه مناسب نیست.',
  CLAIM_LOCKED: 'کمی صبر کنید؛ پس از ادعای اشتباه موقتاً قفل هستید.',
  CONDITIONS: 'شرط‌های این کارت برقرار نیست.',
  FACTION_UNAVAILABLE: 'این جناح در دسترس نیست.',
  FEDERATION_INVALID: 'این فدراسیون معتبر نیست.',
  FIRST_ACTION_REQUIRED: 'اول باید اکشن آغازین را انجام دهید.',
  GAIA_NOT_READY: 'این سیاره هنوز گایا نشده است.',
  HAS_WILD: 'وقتی کارت آزاد دارید نمی‌توانید جست‌وجو کنید.',
  ILLEGAL_CHOICE: 'این انتخاب مجاز نیست.',
  KIOSK_DISTANCE: 'کیوسک باید دست‌کم ۳ خانه از کیوسک دیگر فاصله داشته باشد.',
  LINK_TAKEN: 'این مسیر قبلاً ساخته شده است.',
  MILESTONE_NOT_REACHED: 'شرط این نقطهٔ عطف هنوز برقرار نیست.',
  MILESTONE_TAKEN: 'این نقطهٔ عطف قبلاً ثبت شده است.',
  NEEDS_BORDER: 'این ساختمان باید کنار مرز باغ‌وحش باشد.',
  NEEDS_BUILD_UPGRADE: 'ساختن اینجا به کارت ساخت ارتقایافته نیاز دارد.',
  NEEDS_ROCK: 'این حیوان به محوطه‌ای کنار صخره نیاز دارد.',
  NEEDS_WATER: 'این حیوان به محوطه‌ای کنار آب نیاز دارد.',
  NOT_A_SPONSOR: 'این کارت حامی نیست.',
  NOT_DRAFTING: 'الان مرحلهٔ درفت نیست.',
  NOT_IN_GAME: 'این مورد در این بازی نیست.',
  NOT_IN_HAND: 'این کارت در دست شما نیست.',
  NOT_IN_NETWORK: 'این مکان در شبکهٔ شما نیست.',
  NOT_IN_PLAY: 'این کارت روی میز شما نیست.',
  NOT_OPTIONAL: 'این بخش اختیاری نیست.',
  NOT_SELLABLE: 'این صنعت را نمی‌شود فروخت.',
  NO_ACTION: 'اکشنی برای انجام نمانده است.',
  NO_ACTION_TAKEN: 'هنوز اکشنی انجام نداده‌اید.',
  NO_BEER: 'آبجوی در دسترس نیست.',
  NO_COAL: 'زغال‌سنگ متصل در دسترس نیست.',
  NO_DEVELOP_BONUS: 'پاداش توسعه در دسترس نیست.',
  NO_ENCLOSURE: 'محوطهٔ خالی مناسب ندارید.',
  NO_LINKS_LEFT: 'مسیر دیگری برای ساختن ندارید.',
  NO_LOAN: 'وام گرفتن با این درآمد ممکن نیست.',
  NO_MERCHANT: 'تاجری برای این کالا متصل نیست.',
  NO_MONEY: 'پول کافی ندارید.',
  NO_PIECES: 'مهرهٔ دیگری برای این کار ندارید.',
  NO_PROMPT: 'انتخابی منتظر پاسخ شما نیست.',
  NO_ROOM: 'جایی برای این مورد نمانده است.',
  NO_SPACE: 'خانهٔ مجازی برای این کاشی نمانده است.',
  NO_TARGET: 'هدف معتبری برای این اثر وجود ندارد.',
  NO_TILES_LEFT: 'کاشی دیگری از این نوع ندارید.',
  NO_WILD_LEFT: 'کارت آزاد دیگری نمانده است.',
  ONE_CANAL_LINK: 'در دورهٔ کانال فقط یک مسیر در هر نوبت می‌سازید.',
  ONE_TILE_PER_TOWN: 'در دورهٔ کانال در هر شهر فقط یک کاشی می‌توانید داشته باشید.',
  OVERBUILD_LEVEL: 'فقط با سطح بالاتر می‌شود روی کاشی ساخت.',
  OVERBUILD_OPPONENT: 'روی کاشی حریف فقط وقتی می‌شود ساخت که آن منبع در بازار تمام شده باشد.',
  OVERBUILD_RESOURCES_LEFT: 'این کاشی هنوز منبع دارد و نمی‌شود رویش ساخت.',
  PARAMETER_MAXED: 'این پارامتر جهانی به حداکثر رسیده است.',
  PRODUCTION_TOO_LOW: 'تولید کافی برای این کار ندارید.',
  REQUIREMENTS_NOT_MET: 'شرط‌های این کارت برقرار نیست.',
  RESEARCH_BLOCKED: 'این پیشرفت پژوهشی ممکن نیست.',
  SLOT_REJECTS_INDUSTRY: 'این جایگاه این صنعت را نمی‌پذیرد.',
  SLOT_TAKEN: 'این جایگاه پر است.',
  UNKNOWN_AWARD: 'این جایزه وجود ندارد.',
  UNKNOWN_MILESTONE: 'این نقطهٔ عطف وجود ندارد.',
  USE_SINGLE_SLOT: 'برای این صنعت باید از جایگاه تکی استفاده کنید.',
  WRONG_ERA_LINK: 'این نوع مسیر در این دوره ساخته نمی‌شود.',
  WRONG_ERA_TILE: 'این کاشی در این دوره ساخته نمی‌شود.',
  ROLL_FIRST: 'اول باید تاس بریزید.',
  NO_ROLLS_LEFT: 'سه بار تاس ریخته‌اید؛ یک خانه را پر کنید.',
  JOKER_RULE: 'با یاتزی اضافه باید طبق قانون جوکر خانهٔ مجاز را پر کنید.',
  CARD_NOT_ON_TABLE: 'این کارت دیگر روی میز نیست.',
  INVALID_TARGET: 'از این بازیکن نمی‌توانید بپرسید.',
  ALREADY_ANSWERED: 'این بازیکن قبلاً دربارهٔ این خانه جواب داده است.',
  CLUE_FORBIDS: 'سرنخ شما این کار را روی این خانه اجازه نمی‌دهد.',
  NO_SUCH_CARD: 'این کارت در دست شما نیست.',
  NOT_RACING: 'ماشین شما دیگر در مسابقه نیست.',
  GEAR_NOT_ALLOWED: 'این دنده مجاز نیست؛ بیشتر از یک دنده جابه‌جا کردن هیت می‌خواهد.',
  WRONG_CARD_COUNT: 'تعداد کارت‌ها باید با دنده برابر باشد.',
  HEAT_NOT_PLAYABLE: 'کارت هیت را نمی‌شود بازی کرد.',
  NOT_ENOUGH_HEAT: 'هیت کافی در موتور ندارید.',
  ALREADY_BOOSTED: 'در این نوبت یک بار بوست زده‌اید.',
  NO_ADRENALINE: 'آدرنالین فقط برای ماشین‌های آخر است.',
  NO_SLIPSTREAM: 'شرایط اسلیپ‌استریم برقرار نیست.',
  CANNOT_DISCARD: 'این کارت را نمی‌شود دور انداخت.',
  GAME_FINISHED: 'بازی تمام شده است.',
  NOT_A_PLAYER: 'شما بازیکن این میز نیستید.',
  ALREADY_COMMITTED: 'پیشنهاد این دور را قبلاً ثبت کرده‌اید.',
  TOKEN_UNAVAILABLE: 'این ژتون را قبلاً مصرف کرده‌اید.',
  ALREADY_RESIGNED: 'شما از این بازی انصراف داده‌اید.',
  TUTORIAL_EXPECTED_OTHER: 'در این مرحله آموزش، حرکت مشخص‌شده را انجام دهید.',
  WRONG_PHASE: 'این حرکت در این مرحله از نوبت ممکن نیست.',
  NOT_ENOUGH_RESOURCES: 'منابع کافی ندارید.',
  ILLEGAL_PLACEMENT: 'اینجا نمی‌توانید بسازید.',
  MUST_TRADE: 'با ۵ کارت یا بیشتر باید پیش از جای‌گذاری یک دست کارت معاوضه کنید.',
  NOT_A_SET: 'این سه کارت یک دست معتبر نیستند.',
  WRONG_ARMY_COUNT: 'تعداد سربازها درست نیست.',
  NOT_YOUR_TERRITORY: 'این سرزمین مال شما نیست.',
  NOT_ADJACENT: 'این دو سرزمین همسایه نیستند.',
  NOT_CONNECTED: 'مسیری از سرزمین‌های خودتان بین این دو نیست.',
  TOO_FEW_ARMIES: 'سرباز کافی در این سرزمین نیست.',
  TOO_MANY_DICE: 'با این تعداد سرباز نمی‌توانید این‌قدر تاس بریزید.',
  ROUTE_TAKEN: 'این مسیر را قبلاً کسی ساخته است.',
  OWN_DOUBLE: 'هر دو مسیر یک مسیر دوتایی را نمی‌توانید بسازید.',
  DOUBLE_CLOSED: 'در بازی ۲ یا ۳ نفره، مسیر دوم یک مسیر دوتایی بسته است.',
  NOT_ENOUGH_TRAINS: 'واگن کافی برای این مسیر ندارید.',
  NOT_ENOUGH_CARDS: 'کارت کافی برای این مسیر ندارید.',
  WRONG_COLOR: 'رنگ کارت‌ها با رنگ مسیر یکی نیست.',
  INVALID_TICKETS: 'این بلیت‌ها جزو بلیت‌های پیشنهادی شما نیستند.',
  KEEP_MORE_TICKETS: 'باید بلیت‌های بیشتری نگه دارید.',
  CHOOSE_TICKETS: 'اول بلیت‌های مقصد را انتخاب کنید.',
  EMPTY_SLOT: 'این خانه کارت ندارد.',
  LOCO_SECOND: 'لوکوموتیو رو را نمی‌شود به‌عنوان کارت دوم برداشت.',
  DECK_EMPTY: 'دسته کارت خالی است.',
  NO_TICKETS: 'بلیت مقصدی در دسته نمانده است.'
};
