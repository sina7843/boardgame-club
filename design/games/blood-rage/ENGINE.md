# بلاد ریج: مشخصات موتور (v1.0، ۲۰۲۶-۱۰-۳۰)

ریپو بازی بلاد ریج ندارد. **تیم فنی موتور را هم می‌سازد.** این سند می‌گوید موتور چه چیزی به UI بدهد تا طراحی (`HANDOFF.md`، `COMPONENTS.md`) بدون حدس پیاده شود. منبع قانون‌ها: دفترچهٔ CMON (`reference/rules/BLR001-Rulebook.pdf`، ص ۹ تا ۲۴) و متن کارت‌ها (`data/content.json`، از دادهٔ BGA نسخهٔ `231218-1618`). جایی که دفترچه ساکت است، صریح نوشته شده («تصمیم باز»).

- اسلاگ: `blood-rage`
- بازیکن: ۲ تا ۵ (پنج نفره با کارت‌های بازیکن پنجم که در `content.json` هستند، `minPlayers: 5`)
- توسعه‌ها: هیچ‌کدام (Mystics of Midgard، Gods of Asgard، Monsters در دادهٔ BGA هم نیستند)
- قابلیت‌ها: `hidden-information`، `seeded-rng`
- ربات: لازم نیست (بدون `bot` گزینهٔ «بازی با ربات» نمایش داده نمی‌شود)

## ۱. ساختار پوشه (مثل `games/brass`)

```
games/blood-rage/
  package.json          name "@bg/game-blood-rage", deps: @bg/game-sdk, zod, @bg/ui (همان نسخه‌های brass)
  tsconfig.json
  src/
    index.ts            export { bloodRage } from './definition.ts'; export * from './rules.ts'
    definition.ts       defineGame({ manifest, catalog })  — متن فارسی قوانین در catalog.rulesFa
    types.ts            همهٔ نوع‌های §۲
    rules.ts            bloodRageModule: GameModule<State, Action, View>
    content/
      index.ts          CARDS, PROVINCES, FJORDS, SLOTS, STAT_TRACKS, … از data/content.json (به TS تبدیل شود، نه import JSON در زمان اجرا)
      README.md         منبع هر عدد
    renderer.tsx        UI طبق COMPONENTS.md
    renderer.css        همه زیر .bdr
    assets.d.ts
    art/                کپی design/games/blood-rage/art
```

تست‌ها مثل بقیه: `packages/game-engine/test/blood-rage*.test.ts` و `e2e/blood-rage.spec.ts`. نمونهٔ وضعیت برای تست: `data/mock-state.json → main` (عصر ۲، فاز اقدام).

## ۲. وضعیت (State)

```ts
type Seat = number;                         // 0..players-1 ساعت‌گرد؛ «چپ» = seat+1
type ClanId = 1 | 2 | 3 | 4 | 5;            // 1 گرگ، 2 مار، 3 کلاغ، 4 خرس، 5 قوچ (همان BGA)
type ProvinceId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;   // 0 ایگدراسیل؛ 1..8 ساعت‌گرد از میرکولور
type FjordId = 0 | 1 | 2 | 3;
type SlotId = number;                       // 1..32 روستا (0 = لنگر ایگدراسیل، بی‌ظرفیت)
type Where = 'reserve' | `village:${SlotId}` | 'yggdrasil' | `fjord:${FjordId}` | 'valhalla' | 'box';
type Phase = 'draft' | 'action' | 'discard' | 'quest' | 'ragnarok' | 'valhalla' | 'ended';
type StatKey = 'rage' | 'axe' | 'horn';
type Reward = 'yggdrasil' | 'rage' | 'axe' | 'horn' | 'glory';

interface Figure { id: string; seat: Seat; kind: 'leader' | 'warrior' | 'ship' | 'monster'; monster: number | null; where: Where }

interface BloodRageState {
  v: 1;
  players: number;
  clans: ClanId[];                          // clans[seat]
  age: 1 | 2 | 3;
  phase: Phase;
  first: Seat;                              // بازیکن اول این عصر
  turn: Seat | null;                        // فقط در فاز اقدام
  ragnarok: [ProvinceId, ProvinceId, ProvinceId];   // استان نابودشوندهٔ هر عصر (عمومی)
  destroyed: ProvinceId[];
  pillage: Record<ProvinceId, { reward: Reward; pillaged: boolean; by?: Seat }>;
  figures: Figure[];                        // همهٔ مهره‌ها (۱۰ برای هر قبیله + هیولاها)
  rage: number[];                           // خشم فعلی
  stats: Record<StatKey, number>[];         // پله ۰..۵؛ مقدار از STAT_TRACKS
  glory: number[];
  upgrades: { leader: number | null; warrior: number | null; ship: number | null; monster: [number | null, number | null]; clan: [number | null, number | null, number | null] }[];
  hands: number[][];                        // پنهان
  quests: number[][];                       // متعهدشده، رو به پایین (تعداد عمومی، متن فقط برای صاحبش)
  passed: boolean[];
  decks: [number[], number[], number[]];    // پنهان؛ کارت‌های بیرون از تعداد بازیکن حذف شده
  draft: { packs: number[][]; pick: number; picked: (number[] | null)[] } | null;   // پنهان
  battle: Battle | null;
  pending: Pending | null;
  discardPublic: number[];                  // کارت‌های نبردی که برنده دور ریخت (عمومی؛ دکمهٔ «دورریخته»)
  discardHidden: number[];                  // دو کارت آخر درفت و دور ریختن پایان عصر (پنهان)
  battles: BattleRecord[];                  // بایگانی نبردها (عمومی؛ «آخرین نبرد» و «بایگانی»)
  log: LogEntry[];
  timeouts: number[];
  outcome: Outcome | null;
}

interface Battle {
  province: ProvinceId;
  attacker: Seat;                           // غارتگر (یا null برای نبرد بدون غارت؛ در بازی پایه همیشه غارت است)
  step: 'call' | 'cards' | 'afterReveal' | 'resolve';
  callOrder: Seat[];                        // از چپ غارتگر، خود غارتگر آخر
  callIndex: number;
  played: Record<Seat, number | null>;      // پنهان تا همه انتخاب کنند
  revealed: boolean;
  extra: Record<Seat, number[]>;            // کارت‌های «پس از آشکار شدن»
  passedAfter: Seat[];
}
interface BattleRecord { age: number; province: ProvinceId; attacker: Seat; lines: { seat: Seat; str: number; cards: number[]; figures: string[] }[]; winner: Seat | null; pillaged: boolean }
interface LogEntry { seat: Seat | null; type: string; [k: string]: unknown }   // متن را رندرر می‌سازد (فارسی/انگلیسی)
```

`data/mock-state.json` دقیقاً همین شکل است (نمونه‌ها: `main` میز اصلی، `afterTroll`، `battle`، `afterBattle`).

## ۳. داده (`content/`)

همه از `data/content.json`:

| نام | چیست |
| --- | --- |
| `CARDS` | ۱۲۶ کارت: `num`، `age`، `minPlayers` (۲/۳/۴/۵)، `type`، `ruleId`، `value`، `afterReveal`، `titleEn/Fa`، `rulesEn/Fa`، `art`، `back`، `set` |
| `PROVINCES` | ۹ استان: `region`، `villages` (شمارهٔ روستاها؛ ۳ تا ۵)، `adjacent`، `fjords`، مختصات |
| `FJORDS` | ۴ آبدره، هر کدام پشتیبان دو استان (`supports`) |
| `STAT_TRACKS` | خشم `[6,7,8,9,12,12]`، تبر `[3,4,5,6,8,8]`، شاخ `[4,5,6,7,10,10]` (دادهٔ BGA؛ دو پلهٔ آخر برابرند) |
| `LEGENDARY` | پایان بازی، برای هر ویژگی جدا: پلهٔ چهارم یا پنجم (اندیس ۳ یا ۴) +۱۰، پلهٔ ششم و آخر (اندیس ۵) +۲۰ (دفترچه ص ۲۳) |
| `RAGNAROK_GLORY` | عصر ۱: ۲، عصر ۲: ۳، عصر ۳: ۴ برای هر مهره |
| `DESTROYED_AT_START` | ۲ نفره ۳، ۳ نفره ۲، ۴ نفره ۱، ۵ نفره ۰ (تصمیم باز ۱) |

**همسایگی:** ایگدراسیل همسایهٔ همه است. استان‌های بیرونی حلقه‌اند: هر کدام با دو همسایهٔ حلقه (۱–۲، ۲–۳، …، ۸–۱). این از روی نقشهٔ چاپی و مثال دفترچه (ص ۱۹: هورگر همسایهٔ آندلانگ نیست) استخراج شده؛ پیش از نهایی کردن روی نقشهٔ چاپی دوباره چک شود (تصمیم باز ۲).

## ۴. قانون‌های قدرت (STR)

- پایه: سردار ۳، جنگجو ۱، کشتی ۲، هیولا = `value` کارتش.
- کارت ارتقای مهره قدرت را جایگزین می‌کند (`value`): کارشناسان سلاح جنگجو را ۲ می‌کند؛ برادران/استادان سلاح «هر جفت جنگجو در یک استان ۳/۶» (جنگجوی تک ۱ می‌ماند). سردار و کشتی توانایی چاپی خودشان را حفظ می‌کنند.
- جن تاریکی در ایگدراسیل ۳.
- قدرت هر قبیله در یک استان = مهره‌های آن استان + کشتی‌های آبدره‌های پشتیبانش. همین برای نبرد، مأموریت و راگناروک.

## ۵. اقدام‌ها (zod `discriminatedUnion('type')`)

```ts
type Action =
  | { type: 'draftPick'; cards: number[] }                       // ۱ کارت (۲ در دو نفره)
  | { type: 'invade'; figure: string; to: Where }                // village:* یا fjord:* (یا yggdrasil برای جن تاریکی)
  | { type: 'march'; from: ProvinceId; to: ProvinceId; figures: string[] }
  | { type: 'upgrade'; card: number; slot: 'leader' | 'warrior' | 'ship' | 'monster' | 'clan'; index?: number }
  | { type: 'quest'; card: number }
  | { type: 'pillage'; province: ProvinceId }
  | { type: 'clanAction'; card: number; target?: ProvinceId; figures?: string[]; stat?: StatKey }   // هماورد تیر، فداکاری فریگا
  | { type: 'pass' }
  | { type: 'decide'; kind: PendingKind; choice: unknown }        // §۷
  | { type: 'resign' };
```

| اقدام | هزینه | شرط | کد خطا |
| --- | --- | --- | --- |
| `invade` | خشم = قدرت مهره؛ سردار ۰؛ سرکردهٔ کوتوله‌ها و سرباز هِل ۰ | مهره در ذخیره؛ مهره‌های روی نقشه < شاخ؛ مقصد روستای خالی استان بیرونی سالم؛ کشتی و مار دریایی فقط آبدره‌ای که دست‌کم یک استان پشتیبانش سالم است؛ ایگدراسیل فقط جن تاریکی | `NO_RAGE` `HORNS_FULL` `NOT_IN_RESERVE` `VILLAGE_TAKEN` `PROVINCE_DESTROYED` `YGGDRASIL_MARCH_ONLY` `SHIP_FJORD_ONLY` |
| `march` | ۱ خشم | از یک استان (نه آبدره) به یک استان دیگر؛ فقط مهره‌های غیرکشتی صاحب؛ روستای خالی کافی (ایگدراسیل بی‌سقف) | `NO_RAGE` `SHIPS_CANNOT_MOVE` `NOT_ENOUGH_VILLAGES` `SAME_PROVINCE` `NOT_YOUR_FIGURE` |
| `upgrade` | خشم = `value` کارت (افسون فریگا −۱، کمینه ۰؛ سرکردهٔ کوتوله‌ها و سرباز هِل ۰) | کارت ارتقا در دست؛ جایگاه هم‌نوع؛ کارت قبلی دور ریخته؛ هیولای قبلی به `box`؛ حداکثر ۲ هیولا | `NO_RAGE` `NOT_UPGRADE_CARD` `SLOT_MISMATCH` |
| `quest` | ۰، ولی خشم باید > ۰ | کارت مأموریت در دست | `NO_RAGE` `NOT_QUEST_CARD` |
| `pillage` | ۰، ولی خشم باید > ۰ | استان سالم، غارت‌نشده در این عصر، مهرهٔ شما در آن یا کشتی در آبدرهٔ پشتیبانش | `NO_RAGE` `ALREADY_PILLAGED` `NO_PRESENCE` `PROVINCE_DESTROYED` |
| `clanAction` | طبق کارت | کارت در جایگاه قبیلهٔ شما | `NO_RAGE` `CARD_NOT_OWNED` |
| `pass` | همهٔ خشم باقی | — | — |

قاعدهٔ عمومی: با خشم صفر هیچ اقدامی ممکن نیست (`NO_RAGE`)، ولی تصمیم‌های نبرد (`decide`) ممکن است. فاز اقدام وقتی تمام می‌شود که خشم همه صفر باشد یا همهٔ استان‌های سالم غارت شده باشند. نوبت ساعت‌گرد از `first`؛ بازیکنِ با خشم صفر رد می‌شود.

## ۶. چرخهٔ عصر

1. **هدایای خدایان** (`draft`): از دستهٔ عصر ۸ کارت به هر نفر. هم‌زمان: هر نفر ۱ کارت (دو نفره ۲) انتخاب می‌کند؛ وقتی همه انتخاب کردند، دسته‌ها به چپ می‌روند. ۶ انتخاب (دو نفره ۳ بار دوتایی)؛ ۲ کارت آخر به `discardHidden`. کارت ذخیرهٔ عصر قبل در دست می‌ماند. `pendingSeats` = هر کس هنوز انتخاب نکرده.
2. **اقدام**: خشم هر نفر = مقدار ویژگی خشم. نوبت‌ها طبق §۵.
3. **دور ریختن** (`discard`): هم‌زمان؛ هر کس فقط ۱ کارت نگه می‌دارد (`decide discardKeep`). عصر ۳: همه دور ریخته می‌شود، بی‌تصمیم.
4. **مأموریت‌ها** (`quest`): همهٔ مأموریت‌ها آشکار؛ موفق = `value` افتخار (تخت اودین ×۲) + یک پلهٔ ویژگی به انتخاب (`decide raiseStat`)؛ همه دور ریخته می‌شوند. شرط‌ها: «بیشترین قدرت» یعنی بیشتر از هر قبیلهٔ دیگر (برابری = شکست)؛ مرگ باشکوه = دست‌کم ۴ مهره در والهالا پیش از راگناروک؛ همه‌جا = بیشترین قدرت در دست‌کم ۲ استان.
5. **راگناروک**: استان `ragnarok[age-1]` و آبدره‌هایش نابود؛ همهٔ مهره‌ها به والهالا، هر کدام `RAGNAROK_GLORY[age]` افتخار (الهام اودین ×۲؛ اژدهاهای لوکی/آتش/جاودان برای کشتی +۴/۸/۱۲). نشان نابودی به استان عصر بعد.
6. **آزادی از والهالا**: همه به ذخیره؛ قلمرو/برتری/خشم لوکی +۱/۲/۳ برای هر مهره.
7. **پایان عصر**: نشان‌های غارت برمی‌گردند؛ `first` به چپ؛ عصر بعد. بعد از عصر ۳: امتیاز افسانه‌ای (§۳)، فتح تور (۳ برای هر مهرهٔ روی نقشه)، `outcome`.

**آماده‌سازی**: هر قبیله ۸ جنگجو، ۱ سردار، ۱ کشتی در ذخیره؛ ویژگی‌ها پلهٔ ۰ (خشم ۶، تبر ۳، شاخ ۴)؛ افتخار ۰. ۸ نشان راگناروک بُر: ۳ تا روی مسیر عصرها (`ragnarok`)، به تعداد `DESTROYED_AT_START` از بقیه روی استان‌ها (`destroyed`)، باقی کنار. نشان غارت ایگدراسیل ثابت؛ ۸ نشان دیگر (خشم ×۳، تبر ×۲، شاخ ×۲، افتخار ×۱) تصادفی روی ۸ استان. دسته‌ها: کارت‌های `minPlayers > players` حذف. `first` تصادفی (با rng).

## ۷. نبرد و تصمیم‌های بیرون از نوبت (`pending`)

غارت → `battle.step = 'call'`:
1. **فراخوان** (`decide callToBattle`): به ترتیب `callOrder`، هر نفر یک مهرهٔ غیرکشتی از استان همسایه به روستای خالی می‌آورد یا رد می‌کند (رایگان، حتی با خشم صفر). «رد برای همه» (`passAll`) آن بازیکن را تا پایان همین نبرد رد می‌کند. وقتی روستاها پر شوند یا همه رد کنند تمام. اگر دشمنی در استان و آبدره‌ها نیست: غارت بی‌نبرد (پاداش بدون افتخار نبرد).
2. **کارت** (`decide battleCard`): هم‌زمان؛ هر شرکت‌کننده یک کارت از دست یا هیچ (اگر دستش خالی است). کارت تا همه انتخاب نکرده‌اند پنهان است.
3. **پس از آشکار شدن** (`decide afterReveal`): به ترتیب از غارتگر، کارت‌های `afterReveal` یا رد، تا یک دور کامل رد.
4. **نتیجه**: اثر کارت‌ها به ترتیب §۸؛ بیشترین قدرت برنده؛ برابری = همه بازنده. بازنده‌ها: همهٔ مهره‌های نبرد (و کشتی‌های آبدره) به والهالا، کارت‌ها به دست برمی‌گردد. برنده: کارت‌ها به `discardPublic`، افتخار = تبر. اگر برنده غارتگر است: پاداش غارت و `pillaged = true`.

| `PendingKind` | چه کسی | گزینه‌ها |
| --- | --- | --- |
| `draftPick` | همه | کارت(ها) از دسته |
| `freeInvade` | بازیکن نوبت، پس از ارتقای مهره/هیولا | `{figure, to}` یا رد |
| `extraWarrior` | یاری فریگا پس از یورش | `{to}` در همان استان یا رد |
| `instantPillage` | قلمرو تور پس از یورش | پرداخت ۲ خشم و غارت یا رد |
| `callToBattle` | به ترتیب | `{figure, to}` / `pass` / `passAll` |
| `battleCard` | شرکت‌کننده‌ها | `{card}` یا `null` |
| `afterReveal` | به ترتیب | `{card}` یا رد |
| `keepOneFigure` | موج اودین | شناسهٔ مهرهٔ ماندنی |
| `replayCards` | دیدبان هایمدال | کارت تازه |
| `saveFigure` | پناه فریگا | پرداخت ۱ خشم برای هر مهره یا رد |
| `retreat` | جادوگر وُلور | عقب‌نشینی به ایگدراسیل یا نابودی |
| `keepCards` | دلاوری تیر | کارت‌های آشکار با ۱ خشم هر کدام |
| `moveLeader` | سرور پتک‌ها | استان همسایه یا ماندن |
| `loserInvade` | برکت لوکی | یورش رایگان جنگجو یا رد |
| `raiseStat` | مأموریت موفق، سوگند تور، سرور تبرها، لطف فریگا، فداکاری فریگا | `rage` / `axe` / `horn` |
| `discardKeep` | همه | یک کارت |

`pendingSeats(state)` همیشه از `pending` (یا در فاز اقدام از `turn`) ساخته می‌شود.

## ۸. توانایی کارت‌ها (`ruleId` ← زمان اثر)

| `ruleId` | کارت | زمان |
| --- | --- | --- |
| `steal_rage_on_lose`، `glory_2_on_lose`، `take_cards_on_lose` | نیرنگ / خنجر / زهر لوکی | نتیجه، بازنده |
| `glory_3_on_win`، `stat_on_win`، `rage_glory_on_win` | پتک / سوگند / عروج تور | نتیجه، برنده |
| `copy_highest_card` | نگاه هایمدال | آشکار شدن (ارزش = بالاترین کارت حریف) |
| `kill_warrior_before`، `destroy_before_battle` | ضربه / موج اودین | پیش از مقایسه |
| `stat_on_pillage_other` | لطف فریگا | غارت موفق |
| `after_battle` | چشم / خیرگی هایمدال | گام ۳ |
| `discard_and_glory` | دیدبان هایمدال | آشکار شدن |
| `glory_on_killed` | داوری اودین | نتیجه |
| `cancel_text` | برتری تور | پیش از اثر کارت‌های حریف |
| (بی‌متن) | کارت‌های تیر | فقط قدرت |
| `quest_*` | مأموریت‌ها | فاز مأموریت |
| `warrior_pair_3`، `warrior_2`، `warrior_pair_6` | جنگجو | محاسبهٔ قدرت |
| `ship_killed_4/8/12` | کشتی | هر نابودی کشتی |
| `move_on_pillage`، `stat_on_pillage_leader`، `all_stats_on_pillage_leader` | سردار | غارت موفق با حضور سردار |
| `troll`، `fire_giant` | هیولا | یورش همان هیولا |
| `dwarf_chieftain`، `soldier_hel` | هیولا | هزینهٔ ارتقا و یورش ۰ |
| `sea_serpent` | هیولا | کشتی حساب می‌شود (یورش به آبدره، قدرت ۳) |
| `valkyrie`، `dark_elf`، `volur_witch`، `frost_giant` | هیولا | نبرد / ایگدراسیل / نابودی / غارت |
| `free_invade_on_lose`، `valhalla_release_*`، `upgrade_discount_1`، `battle_quest_3/5`، `glory_on_deaths_2`، `invade_free_warrior`، `double_ragnarok_glory`، `instant_pillage`، `prevent_destroy`، `repillage`، `keep_revealed_cards`، `invade_from_valhalla`، `double_quest`، `destroy_for_stat`، `glory_figs_endgame` | کارت‌های قبیله | طبق متن (`rulesEn`) |

ترتیب اثرهای هم‌زمان: اول کارت‌های «پیش از مقایسه» به ترتیب از غارتگر، بعد مقایسه، بعد اثرهای نتیجه به ترتیب از غارتگر. اثر «ارتقای ویژگی» همیشه `pending raiseStat` می‌سازد.

## ۹. آنچه UI از موتور می‌خواهد

### `legalActions(state, viewer)` → `ActionHint[]`
هر hint همان شکل `Action` است به‌اضافهٔ:
- `cost: { rage: number }` (یورش، لشکرکشی، ارتقا، هماورد)،
- `effects?: { kind: 'destroy' | 'glory' | 'stat'; seat?: Seat; figures?: string[]; amount?: number }[]` (پیش‌نمایش؛ مثلاً ترول در آنگربودا: جنگجوی آرش نابود)،
- `disabled?: true; reason?: ErrorCode` برای دکمه‌هایی که UI خاکستری نشان می‌دهد.

UI با این‌ها دکمه‌های BGA («یک اقدام انتخاب کنید»، «یورش با …») و هدف‌های روی نقشه را می‌سازد؛ هیچ قانونی در رندرر حساب نمی‌شود. نمونه: `data/mock-state.json → mainHints` (لشکرکشی با `figures` پیش‌فرض و `maxFigures`).

### `project(state, viewer)` → View
همه‌چیز به‌جز: `hands` دیگران (فقط تعداد)، `quests` دیگران (فقط تعداد)، `decks`، `draft.packs` دیگران، `battle.played` تا `revealed`، `discardHidden`. تماشاگر هیچ دست/مأموریتی نمی‌بیند.

### `publicSummary(state)` (قرارداد DS، بدون تغییر)
| جایگاه | مقدار |
| --- | --- |
| `primary` | `{ label: 'افتخار', value: glory }` |
| `stats` (≤۴) | `rage` (خشم فعلی)، `cards` (کارت دست)، `map` (`'۴/۵'` مهرهٔ روی نقشه/شاخ)، `quests` (تعداد) |
| `badges` | بازیکن اول، «خشم تمام شد»، «کنار کشید» |
| `status` | `playing` / `passed` / `done` |
| `shared` | `age`، `phase`، `doom` (استان) |
| `detail` (افزوده، مثل برس) | `clan`، `stats` (پله‌ها)، `reserve`، `valhalla`، `upgrades` |

### بقیهٔ GameModule
- `outcome`: پس از عصر ۳. رتبه بر اساس افتخار. **برابری**: دفترچه قانونی ندارد؛ پیشنهاد: رتبهٔ مشترک (تصمیم باز ۳).
- `onTimeout`: در فاز اقدام `pass`؛ در درفت اولین کارت؛ در تصمیم‌ها گزینهٔ پیش‌فرض (رد / بی‌کارت / اولین ویژگی). `timeouts[seat]++`.
- `tutorial`: فعلاً یک سناریوی کوتاه عصر ۱ (یورش، غارت، نبرد) با `seed` ثابت؛ متن آموزشی در طراحی نیست (HANDOFF «طراحی‌نشده»).
- `resign`: بلافاصله پایان، رتبهٔ آخر برای کناره‌گیرنده.

## ۱۰. تست‌های لازم (پیش از رندرر)
- آماده‌سازی برای ۲ تا ۵ نفر: تعداد کارت هر دسته، استان‌های نابود، نشان‌های غارت.
- هر اقدام و هر کد خطای §۵.
- نبرد: برابری، غارت بی‌نبرد، کشتی پشتیبان، موج اودین، چشم هایمدال، برتری تور.
- مأموریت‌ها با کشتی پشتیبان (مثال دفترچه ص ۲۱)، راگناروک با آبدره، آزادی والهالا با کارت‌های لوکی.
- امتیاز پایانی (مثال دفترچه ص ۲۳: +۱۰ خشم، +۲۰ تبر).
- `mock-state.json → main` را بارگذاری و `legalActions` را با `mainHints` مقایسه کنید.

## ۱۱. تصمیم‌های بسته (مالک، ۱۸ آبان ۱۴۰۵)

1. **تعداد بازیکن: ۲ تا ۵.** مثل BGA (`player_numbers` [۲،۳،۴،۵]). در ۵ نفره همهٔ کارت‌ها می‌مانند (کارت‌های `minPlayers = 5` مثل «داوری تیر» و «افتخار گسترده» فقط در ۵ نفره)، و `DESTROYED_AT_START[5] = 0` (الگوی جدول دفترچه ص. ۱۰: ۲ نفره ۳، ۳ نفره ۲، ۴ نفره ۱). `definition.playerCounts = [2, 3, 4, 5]`.
   - نکتهٔ باز: عدد ۰ با یک بازی ۵ نفرهٔ BGA تأیید شود (در کلاینت BGA دیده نمی‌شود).
2. **همسایگی حلقه‌ای (§۳) تأیید شد.** استان‌های بیرونی با شناسهٔ BGA از ۱ تا ۸؛ `adjacent(a, b)` یعنی `|a − b| ∈ {1, 7}`. ایگدراسیل (۰) همسایهٔ همهٔ استان‌هاست: در نبرد ایگدراسیل هر مهرهٔ روی نقشه می‌تواند بپیوندد، و از ایگدراسیل به نبرد هر استانی می‌شود پیوست (همان `startCallToBattle` در BGA).
3. **برابری افتخار: رتبهٔ مشترک.** نه BGA تساوی‌شکن دارد و نه دفترچه. `outcome` به بازیکن‌های هم‌امتیاز رتبهٔ یکسان می‌دهد؛ جدول پایان ستون تساوی‌شکن ندارد.
4. **گزینهٔ میز «حالت درفت»** (به‌جای `firstAgeNoDraft`): `draftMode: 'draft' | 'noDraft'`، پیش‌فرض `'draft'`. مثل گزینهٔ «Draft mode» در BGA، `noDraft` در **هر سه عصر** درفت را حذف می‌کند و به هر نفر ۶ کارت از دستهٔ همان عصر می‌دهد؛ کارت نگه‌داشتهٔ عصر قبل جدا می‌ماند (§۶.۱). در `noDraft`، `draftPick` ساخته نمی‌شود.

### قانون‌های نبرد که با BGA قطعی شد (اصلاح §۷ و §۹)
5. **کارت نبرد اجباری است.** در `decide battleCard` فقط `{card}` پذیرفته می‌شود و `card` می‌تواند **هر کارتی از دست** باشد (کارت ارتقا یا مأموریت = بی‌اثر، برای بلوف). `null` وجود ندارد. بازیکنِ دست خالی در `pending.seats` این مرحله نمی‌آید و فقط با قدرت مهره‌هایش می‌جنگد. `onTimeout`: یک کارت تصادفی از دست با `rng`. (BGA: وضعیت `PlayBattleCard` «${you} must choose a card» بی گزینهٔ رد؛ دفترچه ص. ۱۸.)
6. **تعداد کارت دست عمومی است.** `project` برای هر بازیکن `handCount` را به همه (و به تماشاگر) می‌دهد، حتی وسط نبرد؛ فقط خود کارت‌ها پنهان‌اند. کارتی که برای نبرد انتخاب شده تا `revealed` پنهان می‌ماند. (BGA: شمارندهٔ «Number of cards in hand» در پنل بازیکن.)
7. **«رد تا پایان این نبرد» (`passAll`).** در `decide callToBattle` گزینه‌ها `{figure, to}` / `pass` / `passAll`. `pass` فقط همین نوبت فراخوان را رد می‌کند؛ `passAll` بازیکن را تا پایان **همین نبرد** از فراخوان بیرون می‌برد. `passAll` فقط وقتی در `legalActions` می‌آید که آن بازیکن دست‌کم ۲ مهرهٔ مجاز برای پیوستن داشته باشد. (BGA: «Pass all» با تأیید «Please confirm you will always pass for this battle».)

### هنوز باز (بیرون از این دور)
- یورش رایگان پس از ارتقا: سقف شاخ و روستای خالی همچنان برقرار باشد؟
- هزینهٔ یورش جنگجو با ارتقای «جفت».
- انصراف در بازی ۳ تا ۵ نفره.
- تایم‌اوت در فاز اقدام: پاس کامل یا فقط رد همان نوبت.
