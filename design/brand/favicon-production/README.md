Browser-tab and home-screen icons (v2.4.2, owner decision 21 Aban 1405): **our symbol in the primary colourway on a white `#FFFFFF` tile** (navy `#142B3B` figures, Amber Deep `#D8942F` top figure). The tab icons (16, 32, 48, SVG) are rounded tiles (22% radius) with a 1px `--ink-btn` `#A1AAB1` edge, the same white-token-with-slate-frame look as the chips and buttons, so the white tile stays visible on a white or light-grey tab bar; on dark tab bars the white tile stands out by itself. 16 and 32 are the brand kit's pixel-tuned drawings (`05_Favicon/*-pixel.svg`) with the cream tile turned white and the edge added; the figure pixels are unchanged (no resampling). 48, 192 and 512 are rendered from `favicon.svg` (symbol at 74.7% = 1× head clear space on every side; edge 1px at 48, 2px at 192, 5px at 512). `apple-touch-icon-180.png` is a full-bleed white square (iOS rounds it) and `icon-maskable-512.png` a full-bleed white square with the symbol at 64% inside the safe zone. The old navy-tile set (v2.0) is retired.

| File | Size | Use |
| --- | --- | --- |
| `favicon-16.png` | 16×16 | Tab icon, pixel-tuned, white tile + 1px edge |
| `favicon-32.png` | 32×32 | Tab icon on HiDPI, pixel-tuned, white tile + 1px edge |
| `favicon-48.png` | 48×48 | Windows site tiles, ICO layer |
| `favicon.svg` | vector | Large contexts (≥48px) and the source for new sizes |
| `apple-touch-icon-180.png` | 180×180 | iOS home screen |
| `icon-192.png` | 192×192 | Web app manifest |
| `icon-512.png` | 512×512 | Web app manifest, install splash |
| `icon-maskable-512.png` | 512×512 | Web app manifest, `purpose: maskable` (symbol in the safe zone) |

`favicon.ico` is not an allowed upload type. Build it from the three PNGs (16, 32, 48 layers), for example `magick favicon-16.png favicon-32.png favicon-48.png favicon.ico` or `png-to-ico`, and serve it from the site root.

## HTML head

```html
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#142B3B" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#142B3B" media="(prefers-color-scheme: dark)">
```

Do not add `favicon.svg` as `rel="icon"`: browsers prefer an SVG over the bitmaps and would skip the pixel-tuned 16/32 drawings. The dark `theme-color` is the navy page colour (`--bg` dark), not the brand kit's older green. `theme-color` colours the browser UI, not the icon, so it stays navy; the manifest `background_color` is white to match the icon tile on the install splash.

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
  "background_color": "#FFFFFF",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
