Browser-tab and home-screen icons, made from the brand-kit symbol. Tab icons (16, 32, 48, SVG) use the reversed colourway on a solid navy tile (`#142B3B`): the cream brand-kit favicon disappears on light tab bars at 16px, while navy with cream figures and the amber top figure (`#E8A642`) stays legible on light and dark tabs. 16 and 32 are the brand kit's pixel-tuned drawings with the colours swapped (no resampling); 48 is rendered from `favicon.svg`. Home-screen and PWA icons (180, 192, 512, maskable 512) are the brand-kit cream app icons, recoloured to navy and amber (v1.4, 2026-10-20).

| File | Size | Use |
| --- | --- | --- |
| `favicon-16.png` | 16×16 | Tab icon, pixel-tuned |
| `favicon-32.png` | 32×32 | Tab icon on HiDPI, pixel-tuned |
| `favicon-48.png` | 48×48 | Windows site tiles, ICO layer |
| `favicon.svg` | vector | Large contexts (≥48px) and the source for new sizes |
| `apple-touch-icon-180.png` | 180×180 | iOS home screen |
| `icon-192.png` | 192×192 | Web app manifest |
| `icon-512.png` | 512×512 | Web app manifest, install splash |
| `icon-maskable-512.png` | 512×512 | Web app manifest, `purpose: maskable` (symbol in the safe zone) |

`favicon.ico` (16, 32 and 48 layers) is included; serve it from the site root. To rebuild it: `magick favicon-16.png favicon-32.png favicon-48.png favicon.ico`.

## HTML head

```html
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#142B3B">
```

Do not add `favicon.svg` as `rel="icon"`: browsers prefer an SVG over the bitmaps and would skip the pixel-tuned 16/32 drawings. One `theme-color` serves both themes: navy `#142B3B` is the brand colour and also the dark page colour (`--bg` dark).

## site.webmanifest

```json
{
  "name": "بردگیم‌ورس · Board Game Verse",
  "short_name": "بردگیم‌ورس",
  "lang": "fa",
  "dir": "rtl",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#142B3B",
  "background_color": "#F3EBDD",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
