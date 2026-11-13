# بردگیم‌ورس: بستهٔ تحویل گروه الف: بازی‌های صفحه‌ای دونفره (v1.0، ۱۸ آبان ۱۴۰۵)

۱۱ بازی روی یک قاب مشترک: ابلون، تخته‌نرد، چکرز، گو، کندو، دوز، اونیتاما، اتللو، کوریدور، سانتورینی، تاک. این بسته روی **بستهٔ دیزاین سیستم v2.4** سوار می‌شود و برای **Claude Code** آماده است.

## محتوای بسته
| مسیر | چیست |
| --- | --- |
| `repo/design/games/group-a/HANDOFF.md` | **از اینجا شروع کنید**: قاب مشترک، تفاوت هر بازی، هنر ناقص، ترتیب کار |
| `repo/design/games/group-a/COMPONENTS.md` | اجزای قاب و اجزای خود هر بازی |
| `repo/design/games/group-a/<slug>/RULES.md` | همهٔ قانون‌های هر بازی با منبع رسمی، مقایسه با موتور و طرح؛ «تفاوت موتور با دفترچه» = کارهای تیم فنی |
| `repo/design/games/group-a/QA-CHECKLIST.md`، `CHANGELOG.md` | QA و تاریخچه |
| `repo/design/games/group-a/layout.json` | اندازه‌های قاب (دسکتاپ و گوشی) |
| `repo/design/games/group-a/data/` | `games.json` (نام، لاتین، هنر، تفاوت‌ها، شمار قانون‌ها)، `missing-art.json` |
| `repo/design/games/group-a/art/` | هنر وب هر بازی (از بستهٔ ناشر/BGA) |
| `repo/design/games/group-a/reference/` | تصویر هر آرت‌بورد، HTML آفلاین (با `ds/` کنارش)، منبع کانواس (`dc/`)، `screens.json` |
| `repo/design/games/group-a/tools/` | سازندهٔ آرت‌بوردها (فقط برای بازسازی طراحی) |
| `repo/.claude/commands/bgv-groupa-implement.md`، `-qa.md`، `-fix.md`؛ `agents/bgv-groupa-qa.md` | دستورهای Claude Code |

## نصب
1. بستهٔ دیزاین سیستم v2.4 پیش‌نیاز است.
2. محتوای `repo/` را در ریشهٔ ریپو کپی کنید (ادغام؛ چیزی پاک نمی‌شود).
3. `design/` را commit کنید؛ `.claude/` را هر توسعه‌دهنده در ریپوی محلی خودش کپی کند.

## کار با Claude Code
```
/bgv-groupa-implement frame
```
بعد برای هر بازی: `/bgv-groupa-implement <slug>`. در پایان: `/bgv-groupa-qa --fix`.
