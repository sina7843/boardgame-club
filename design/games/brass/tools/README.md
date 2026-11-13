# ابزارهای طراحی برس (بازسازی آرت‌بوردها و بسته)

این ابزارها برای تیم فنی لازم نیستند؛ فقط اگر دیزاین عوض شود یا بخواهید مختصات را دوباره بسنجید. Node 22+ و Python 3 با Pillow (و numpy/scipy برای تشخیص خانه‌ها).

| ابزار | کار |
| --- | --- |
| `find-slots2.py` | پیدا کردن خودکار ۶۰ خانهٔ ساخت روی نقشهٔ شب (مربع‌های تیرهٔ ۴۶ واحدی) |
| `find-frames.py` | ۲۹ قاب سطح روی صفحهٔ بازیکن |
| `gridcrop.py`، `strip.py` | برش شبکه‌دار برای خواندن مختصات (خط هر ۱۰ واحد، برچسب هر ۵۰) |
| `geo.js` | همهٔ مختصات اندازه‌گیری‌شده (منبع `layout.json`) |
| `overlay.py` | گذاشتن قطعه‌های واقعی روی نقشه با `geo.js` برای بررسی |
| `pack-art.py` | PNG مجموعهٔ ناشر ← WebP وب (۲ برابر اندازهٔ نمایش) |
| `dump-content.mjs` | خروجی `content/` کد به JSON |
| `engine/sim.mjs`، `engine/mock.mjs` | بازی بذردار ۴ نفره با `rules.ts` بدون تغییر (کپی `games/brass/src` کنار `engine/src` بگذارید؛ `node_modules` فقط دو جایگزین کوچک برای `zod` و `@bg/game-sdk` است) و ساخت `mock.json` با هزینهٔ اجرای آزمایشی |
| `br-lib.js`، `br-css.js`، `br-parts.js`، `br-mobile.js`، `br-spec.js`، `br-components.js`، `br-screens.js`، `build-br.js` | ساخت آرت‌بوردهای کانواس و نسخهٔ HTML آفلاین |
| `to-blob.js`، `canvas-edit.js` | نشانی تصویرها ← انبار کانواس؛ ادغام `canvas.json` |
| `render-ref.py`، `shot.py` | تصویر مرجع با یک Chrome بی‌سر، یکی‌یکی |
| `gen-data.js`، `make-package.js`، `make-zip.py`، `verify-zip.py` | دادهٔ تیم فنی، بسته، zip با مسیر `/`، بررسی از zip تازه باز‌شده |

ترتیب: `node --experimental-strip-types --no-warnings engine/mock.mjs 33` ← `node build-br.js <canvas root>` ← `py -I render-ref.py <root>/project/brass <img>` ← `node make-package.js` ← `py -I make-zip.py` ← `py -I verify-zip.py`.
