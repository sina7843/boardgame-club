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

- **پوسته:** همه‌ی صفحه‌های بیرون از میز `AppShell` هستند (همان `brief/SHELL.html`). کروم ناوبری از توکن `--surface-chrome` رنگ می‌گیرد: در روشن همان `--surface`، در تیره زغالی #252826 روی صفحه‌ی #191B1A. کارت‌ها `--surface` (سبز تیره) می‌مانند.
- **میز:** رندرر هر بازی **بدون تغییر** داخل `.bgv-felt__stage` سوار می‌شود. استیج نسبت ابعاد رندرر را با `--ar` نگه می‌دارد و letterbox می‌کند. پوسته فقط نوار بازی، داشبورد، قرص نوبت، پلاک‌ها، اکشن‌داک و گفت‌وگو را می‌کشد.
- **پنل‌های بازیکن خود رندررها** (نام، امتیاز، «نوبت …») مخفی می‌شوند و داشبورد از `publicSummary` ساخته می‌شود. کنترل‌های مخصوص بازی (دست، انتخاب کارت، صفحه) در رندرر می‌مانند. کنش‌های مشترک (تاس، پایان نوبت، ساختن) به اکشن‌داک می‌آیند.
- **چیدمان دسکتاپ:** ریل در شروع خواندن (راست)، میز و اکشن‌داک در وسط، گفت‌وگو در انتها (چپ). زیر ۱۲۰۰ گفت‌وگو شیت کناری می‌شود، زیر ۹۰۰ چیدمان گوشی.

## ۷. صفحه‌ها و مسیرها

- **مسیرهای تازه:** مرکز اعلان (`/notifications`)، میزهای من و تاریخچه (`/tables/mine`)، فروشگاه ظاهر (`/shop`)، کمد (`/me/wardrobe`).
- **استودیو پروفایل** (`/me/studio`) جای `/me/profile` و `/me/avatar` را می‌گیرد.
- **ریمچ واقعی:** `POST /tables/:id/rematch` با رأی و مهلت ۳۰ ثانیه.
- `/design` و `/dev-gateway` پشت نقش ادمین یا متغیر محیطی بروند.

## ۸. مهاجرت استایل

1. `tokens.css` این سیستم جای `packages/ui/src/theme.css` را بگیرد. نام‌های قدیمی (`--bg`، `--surface`، `--primary`) همان نقش‌ها را دارند.
2. `bundle.css` جای `styles.css` و کلاس‌های BEM قدیمی را بگیرد. کامپوننت‌های `components.tsx` و ۴۵ فایل VibeFarsi بلااستفاده حذف شوند.
3. رنگ‌های هاردکد صندلی و ماهوت در بازی‌ها (۳٬۵۵۳ رنگ هاردکد در کل) به `--seat-*` و `--felt-*` وصل شوند؛ هنر، صفحه و چیدمان خود بازی دست نمی‌خورد (بخش ۶). پنل‌های بازیکن و خط «نوبت …» داخل رندررها وقتی داخل پوسته‌ی میز اجرا می‌شوند پنهان شوند (نه بازطراحی) و داده‌شان از `publicSummary` بیاید.
4. `contrast.mjs` تعمیر شود (سلکتور تم تیره) و در CI اجرا شود.
