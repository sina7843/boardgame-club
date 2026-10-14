Browser-tab and home-screen icons, made from the brand-kit symbol. Tab icons (16, 32, 48, SVG) use the reversed colourway on a solid brand-green tile: the cream brand-kit favicon disappears on light tab bars at 16px, while green with cream figures and the coral top figure stays legible on light and dark tabs. 16 and 32 are the brand kit's pixel-tuned drawings with the colours swapped (no resampling); 48 is rendered from `favicon.svg`. Home-screen and PWA icons (180, 192, 512, maskable 512) are the brand-kit cream app icons, unchanged.

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

`favicon.ico` is not an allowed upload type. Build it from the three PNGs (16, 32, 48 layers), for example `magick favicon-16.png favicon-32.png favicon-48.png favicon.ico` or `png-to-ico`, and serve it from the site root.

## HTML head

```html
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#173A2D" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#191B1A" media="(prefers-color-scheme: dark)">
```

Do not add `favicon.svg` as `rel="icon"`: browsers prefer an SVG over the bitmaps and would skip the pixel-tuned 16/32 drawings. The dark `theme-color` is the charcoal page colour (`--bg` dark), not the brand kit's older green.

## site.webmanifest

```json
{
  "name": "بردگیم‌ورس · Board Game Verse",
  "short_name": "بردگیم‌ورس",
  "lang": "fa",
  "dir": "rtl",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#173A2D",
  "background_color": "#F6F0E4",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
