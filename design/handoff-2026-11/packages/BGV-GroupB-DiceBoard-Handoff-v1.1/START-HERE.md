# بردگیم‌ورس: بستهٔ تحویل گروه ب: بازی‌های صفحه‌ای با تاس و چندنفره (v1.0، ۱۸ آبان ۱۴۰۵)

۷ بازی روی یک قاب مشترک: مونوپولی، بتل‌شیپ، شترسواری، منچ، ریسک، مارپله، یاتزی. این بسته روی **بستهٔ دیزاین سیستم v2.4** سوار می‌شود و برای **Claude Code** آماده است.

## محتوای بسته
| مسیر | چیست |
| --- | --- |
| `repo/design/games/group-b/HANDOFF.md` | **از اینجا شروع کنید**: قاب مشترک، تفاوت هر بازی، هنر ناقص، ترتیب کار |
| `repo/design/games/group-b/COMPONENTS.md` | اجزای قاب و اجزای خود هر بازی |
| `repo/design/games/group-b/<slug>/RULES.md` | همهٔ قانون‌های هر بازی با منبع رسمی، مقایسه با موتور و طرح؛ «تفاوت موتور با دفترچه» = کارهای تیم فنی |
| `repo/design/games/group-b/QA-CHECKLIST.md`، `CHANGELOG.md` | QA و تاریخچه |
| `repo/design/games/group-b/layout.json` | اندازه‌های قاب (دسکتاپ و گوشی) |
| `repo/design/games/group-b/data/` | `games.json` (نام، لاتین، هنر، تفاوت‌ها، شمار قانون‌ها)، `missing-art.json` |
| `repo/design/games/group-b/art/` | هنر وب هر بازی (از بستهٔ ناشر/BGA) |
| `repo/design/games/group-b/reference/` | تصویر هر آرت‌بورد، HTML آفلاین (با `ds/` کنارش)، منبع کانواس (`dc/`)، `screens.json` |
| `repo/design/games/group-b/tools/` | سازندهٔ آرت‌بوردها (فقط برای بازسازی طراحی) |
| `repo/.claude/commands/bgv-groupb-implement.md`، `-qa.md`، `-fix.md`؛ `agents/bgv-groupb-qa.md` | دستورهای Claude Code |

## نصب
1. بستهٔ دیزاین سیستم v2.4 پیش‌نیاز است.
2. محتوای `repo/` را در ریشهٔ ریپو کپی کنید (ادغام؛ چیزی پاک نمی‌شود).
3. `design/` را commit کنید؛ `.claude/` را هر توسعه‌دهنده در ریپوی محلی خودش کپی کند.

## کار با Claude Code
```
/bgv-groupb-implement frame
```
بعد برای هر بازی: `/bgv-groupb-implement <slug>`. در پایان: `/bgv-groupb-qa --fix`.
