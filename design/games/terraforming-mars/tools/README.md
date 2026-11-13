# ابزارهای دیزاین (برای سایت لازم نیست)

برای وقتی که دیزاین عوض می‌شود و آرت‌بوردها یا بسته باید دوباره ساخته شوند. مسیرهای کار در خود اسکریپت‌ها روی پوشهٔ کار دیزاینر (`E:\AI\Claude\bgv-tm`) است.

| فایل | کار |
| --- | --- |
| `pack-art.py` | هنر وب از SVGهای «ready to use - flat» (webp کیفیت ۸۸، همان اندازهٔ پیکسل؛ شرکت‌ها به عرض بومی ۴۵۰؛ برش آیکون‌ها از برگه‌های منبع) |
| `gridcrop.py` | برش زوم‌شده با شبکه برای اندازه‌گیری روی تصویرها |
| `mock-state.mjs` | موقعیت مرجع ۴ نفره را با `core.ts` مخزن چک می‌کند (`node --experimental-strip-types`) |
| `tm-lib.js` | هندسهٔ اندازه‌گیری‌شده، رنگ صندلی‌ها، کمک‌کارهای زبان |
| `tm-css.js`، `tm-parts.js`، `tm-mobile.js`، `tm-spec.js`، `tm-screens.js` | CSS و HTML همهٔ آرت‌بوردها |
| `build-tm.js` | ساخت همهٔ آرت‌بوردهای کانواس و کپی هنر لازم |
| `to-blob.js` | نسخهٔ کانواس آرت‌بوردها با آدرس انبار تصویر کانواس |
| `qa-wrap.js`، `qa-check.js`، `shot.py`، `render-ref.py` | صفحهٔ آفلاین، چک ایستا (مسیرها، tabular-nums، پاپ‌اور)، تصویرهای مرجع |
| `gen-layout.js`، `gen-idmap.js` | `layout.json`، `data/content-id-map.json`، `data/cards.json` |
| `canvas-edit.js` | ادغام کلیدهای این صفحه در `canvas.json` تازه |
| `make-package.js`، `make-zip.py`، `verify-zip.py` | ساخت بسته، زیپ با `/`، و بازکردن تازه و چک همهٔ مسیرها |
