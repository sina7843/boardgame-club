# ابزارهای دیزاین (برای سایت لازم نیست)

برای وقتی که دیزاین عوض می‌شود و آرت‌بوردها یا بسته باید دوباره ساخته شوند.

| فایل | کار |
| --- | --- |
| `build-gaia.js` + `gaia-desktop.tpl.html` | سه آرت‌بورد دسکتاپ (FA، EN، تیره) از یک قالب؛ همهٔ مختصات اینجاست |
| `gen-mobile.js` | چهار آرت‌بورد گوشی از خروجی دسکتاپ |
| `gen-factions.js` + `fx.js` | آرت‌بورد ۱۴ جناح؛ `fx.js` متن جناح‌ها را از `content/*.ts` ریپو بیرون می‌کشد |
| `gen-layout.js`، `gen-idmap.js` | `layout.json` و `data/content-id-map.json` |
| `pack-art.py`، `squash.py`، `thumbs.py`، `svg2webp.js` | هنر وب از SVGهای «ready to use - flat» (webp با کیفیت ۸۸، همان اندازهٔ پیکسل) |
| `qa-wrap.js`، `render-ref.py` | صفحه‌های HTML آفلاین و تصویرهای مرجع (`reference/`) |
| `canvas-edit.js`، `serve.js` | ویرایش `canvas.json` کانواس و سرور محلی پیش‌نمایش |
