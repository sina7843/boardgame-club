# ابزارهای طراحی بلاد ریج (بازسازی آرت‌بوردها، داده و بسته)

برای تیم فنی لازم نیستند؛ فقط اگر دیزاین عوض شود. Node 22+ و Python 3 با Pillow (و numpy برای اندازه‌گیری).

| ابزار | کار |
| --- | --- |
| `pack-art.py` | PNGهای `ready to use` ← WebP وب در اندازهٔ اصلی (بدون بزرگ‌نمایی) + `art-index.json` |
| `bdr-fa.js` | نام‌های فارسی و متن فارسی ۷۵ متن یکتای کارت‌ها |
| `gen-data.js` | `content.json` از دادهٔ BGA + همسایگی + متن فارسی (هر کپی کارت با همان متن انگلیسی چک می‌شود) |
| `mock.js` | وضعیت مرجع ۴ نفره با شکل `ENGINE.md §2` و چک قانون‌ها (روستا، شاخ، خشم، عصر کارت، جایگاه ارتقا) |
| `bdr-lib.js`، `bdr-css.js`، `bdr-parts.js`، `bdr-phases.js`، `bdr-mobile.js`، `bdr-spec.js`، `bdr-screens.js`، `build-bdr.js` | ساخت دو آرت‌بورد کانواس و نسخهٔ HTML آفلاین |
| `gen-handoff-data.js` | `data/*.json` و `layout.json` بسته (با `mainHints`) |
| `to-blob.js`، `canvas-edit.js` | نشانی تصویرها ← انبار کانواس؛ ادغام `canvas.json` |
| `shot.py`، `render-ref.py` | تصویر مرجع با یک Chrome بی‌سر، یکی‌یکی |
| `make-package.py`، `make-zip.py`، `verify-zip.py` | بسته، zip با مسیر `/`، بررسی از zip تازه بازشده |

پیش از اجرا پوشهٔ `tools/work` را یک سطح بالاتر (`../work`) کپی کنید؛ `gen-data.js` و `mock.js` از آنجا می‌خوانند. مسیر `ready to use` در `pack-art.py` و `make-package.py` را به پوشهٔ خودتان عوض کنید.

ترتیب: `py -I pack-art.py "<ready to use>" ../art` ← `node gen-data.js` ← `node mock.js` ← `node build-bdr.js <canvas root>` ← `py -I render-ref.py …` ← `py -I make-package.py` ← `py -I make-zip.py` ← `py -I verify-zip.py`.

اندازه‌گیری‌ها: مختصات استان‌ها، روستاها و آبدره‌ها از `bga-materials.json` (دادهٔ خود BGA، روی نقشهٔ ۱۶۰۰ چک‌شده)؛ چیدمان صفحه از DOM یک بازی ضبط‌شده و یک میز زندهٔ BGA در ۱۴۴۰ پیکسل (ستون بازی ۱۱۷۸، پنل‌ها ۲۴۰، جعبهٔ نقشه ۷۲۰، توکن مهره ۷٫۴۵٪ قابل‌دید).
