# مهاجرت از v1.6 به v2.1 (۷ آبان ۱۴۰۵ · 2026-10-28)

این فایل فقط تفاوت‌ها را می‌گوید. قانون‌های کامل در `design/CLAUDE.design-system.md` است و دلیل هر تصمیم در `design/system/docs/0-brand-and-principles.md` (بخش‌های «تغییرات v1.7» تا «تغییرات v2.1.13»).

> **ریپو امروز v1.3 را commit کرده است.** اگر v1.4 و v1.6 را هنوز نصب نکرده‌اید، لازم نیست قدم‌به‌قدم بروید: کل `design/`، `scripts/`، `e2e/`، `.claude/` و `apps/web/public/` همین بسته را جایگزین کنید و `node design/install.mjs` را دوباره اجرا کنید. `CHANGELOG-v1.4.md` و `CHANGELOG-v1.6.md` فقط برای تاریخچه مانده‌اند.

منبع: دیزاین سیستم زنده v2.1.13 (`3DPEkKeSg5PfZjphyRMMCu`، نسخهٔ `1793112049-9637`) و بوم صفحه‌ها (`61m4wUqVQ373pFLzuqsier`، نسخهٔ `1793197822-aab1`). لینک‌ها در `LINKS.md`.

## ۱. چه چیزی عوض شد، در یک نگاه

| موضوع | v1.6 | v2.1 |
|---|---|---|
| زبان طراحی | کلی‌مورفیسم: «بالشتک» با لب نرم و سایهٔ محو | **«توکن چاپی»**: هر چیز فشردنی ژتون بازی است با قاب جوهری و سایهٔ سخت (بدون blur). فقط چیزهای فشردنی برجسته‌اند. |
| پوستهٔ دسکتاپ | سایدبار کامل (≥۱۲۰۰) و سایدبار آیکونی ۸۸px (۹۰۰ تا ۱۱۹۹) | **هدر سایت** (`SiteHeader`، ۷۲px، چسبان) با پنج مقصد، جست‌وجو، «بازی سریع»، پیام، اعلان و آواتار. سایدبار حذف شد. |
| سکه در دسکتاپ | کارت هویت سایدبار | داخل **منوی حساب** (`AccountMenu`) |
| ستون محتوا | `--content-max` 1200 | **1320**، مشترک بین هدر، صفحه و فوتر |
| جست‌وجو | کانسپت | کامپوننت `SiteSearch` (پاپ‌اور دسکتاپ، برگهٔ تمام‌صفحهٔ گوشی، Ctrl K و `/`) |
| فوتر | کانسپت | کامپوننت `SiteFooter`، فقط صفحه‌های عمومی |
| مهمان | — | «ورود / ثبت‌نام» ثانویه در هدر، `StateBlock kind="guest"`، `LoginSheet` سر میز (صندلی ۲ دقیقه نگه داشته می‌شود)، ورود سه‌مرحله‌ای با `Stepper` |
| آیتم فعال داک | کاشی کهربایی با آیکون پر | **ژتون کهربایی با آیکون معمولی** (`bgv-dock--float`) |
| دکمهٔ خنثی | بالشتک سفید با لبهٔ ۱٫۵px #7D8B96 | ژتون سفید، قاب ۱٫۵px و سایهٔ سخت با **جوهر نرم** `--ink-btn` (#A1AAB1 روشن، #4A6476 تیره) |
| دکمهٔ اصلی | کهربایی با لب #A86E1C | کهربایی با قاب و سایهٔ **کهربایی سوخته** `--ink-btn-primary` #B57A25 |
| «رد» | `leave` در بعضی صفحه‌ها | همیشه `secondary` |
| نشان «پریمیوم» و تاج | برای نقش و برد هم استفاده می‌شد | فقط پریمیوم (v2.1.3). نقش = خنثی + `shield`، برد = `success` + `trophy`، استادی = `info` + `star` |
| نام‌ها | «حریف‌یابی» | «بازی سریع»، «اشتراک پریمیوم»، «فروشگاه کازمتیک»، «ورود / ثبت‌نام» |
| فونت | از Google Fonts | فایل‌های خود سیستم: `design/system/fonts/` (Vazirmatn و Manrope، متغیر، OFL) |

## ۲. کامپوننت‌ها (۹۵ ← ۱۰۰)

**تازه (۷):** `SiteHeader` · `SiteSearch` · `AccountMenu` · `SiteFooter` · `MoreTile` (و `MoreGroup`) · `LoginSheet` · `Stepper`.
راهنمای هرکدام: `design/system/components/<Name>/README.md`، تصویرش: `design/reference/components/<Name>_{light,dark}.png`.

**حذف‌شده (۲):** `Sidebar` و `NavItem`. پورتشان نکنید. اگر قبلاً پورت شده‌اند، در فاز ۶ پاک کنید.

**تغییر رفتار مهم:**
- `Button`: `variant="outline"` منسوخ است و مثل `secondary` رندر می‌شود. ظاهر `secondary` حالا ظاهر پیش‌فرض خود `.bgv-btn` است: کلاس `bgv-btn--secondary` هنوز روی دکمه می‌نشیند (bundle.js و HTML مرجع آن را دارند)، ولی دیگر قاعدهٔ CSS جدا ندارد. `pressed` (toggle روشن) همان ژتون با پرکنندهٔ سرمه‌ای است.
- `AppShell`: prop‌های تازهٔ `nav`، `search`، `quickPlay` (`false` در خانه)، `guest`، `messages`، `notifications`، `footer`، `layout` (`auto | full | mid | phone`). `.bgv-app--site` فقط نام مستعار برای markup نسخهٔ v1.8 است.
- `Dock`: شناور (`bgv-dock--float`) و برای مهمان هم چهار آیتم بدون شمارنده؛ `bgv-dock--keep` آیتم را فعال نگه می‌دارد (بازی‌ها و صفحهٔ بازی ← «خانه»).
- `StateBlock`: حالت `kind="guest"` با `bgv-state__actions` و فهرست `bgv-state__perks`.
- `Badge`: `tone="premium"` فقط برای پریمیوم؛ `bgv-badge--equipped` برای «پوشیده».
- `CritBar`: ساختار دوخطی (`bgv-critbar__row`, `__t`, `__s`, `__text`) داخل اکشن‌داک، جای راهنمای نوبت.
- `GameBar`: آیتم‌های مشخصات `bgv-gamebar__mi` (روی گوشی وسط کلمه بریده نمی‌شوند).
- `DataTable`: `bgv-table--stack` و `bgv-table--phone` برای ۳۹۰.

## ۳. کلاس‌های `bgv-*` در `bundle.css` (۴۱۴ ← ۴۷۵)

شمارش با مقایسهٔ مستقیم دو `bundle.css` (بدون کامنت): **۷۲ کلاس تازه، ۱۱ کلاس حذف‌شده.** (اگر جایی عدد ۷۳ دیدید، اختلافش از روش شمارش است. این فهرست از فایل‌ها ساخته شده است.)

### حذف‌شده (۱۱) و جایگزین

| کلاس v1.6 | جایگزین v2.1 |
|---|---|
| `bgv-sidebar`، `bgv-sidebar__brand`، `bgv-sidebar__group`، `bgv-sidebar__text`، `bgv-sidebar__foot` | `SiteHeader` (`bgv-siteheader`، `bgv-sitenav`) + `AccountMenu` (`bgv-menu--account`) |
| `bgv-nav-item`، `bgv-nav-item__label`، `bgv-nav-item__badge` | پیوندهای `bgv-sitenav` در هدر؛ آیتم‌های `bgv-dock__item` در گوشی؛ آیتم‌های منوی حساب |
| `bgv-app--icons` (سایدبار آیکونی ۹۰۰ تا ۱۱۹۹) | `bgv-app--mid` + `bgv-siteheader--mid` (جست‌وجو دکمهٔ گرد ۴۴) |
| `bgv-btn--outline` | `secondary` (ظاهر پیش‌فرض `.bgv-btn`) |
| `bgv-btn--secondary` | قاعدهٔ CSS ندارد، چون همان ظاهر پیش‌فرض است. کلاس بی‌ضرر است و می‌تواند بماند. |

`scripts/ds-check.mjs` قانون تازهٔ **DS016** دارد که `bgv-sidebar*`، `bgv-nav-item*`، `bgv-app--icons` و `bgv-btn--outline` را خطا می‌گیرد (فهرست در `design/ds.config.json` → `retiredClasses`).

### تازه (۷۲)

| گروه | کلاس‌ها |
|---|---|
| هدر سایت (۹) | `bgv-siteheader` `bgv-siteheader--wide` `bgv-siteheader--mid` `bgv-siteheader__in` `bgv-siteheader__actions` `bgv-siteheader__guest` `bgv-sitenav` `bgv-avatarbtn` `bgv-kbd` |
| جست‌وجو (۱۶) | `bgv-sitesearch` `bgv-sitesearch--sheet` `bgv-sitesearch__field` `bgv-sitesearch__clear` `bgv-sitesearch__pop` `bgv-sitesearch__top` `bgv-sitesearch__label` `bgv-sitesearch__chips` `bgv-sitesearch__list` `bgv-sitesearch__row` `bgv-sitesearch__main` `bgv-sitesearch__name` `bgv-sitesearch__meta` `bgv-sitesearch__hint` `bgv-sitesearch__empty` `bgv-sitesearch__foot` |
| فوتر (۱۱) | `bgv-sitefooter` `bgv-sitefooter--wide` `bgv-sitefooter--phone` `bgv-sitefooter__in` `bgv-sitefooter__about` `bgv-sitefooter__cols` `bgv-sitefooter__col` `bgv-sitefooter__bottom` `bgv-sitefooter__seal` `bgv-sitefooter__social` `bgv-sitefooter__store` |
| منوی حساب (۵) | `bgv-menu--account` `bgv-menu__id` `bgv-menu__wallet` `bgv-menu__list` `bgv-menu__tag` |
| ورود درون‌صفحه (۶) | `bgv-loginsheet` `bgv-loginsheet--overlay` `bgv-loginsheet__scrim` `bgv-loginsheet__head` `bgv-loginsheet__body` `bgv-loginsheet__legal` |
| «بیشتر» (۶) | `bgv-moregroup` `bgv-moregroup__title` `bgv-moregroup__grid` `bgv-moretile` `bgv-moretile__icon` `bgv-moretile__label` |
| پوسته و داک (۴) | `bgv-app--mid` `bgv-dock--float` `bgv-dock--keep` `bgv-logo--mark` |
| حالت مهمان و مراحل (۵) | `bgv-state--guest` `bgv-state__actions` `bgv-state__perks` `bgv-steps--start` `bgv-steps__bar` |
| میز و زمان (۵) | `bgv-critbar__row` `bgv-critbar__t` `bgv-critbar__s` `bgv-critbar__text` `bgv-gamebar__mi` |
| بقیه (۵) | `bgv-badge--equipped` `bgv-trophy--gold` `bgv-conv__time` `bgv-table--stack` `bgv-table--phone` |

فهرست ماشینی همین دو جدول: `design/reference/class-diff-v1.6-v2.1.json`.

## ۴. توکن‌ها

- **۵۷ توکن تازه**، از جمله جوهرها (`--ink`، `--ink-btn`، `--ink-btn-primary`، `--ink-leave`، `--ink-danger`، `--ink-felt`، `--ink-selected`، `--ink-disabled`، `--btn-frame`)، انتخاب (`--selected`، `--on-selected`)، خروج (`--leave`، `--on-leave`، `--leave-hover`، `--leave-edge`)، چاه و چاپ (`--well`، `--well-edge`، `--field-edge`، `--print-edge`، `--control-edge`)، دکمه‌های روی میز (`--felt-btn-*`، `--felt-control*`)، سایه‌های ژتون (`--shadow-tile-sm/-lg/-neutral/-selected/-selected-sm/-leave/-danger/-felt/-disabled`، `--shadow-row-press`، `--shadow-plate`، `--shadow-press-primary/-leave`)، چت (`--bubble-mine`، `--bubble-mine-edge`)، `--row-you`، `--avatar-disc` و اندازه‌های پوسته (`--header-h` ۷۲، `--topbar-h` ۵۶).
- **حذف‌شده:** `--sidebar-w`.
- **مقدار عوض‌شده:** `--content-max` 1200 ← 1320؛ همهٔ سایه‌ها (`--shadow-tile`، `--shadow-card`، `--shadow-float`، `--shadow-felt`، `--shadow-field`، `--shadow-press`، `--shadow-piece`، `--shadow-tile-primary`) از سایهٔ محو به **سایهٔ سخت** رفتند؛ `--felt-plate` مات شد (#172C3A / #14283A)؛ `--felt-line` #7E97A5؛ `--label` تیره کرم #E3D3B8 (نه کهربایی).
- اگر جایی سایهٔ خودتان را با مقدار قدیمی نوشته‌اید، DS004 آن را می‌گیرد. فقط از توکن استفاده کنید.

## ۵. صفحه‌ها (`design/reference/screens.json`، ۱۲۴ ← ۱۲۲)

- **تازه (۷):** `Profile-Own-Desktop`، `QuickMatch-Desktop`، `Home-Member-Dark`، `Home-Member-Phone-Dark`، `Messages-Guest-Mobile`، `Table-Lobby-Guest-Mobile`، `Flow-Simplify` (spec). در `screens.json` با `"new": "2.1"` علامت خورده‌اند.
- **حذف‌شده (۹) و جایگزین:**
    - `Home-Desktop`، `Home-Phone`، `Home-Phone-Dark` ← خانهٔ جدید: `Home-Member`، `Home-Member-Dark`، `Home-Member-Phone`، `Home-Member-Phone-Dark`، `Home-Guest`، `Home-Guest-Phone`.
    - `Catalog-Expanded` ← `Catalog-Desktop` (کارت بازی بازشونده) + `GameCard-Spec`.
    - `Catalog-Phone`، `CreateTable-Phone`، `MyTables-Phone`، `Notifications-Phone`، `Alert-Settings-Mobile` ← طبق قاعدهٔ طراحی گوشی v2.1، این صفحه‌ها همان صفحهٔ دسکتاپ در ۳۹۰ هستند: مرجعشان `…-Desktop@390.png` است.
- **جابه‌جا:** `Home-Member`، `Home-Member-Phone`، `Home-Guest`، `Home-Guest-Phone` از `concept/` به `play/` رفتند (دیگر کانسپت نیستند، صفحهٔ واقعی‌اند).
- **پروژه گایا:** صفحهٔ «۱۲. پایلوت BGA» بوم (`gaia/*`) در این بسته نیست و جدا در `Games Handoff/dist/BGV-Gaia-Handoff-v1.4.zip` آمده است (← `design/games/gaia-project/`). سه صفحهٔ قدیمی `table/Hud-Gaia-Desktop`، `Hud-Gaia-Mobile` و `Hud-Gaia-PlayerSheet-Mobile` هنوز رندر شده‌اند، ولی `"capture": "manual"` و `"supersededBy": "design/games/gaia-project"` دارند. `/bgv-qa` آن‌ها را `superseded` گزارش می‌کند و جزو دروازهٔ QA نیستند.
- **فیلدهای تازهٔ `screens.json`:** `supersededBy`، `note`، `new`، `canvasPage` (صفحهٔ بوم)، و در ریشه `source`، `excluded` و `removedSince1.6`.
- همهٔ تصویرهای مرجع از نو رندر شده‌اند (۲۲۰ تصویر: هر صفحهٔ واکنش‌گرا در ۱۴۴۰، ۱۰۰۰ و ۳۹۰) و تصویر همهٔ ۱۰۰ کامپوننت در دو تم.

## ۶. ابزارها

- `scripts/ds-check.mjs`: قانون DS016 (کلاس‌های بازنشسته). بقیه همان است.
- `e2e/design-qa.spec.ts`: صفحه‌های `supersededBy` را رد می‌کند (`superseded`) و وجود `.bgv-siteheader` را هم ثبت می‌کند.
- `scripts/ds-qa-report.mjs`: صفحهٔ دسکتاپ (≥۹۰۰) بدون `.bgv-siteheader` و هر صفحه‌ای که هنوز `.bgv-sidebar` دارد FAIL می‌گیرد؛ صفحه‌های superseded «N/A» هستند.
- `.claude/`: اسکیل، `/bgv-implement`، `/bgv-qa` و ایجنت QA با قانون‌های v2.1 به‌روز شده‌اند.

## ۷. ترتیب کار برای تیمی که v1.6 را شروع کرده

1. فایل‌های بسته را جایگزین کنید و `node design/install.mjs` را اجرا کنید (بدهی تازه با DS016 در baseline ثبت می‌شود).
2. `design/system/tokens.css`، `fonts/` و `components/bundle.css` را دوباره در `packages/ui/src/bgv/` کپی کنید (بدون تغییر).
3. `/bgv-implement phase-1`: هفت کامپوننت تازه را پورت کنید و `Sidebar`/`NavItem` را کنار بگذارید.
4. `/bgv-implement phase-2`: پوستهٔ سایت (هدر، جست‌وجو، منوی حساب، داک شناور، «بیشتر»، الگوی مهمان، فوتر).
5. `/bgv-implement phase-2b`: خانهٔ جدید و کارت بازی. بعد بقیهٔ فازها مثل قبل.
6. پایان: `node scripts/ds-check.mjs --strict` (صفر خطا، از جمله DS016) و `/bgv-qa`.
