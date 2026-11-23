Browser-tab and home-screen icons (v2.4.4, owner decision 1 Azar 1405): **our symbol on a navy `#142B3B` tile, three figures in Amber Light `#F2B13C` and the top figure white `#FFFFFF`.** This replaces the white tile of v2.4.2, which lost contrast at 16px. The shape, radius (22%) and symbol size are unchanged; only the colours changed, and the slate edge is gone because the navy tile is visible on its own on light tab bars, while the yellow and white figures carry it on dark ones.

16 and 32 are the brand kit's pixel-tuned drawings (`05_Favicon/*-pixel.svg`) recoloured pixel for pixel (tile navy, navy pixels → `#F2B13C`, amber pixels → white), with no resampling. 48, 192 and 512 are rendered from `favicon.svg` (symbol at 74.7% = 1× head clear space on every side). `apple-touch-icon-180.png` is a full-bleed navy square (iOS rounds it) and `icon-maskable-512.png` a full-bleed navy square with the symbol at 64% inside the safe zone.

| File | Size | Use |
| --- | --- | --- |
| `favicon.ico` | 16, 32, 48 | Site root, every browser |
| `favicon-16.png` | 16×16 | Tab icon, pixel-tuned |
| `favicon-32.png` | 32×32 | Tab icon on HiDPI, pixel-tuned |
| `favicon-48.png` | 48×48 | Windows site tiles, ICO layer |
| `favicon.svg` | vector | Large contexts (≥48px) and the source for new sizes |
| `apple-touch-icon-180.png` | 180×180 | iOS home screen |
| `icon-192.png` | 192×192 | Web app manifest |
| `icon-512.png` | 512×512 | Web app manifest, install splash |
| `icon-maskable-512.png` | 512×512 | Web app manifest, `purpose: maskable` |

## HTML head

```html
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#142B3B">
```

Do not add `favicon.svg` as `rel="icon"`: browsers prefer an SVG over the bitmaps and would skip the pixel-tuned 16/32 drawings. Browsers cache favicons hard: after deploying, add a version query (`/favicon.ico?v=244`) to the links above or test in a private window.

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
  "background_color": "#142B3B",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```
