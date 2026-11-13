# بردگیم‌ورس: بستهٔ تحویل گروه ج: بازی‌های کارتی (v1.0، ۱۸ آبان ۱۴۰۵)

۲۲ بازی روی یک قاب مشترک: جالیز، سوسک پوکرباز، کودتا، کرو: اعماق دریا، حراجی، هانابی، طبقه اشرافی، جایپور، شهرهای گمشده، نامه عاشقانه، نه مرسی، سالاد امتیاز، اسکات، نمک دریایی و کاغذ، مزایده سربسته، ست، شیش قلو، جمجمه، سوشی گو، کرو: در جستجوی سیارهٔ نهم، ذهن، اونو. این بسته روی **بستهٔ دیزاین سیستم v2.4** سوار می‌شود و برای **Claude Code** آماده است.

## محتوای بسته
| مسیر | چیست |
| --- | --- |
| `repo/design/games/group-c/HANDOFF.md` | **از اینجا شروع کنید**: قاب مشترک، تفاوت هر بازی، هنر ناقص، ترتیب کار |
| `repo/design/games/group-c/COMPONENTS.md` | اجزای قاب و اجزای خود هر بازی |
| `repo/design/games/group-c/<slug>/RULES.md` | همهٔ قانون‌های هر بازی با منبع رسمی، مقایسه با موتور و طرح؛ «تفاوت موتور با دفترچه» = کارهای تیم فنی |
| `repo/design/games/group-c/QA-CHECKLIST.md`، `CHANGELOG.md` | QA و تاریخچه |
| `repo/design/games/group-c/layout.json` | اندازه‌های قاب (دسکتاپ و گوشی) |
| `repo/design/games/group-c/data/` | `games.json` (نام، لاتین، هنر، تفاوت‌ها، شمار قانون‌ها)، `missing-art.json` |
| `repo/design/games/group-c/art/` | هنر وب هر بازی (از بستهٔ ناشر/BGA) |
| `repo/design/games/group-c/reference/` | تصویر هر آرت‌بورد، HTML آفلاین (با `ds/` کنارش)، منبع کانواس (`dc/`)، `screens.json` |
| `repo/design/games/group-c/tools/` | سازندهٔ آرت‌بوردها (فقط برای بازسازی طراحی) |
| `repo/.claude/commands/bgv-groupc-implement.md`، `-qa.md`، `-fix.md`؛ `agents/bgv-groupc-qa.md` | دستورهای Claude Code |

## نصب
1. بستهٔ دیزاین سیستم v2.4 پیش‌نیاز است.
2. محتوای `repo/` را در ریشهٔ ریپو کپی کنید (ادغام؛ چیزی پاک نمی‌شود).
3. `design/` را commit کنید؛ `.claude/` را هر توسعه‌دهنده در ریپوی محلی خودش کپی کند.

## کار با Claude Code
```
/bgv-groupc-implement frame
```
بعد برای هر بازی: `/bgv-groupc-implement <slug>`. در پایان: `/bgv-groupc-qa --fix`.
