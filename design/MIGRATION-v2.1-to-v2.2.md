# مهاجرت از v2.1 به v2.2 (۸ آبان ۱۴۰۵ · 2026-10-30)

منبع: دیزاین سیستم زنده v2.2 (`3DPEkKeSg5PfZjphyRMMCu`، نسخه‌ی `1793364705-4605`) و بوم صفحه‌ها (`61m4wUqVQ373pFLzuqsier`، نسخه‌ی `1793364682-ef83`). فقط تفاوت‌ها اینجاست؛ v1.6 ← v2.1 در `MIGRATION-v1.6-to-v2.1.md`.

## ۱. درخواست شما: `home-ref.css` بدون استثنا

`scripts/home-ref-css.py` شما CSS خانه را از `<style>` فایل‌های `design/reference/html/play/Home-Guest.html` و `Home-Member.html` می‌سازد و `ds-check` روی آن ۹۱ خطا می‌داد. در v2.2 هر شش فایل خانه (`Home-Guest`، `Home-Guest-Phone`، `Home-Member`، `Home-Member-Dark`، `Home-Member-Phone`، `Home-Member-Phone-Dark`) فقط توکن دارند.

1. `repo/` این بسته را جایگزین کنید (دست‌کم `design/system/` و `design/reference/`) و `design/system/tokens.css` و `design/system/components/bundle.css` را دوباره در `packages/ui/src/bgv/` کپی کنید.
2. `python scripts/home-ref-css.py`
3. خط `apps/web/src/styles/home-ref.css` را از `exclude` در `design/ds.config.json` بردارید.
4. `node scripts/ds-check.mjs --strict` — روی بخش محتوای خانه صفر خطا. هدر و فوتر داخل این دو صفحه کپی `SiteHeader` و `SiteFooter` هستند و رنگ‌های ثابت همان کامپوننت‌ها را دارند (bundle.css هم آن‌ها را دارد)؛ اسکریپت شما آن بخش را برنمی‌دارد و اپ هدر و فوتر را از خود کامپوننت‌ها می‌گیرد.
5. مقایسه‌ی تصویری ۱۴۴۰ و ۳۹۰ در روشن و تیره با `reference/img/play/Home-*.png` (تازه رندر شده).

6. **نام بازی:** «ترافورمینگ مارس» (نه «تررافورمینگ»). در `Home-Member-Phone` و `Home-Member-Phone-Dark` اصلاح شد. در کد `nameFa` در `games/terraforming-mars/src/definition.ts` و متن مورد انتظار در تست e2e ترافورمینگ (`terraforming-mars.spec.ts` در پوشه‌ی e2e ریپو) را اصلاح کنید؛ صفحه‌ی بازی‌های سایت نام را از کد می‌خواند.

## ۲. توکن‌های تازه (`design/system/tokens.css` و `tokens.json`)

| توکن | روشن | تیره | کجا |
|---|---|---|---|
| `--shadow-ring` | `inset 0 0 0 1px var(--line)` | همان | قاب مویی تصویر کوچک، خانه‌ی کوچک، ردیف «شما» |
| `--shadow-ring-felt` | `inset 0 0 0 1px var(--felt-line)` | همان | پلاک و چیپ روی ماهوت/هیرو (جای کرم ۱۶–۱۸٪) |
| `--shadow-ring-strong` | `inset 0 0 0 2px var(--heading)` | همان (کرم) | کارت بازشده، «شما»، چهره‌ی خالی شما |
| `--shadow-gap` / `--shadow-gap-felt` | `0 0 0 2px var(--surface)` / `var(--felt)` | همان | فاصله‌ی آواتارهای روی هم |
| `--shadow-halo-danger` / `--shadow-halo-success` | `0 0 0 3px var(--danger-soft)` / `var(--success-soft)` | همان | هاله‌ی نقطه‌ی زنده/آنلاین |
| `--shadow-box-sm` | لبه‌ی مهره + `0 16px 20px -12px #172C3A` | کف `rgba(5,12,17,.55)` | جعبه‌ی بازی روی ماهوت در گوشی |
| `--shadow-box-md` | لبه‌ی مهره + `0 26px 30px -16px #172C3A` | همان، کف سبک | بادبزن هیرو، جعبه‌ی بازی سریع |
| `--shadow-box-lg` | لبه‌ی مهره + `0 30px 34px -14px #172C3A` | همان، کف سبک | جعبه‌ی جلویی و جعبه‌ی بزرگ بازی سریع |
| `--shadow-housebox` / `-sm` | عطف + کف `rgba(20,43,59,.35)` | کف `rgba(0,0,0,.4)` | جعبه‌ی جایگزین بازی بی‌تصویر |
| `--radius-box` | `6px` | — | جعبه‌ها و تصویر جعبه |

`--shadow-box-*` تنها سایه‌های محو سیستم‌اند (استثنای مالک، فقط برای تصویر جعبه).

## ۳. قواعدی که در فایل‌های خانه اعمال شد

- z-index: ۱ = `var(--z-felt)`؛ لایه‌ی محلی داخل یک کارت `calc(var(--z-felt) + 1)`؛ بادبزن جعبه‌ها `calc(var(--z-felt) - 1 + var(--z,2))` (همان ترتیب قبلی)؛ چیپ‌های روی هیرو `var(--z-hud)`؛ `-1` فقط برای سایه‌ی کف زیر جعبه. توکن z تازه نداریم.
- تصویر قفسه بدون `left:50%`: `inset-inline:0; margin-inline:auto` و `translateY(-50%)`.
- رنگ‌های جعبه‌ی جایگزین `--brand-cream`؛ قاب داخلی و سایه‌ی کاورهای قفسه `color-mix(in srgb,var(--token) N%,transparent)` (همان پیکسل).
- حلقه‌ی رنگی چهره‌های رده‌بندی `outline` شد (`outline-offset` به اندازه‌ی فاصله) با `--shadow-gap`.
- ساده‌سازی (تأیید مالک): درخشش زیر فیلد جست‌وجوی بزرگ، لب کهربایی قرص «نوبت شما»، لبه‌ی داخلی نقطه‌ی رشته و سایه‌ی نوار بالای گوشی حذف شد؛ شماره‌ی مراحل `--shadow-piece`؛ قاب کارت بازشده‌ی خانه‌ی عضو از ۲٫۵ به ۲px.

## ۴. Chip اندازه‌ی `lg` (v2.1.14)

`<Chip size="lg" icon count selected>` ← `bgv-chip bgv-chip--lg` با `bgv-chip__ic` (دایره‌ی ۳۶px) و `bgv-chip__count`. ۵۲px، زیر ۹۰۰px ۴۸px؛ قاب ۱٫۵px و سایه‌ی سخت ۴px؛ انتخاب `aria-pressed="true"` (سرمه‌ای، در تیره کرم). ردیف دسته‌های خانه همین است؛ کلاس‌های قدیمی `cx-d-pill` و `cx-e-cat` حذف شدند. فایل‌های عوض‌شده: `bundle.css`، `bundle.js`، `index.d.ts`، `components/Chip/README.md`، `reference/components/Chip_{light,dark}.png`.

## ۵. چه چیزی عوض نشد

بقیه‌ی ۱۱۶ صفحه‌ی مرجع، کامپوننت‌های دیگر، ابزارها (`ds-check`، QA) و `ds.config.json` همان v2.1 هستند. `screens.json` فیلد `changed: "2.2"` روی شش صفحه‌ی خانه دارد.

## v2.2.1: راه گوشی به «همهٔ بازی‌ها» (۸ آبان ۱۴۰۵)

روی گوشی در طرح‌ها راهی به فهرست کامل بازی‌ها نبود. حالا مثل سایت زنده:

| کجا | تغییر | فایل مرجع |
|---|---|---|
| صفحه‌ی «بیشتر» | کاشی «بازی‌ها» (`layout-grid` ← `/games`) اولین کاشی گروه «بازی و میز» | `reference/html/play/More-Phone.html` |
| خانه (عضو و مهمان) | لینک `cx-b-more` «همهٔ بازی‌ها» کنار ردیف دسته‌ها روی گوشی هم دیده می‌شود؛ ردیف چیپ‌ها اسکرول می‌خورد و لینک ته ردیف ثابت است، ۱۶px از لبه. کلاس `cx-hide-phone` از این لینک برداشته شد. | شش فایل `Home-*` |
| داک | در `/games` و `/games/:slug` آیتم «بیشتر» فعال است (`is-active` و `aria-current="page"`)، نه «خانه» | `Catalog-Desktop`، `GameDetail-Desktop`، `GameDetail-Phone` |

مستندات: `system/components/Dock/README.md`، `AppShell/README.md`، `MoreTile/README.md` و `system/docs/0-brand-and-principles.md`. توکن یا کامپوننت تازه‌ای اضافه نشد. `screens.json` روی این ۱۱ صفحه `changed: "2.2.1"` دارد.
