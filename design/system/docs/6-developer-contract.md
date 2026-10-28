# قرارداد داده برای توسعه

داشبورد یکسان، ساعت‌ها و هشدارها به چند تغییر کوچک در قرارداد داده نیاز دارند. شکل داده را دیزاین تعیین می‌کند. پیاده‌سازی با تیم توسعه است.

## ۱. خلاصه‌ی عمومی هر بازی: `publicSummary`

امروز `view` هر بازی شکل مشترک ندارد و پوسته فقط `pendingSeats` را می‌شناسد. یک hook اختیاری به `GameModule` در `packages/game-sdk` اضافه شود. سرور آن را کنار `pendingSeats` در snapshot میز می‌فرستد:

```ts
publicSummary?(state: State): {
  seats: Array<{
    seat: number;
    primary: { label: string; value: number; target?: number };   // «امتیاز» ۷ از ۱۰ ، «کارت» ۵
    stats: Array<{ key: string; label: string; value: number | string; icon?: string; resource?: string; delta?: number }>; // ۰ تا ۴ آمار
    badges?: Array<{ key: string; label: string; tone?: 'neutral'|'success'|'warning'|'danger'|'premium' }>; // «اونو!»، «بلندترین جاده»
    status?: 'playing' | 'done' | 'passed' | 'out' | 'winner';
    handCount?: number;
  }>;
  shared?: Array<{ key: string; label: string; value: number | string; max?: number }>; // منابع تیمی، دسته، دور
  leaderSeat?: number;
  layout?: 'duel' | 'strip' | 'team';   // راهنمای الگو؛ پیش‌فرض از تعداد صندلی
}
```

- `stats` به ترتیب اهمیت است. کارت کوچک فقط `primary` و اولین آیتم را نشان می‌دهد، ریل ۲ تا ۴ آیتم.
- مقدارها عدد خام‌اند. فارسی‌سازی را پوسته انجام می‌دهد.
- شیت جزئیات بازیکن از همین داده به‌علاوه‌ی یک `detail` اختیاری ساخته می‌شود.

## ۲. مدل ساعت

`deadline` تکی امروز به این شکل تبدیل شود:

```ts
clock: {
  model: 'turn' | 'bank' | 'bank-increment' | 'simultaneous';
  turnSeconds?: number;            // برای turn و simultaneous
  incrementSeconds?: number;       // برای bank-increment
  seats: Array<{ seat: number; remainingMs: number; running: boolean; strikes: number; strikesMax?: number }>;
  dueAt?: string;                  // مهلت نوبت جاری
  frozen?: boolean;
  serverNow: string;               // برای تصحیح اختلاف ساعت
}
```

- آستانه‌ها ثابت‌اند و از کد امروز می‌آیند: هشدار در ۵۰٪؛ بحرانی ۱۰ ثانیه‌ی آخر برای میز زنده و ۱ ساعت آخر برای میز نوبتی (`lowSeconds={t.pace === 'live' ? 10 : 3600}` در `apps/web/src/pages/Table.tsx`).
    - **پیشنهاد v1.7:** برای میز زنده `lowSeconds` برابر `Math.min(10, turnSeconds / 3)` شود. دلیلش در «زمان و هشدار» آمده است.
- پوسته حالت را از `remainingMs / total` حساب می‌کند.
- **حالت‌های ساعت در پوسته:** `calm`، `warn`، `critical`، `paused`، **`stale`** و `frozen`.
    - `stale` سمت کلاینت است: وقتی سوکت خود کاربر قطع است، ساعت آخرین مقدار تأییدشده (`remainingMs` در آخرین snapshot با تصحیح `serverNow`) را با حلقه‌ی خط‌چین و `wifi-off` نشان می‌دهد و خودش نمی‌شمارد. سرور ساعت را نگه نمی‌دارد.
    - `frozen` فقط وقتی `frozen: true` (حادثه‌ی سراسری، `platformIncidents`) است.
- شمارنده‌ی `timeouts` که امروز داخل state هر بازی پنهان است، از طریق `strikes` بیرون بیاید (`strikesMax` = `MAX_TIMEOUTS`).

**واقعیت‌های کد که طراحی بر آن‌ها تکیه دارد:**

- `TIME_OPTIONS` (`packages/contracts/src/tables.ts`): زنده ۱۵/۳۰/۶۰/۱۲۰/۳۰۰ ثانیه، نوبتی ۱۲/۲۴/۴۸/۷۲ ساعت.
- ۱۶ بازی با `MAX_TIMEOUTS = 3` بازیکن را بعد از سه تمام شدن زمانِ پشت سر هم حذف می‌کنند یا بازنده می‌کنند و حرکت به‌موقع شمارنده را صفر می‌کند: abalone، amlak، backgammon، catan، gaia-project، go، hive، ludo، quoridor، risk، santorini، snakes-ladders، tak، ticket-to-ride، unmatched، uno. chess، checkers، onitama و othello با `MAX_TIMEOUTS = 1` با اولین تمام شدن زمان می‌بازند.
- تورنمنت: `botTakeover` (`packages/play/src/tournaments.ts`) ربات را جای بازیکنی می‌نشاند که زمانش تمام شده (صفر امتیاز).
- قطع اتصال ساعت را متوقف نمی‌کند. متن‌های `DISCONNECT_FA` و `INCIDENT_FA` در `packages/play/src/views.ts` (عین متن در «زمان و هشدار»).

## ۳. هشدار و اعلان

- **رویدادهای تازه برای میز زنده:** `turn.started`، `turn.warning` (۵۰٪)، `turn.critical` و `turn.autoMoved`. همه فقط داخل اپ، با صدا و لرزش، بر اساس ترجیح کاربر.
- **یادآوری‌های میز نوبتی:**
    - امروز (`runtime.ts`): یک یادآوری وقتی ۲۵٪ نوبت مانده، حداکثر ۶ ساعت قبل از موعد (`min(turnSeconds / 4, 6h)`)، فقط اگر `reminders` میز روشن باشد.
    - **پیشنهاد، کار تازه‌ی سرور:** دو یادآوری اضافه در ۵۰٪ و «۱ ساعت مانده».
    - کانال: وب‌پوش (service worker و Push API) به‌علاوه‌ی اعلان داخل اپ.
    - بدون پیامک.
    - ساعت سکوت کاربر رعایت می‌شود، به‌جز «۱ ساعت مانده».
- **ترجیحات** از دستگاه به حساب منتقل شوند: صدا، بلندی، لرزش، ساعت سکوت. تم و حرکت روی دستگاه می‌مانند.
- **صفحه‌ی مرکز اعلان** و شمارنده‌ی زنگوله.

## ۴. گفت‌وگو

- **قابلیت‌های جدید:** واکنش (جدول `message_reactions`)، منشن (پارس `@` و ساخت اعلان)، پیام سیستمی رویداد بازی، بی‌صدا کردن میز برای هر کاربر.
- **تماشاگر:** خواندن چت میز برای تماشاگر باز شود. نوشتن بسته بماند.
- `seen` برای چت میز اختیاری است. طرح آن را نشان می‌دهد.

## ۵. پروفایل و کازمتیک

- **آیتم‌های تازه:** `cardBack`، `boardSkin`، `emote`، `chatBubble`، `seatRing`. همه به لیست افزایشی `cosmetics.ts` اضافه می‌شوند، با پرچم اختیاری `premium`.
- **پروفایل عمومی:** آمار، لیگ، بازی‌های اخیر و تسلط هم برگردانده شوند.
- **`publicProfile` سر میز:** شامل `titleKey`، `frameKey`، `league` و کازمتیک‌های میز باشد.

## ۶. پوسته، میز و رابط واقعی بازی

- **پوسته:** همه‌ی صفحه‌های بیرون از میز `AppShell` هستند: `header.bgv-siteheader` (۹۰۰ به بالا) + `main.bgv-app__main` (نوار بالا و داک زیر ۹۰۰) + `footer.bgv-sitefooter` فقط در صفحه‌های عمومی. سایدبار وجود ندارد. کروم ناوبری از توکن `--surface-chrome` رنگ می‌گیرد: سفید #FFFFFF در روشن، #12222D روی صفحه‌ی #0D1A23 در تیره. کارت‌ها `--surface` هستند (سفید / #192E3C) و با `--line` جدا می‌شوند.
- **میز:** رندرر هر بازی **بدون تغییر** داخل `.bgv-felt__stage` سوار می‌شود. استیج نسبت ابعاد رندرر را با `--ar` نگه می‌دارد و letterbox می‌کند. پوسته فقط نوار بازی، داشبورد، قرص نوبت، پلاک‌ها، اکشن‌داک و گفت‌وگو را می‌کشد.
- **پنل‌های بازیکن خود رندررها** (نام، امتیاز، «نوبت …») مخفی می‌شوند و داشبورد از `publicSummary` ساخته می‌شود. کنترل‌های مخصوص بازی (دست، انتخاب کارت، صفحه) در رندرر می‌مانند. کنش‌های مشترک (تاس، پایان نوبت، ساختن) به اکشن‌داک می‌آیند.
- **چیدمان دسکتاپ:** ریل در شروع خواندن (راست)، میز و اکشن‌داک در وسط، گفت‌وگو در انتها (چپ). زیر ۱۲۰۰ گفت‌وگو شیت کناری می‌شود، زیر ۹۰۰ چیدمان گوشی. ارتفاع میز دسکتاپ `min(900px, 100dvh)` است.

## ۷. صفحه‌ها و مسیرها

- **مسیرهای تازه:** مرکز اعلان (`/notifications`)، میزهای من و تاریخچه (`/tables/mine`)، فروشگاه کازمتیک (`/shop`)، کمد (`/me/wardrobe`).
- **استودیو پروفایل** (`/me/studio`) جای `/me/profile` و `/me/avatar` را می‌گیرد.
- **ریمچ واقعی:** `POST /tables/:id/rematch` با رأی و مهلت ۳۰ ثانیه.
- `/design` و `/dev-gateway` پشت نقش ادمین یا متغیر محیطی بروند.

## ۸. مهاجرت استایل

1. `tokens.css` این سیستم جای `packages/ui/src/theme.css` را بگیرد. نام‌های قدیمی (`--bg`، `--surface`، `--primary`) همان نقش‌ها را دارند.
2. `bundle.css` جای `styles.css` و کلاس‌های BEM قدیمی را بگیرد. کامپوننت‌های `components.tsx` و ۴۵ فایل VibeFarsi بلااستفاده حذف شوند.
3. رنگ‌های هاردکد صندلی و ماهوت در بازی‌ها (۳٬۵۵۳ رنگ هاردکد در کل) به `--seat-*` و `--felt-*` وصل شوند؛ هنر، صفحه و چیدمان خود بازی دست نمی‌خورد (بخش ۶). پنل‌های بازیکن و خط «نوبت …» داخل رندررها وقتی داخل پوسته‌ی میز اجرا می‌شوند پنهان شوند (نه بازطراحی) و داده‌شان از `publicSummary` بیاید.
4. `contrast.mjs` تعمیر شود (سلکتور تم تیره) و در CI اجرا شود.
5. فونت‌ها از `fonts/` همین سیستم میزبانی شوند (وزیرمتن و منروپ متغیر، OFL). `@import` گوگل در v1.7 حذف شده است.
6. دکمه‌ها فقط با variant و متغیرهای ظرف رنگ می‌گیرند. هیچ override محلی با `!important` روی `.bgv-btn` نوشته نشود.

## ۹. کلاس‌ها و ویژگی‌های تازه (v2.1)

| کلاس / ویژگی | برای |
| --- | --- |
| `.bgv-siteheader`، `__in`، `__actions`، `__quick`، `__guest`؛ `.bgv-sitenav` | هدر سایت؛ مقصد فعلی `a[aria-current="page"]`، آیکون صفحه‌ی فعلی `[aria-current]` |
| `.bgv-avatarbtn` (`aria-haspopup="menu"`، `aria-expanded`، `aria-current`) | دکمه‌ی آواتار هدر |
| `.bgv-sitesearch`، `__field`، `__pop`، `__row` (`role="option"`، `aria-selected`)، `__label`، `__chips`، `__hint`، `__empty`، `__foot`؛ `.bgv-sitesearch--sheet` | جست‌وجو؛ فیلد `role="combobox"` با `aria-expanded`، `aria-controls`، `aria-activedescendant` |
| `.bgv-menu--account`، `.bgv-menu__id`، `.bgv-menu__wallet`، `.bgv-menu__tag` | منوی حساب |
| `.bgv-sitefooter`، `__in`، `__cols`، `__col` (`.is-open`)، `__about`، `__store`، `__bottom`، `__seal`، `__social` | فوتر؛ گوشی: `h3 > button[aria-expanded]` |
| `.bgv-steps` (`li.is-done`، `li.is-cur[aria-current="step"]`، `li.bgv-steps__bar`) | مرحله‌نمای ورود |
| `.bgv-loginsheet`، `__body`، `__head`، `__legal`، `--overlay`، `__scrim` | برگه‌ی ورود درون‌صفحه |
| `.bgv-moregroup`، `__title`، `__grid`؛ `.bgv-moretile`، `__icon`، `__label` | صفحه‌ی «بیشتر» |
| `.bgv-state--guest`، `.bgv-state__perks`، `.bgv-state__actions` | حالت «ابتدا وارد حساب خود شوید» |
| `.bgv-table--stack` با `td[data-stack="lead"\|"main"\|"end"\|"hide"]` و `td[data-label]` | جدول جمع‌شونده زیر ۶۰۰ |
| `.bgv-gamebar__mi` (`.is-first`) | آیتم‌های کامل اطلاعات نوار بازی |
| `.bgv-critbar__row`، `__text`، `__t`، `__s` | نوار بحرانی داخل اکشن‌داک |
| `.bgv-app--mid`، `.bgv-siteheader--mid`/`--wide`، `.bgv-sitefooter--phone`/`--wide`، `.bgv-table--phone` | اجبار یک عرض برای پیش‌نمایش و ماکاپ |

**حذف‌شده:** `.bgv-sidebar*`، `.bgv-nav-item*`، `.bgv-app--icons`، `--sidebar-w`، و `.bgv-steps` قدیمی (نقطه و خط). `.bgv-app--site` به‌عنوان نام مستعار `.bgv-app` می‌ماند.

**توکن‌های تازه:** `--header-h` (۷۲)، `--topbar-h` (۵۶)، `--content-max` (۱۳۲۰)، `--avatar-disc`، `--row-you`، `--bubble-mine`، `--bubble-mine-edge`. `--bp-md` (۹۰۰) مرز هدر و داک است؛ `--bp-lg` (۱۲۰۰) مرز جست‌وجوی کامل و جمع‌شده.
