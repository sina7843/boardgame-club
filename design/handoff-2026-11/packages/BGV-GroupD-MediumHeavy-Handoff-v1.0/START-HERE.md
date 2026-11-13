# بردگیم‌ورس: بستهٔ تحویل گروه د: بازی‌های متوسط و سنگین (v1.0، ۱۸ آبان ۱۴۰۵)

۲۲ بازی روی یک قاب مشترک: آزول، کارکاسون، کاتان، جاده ابریشم، دژ، کریپتید، دایس ترون، دومینیون، معبد الدورادو، هیت، پادشاه توکیو، کینگ‌دومینو، ماچی کورو، پچ‌ورک، ریس فور د گلکسی، جادوی کهن، اسپیس بیس، کهربا، قلمرو ستارگان، تیکت تو راید، آنمچد، عجایب هفت‌گانه: دوئل. این بسته روی **بستهٔ دیزاین سیستم v2.4** سوار می‌شود و برای **Claude Code** آماده است.

## محتوای بسته
| مسیر | چیست |
| --- | --- |
| `repo/design/games/group-d/HANDOFF.md` | **از اینجا شروع کنید**: قاب مشترک، تفاوت هر بازی، هنر ناقص، ترتیب کار |
| `repo/design/games/group-d/COMPONENTS.md` | اجزای قاب و اجزای خود هر بازی |
| `repo/design/games/group-d/<slug>/RULES.md` | همهٔ قانون‌های هر بازی با منبع رسمی، مقایسه با موتور و طرح؛ «تفاوت موتور با دفترچه» = کارهای تیم فنی |
| `repo/design/games/group-d/QA-CHECKLIST.md`، `CHANGELOG.md` | QA و تاریخچه |
| `repo/design/games/group-d/layout.json` | اندازه‌های قاب (دسکتاپ و گوشی) |
| `repo/design/games/group-d/data/` | `games.json` (نام، لاتین، هنر، تفاوت‌ها، شمار قانون‌ها)، `missing-art.json` |
| `repo/design/games/group-d/art/` | هنر وب هر بازی (از بستهٔ ناشر/BGA) |
| `repo/design/games/group-d/reference/` | تصویر هر آرت‌بورد، HTML آفلاین (با `ds/` کنارش)، منبع کانواس (`dc/`)، `screens.json` |
| `repo/design/games/group-d/tools/` | سازندهٔ آرت‌بوردها (فقط برای بازسازی طراحی) |
| `repo/.claude/commands/bgv-groupd-implement.md`، `-qa.md`، `-fix.md`؛ `agents/bgv-groupd-qa.md` | دستورهای Claude Code |

## نصب
1. بستهٔ دیزاین سیستم v2.4 پیش‌نیاز است.
2. محتوای `repo/` را در ریشهٔ ریپو کپی کنید (ادغام؛ چیزی پاک نمی‌شود).
3. `design/` را commit کنید؛ `.claude/` را هر توسعه‌دهنده در ریپوی محلی خودش کپی کند.

## کار با Claude Code
```
/bgv-groupd-implement frame
```
بعد برای هر بازی: `/bgv-groupd-implement <slug>`. در پایان: `/bgv-groupd-qa --fix`.
