# Board Game Verse — Brand Kit v1.0

Read `BGV-Brand-Book.pdf` (16 pages) first; it is the rulebook for everything in this folder.

## Folders
| Folder | Contents |
|---|---|
| 01_Symbol | Symbol in 5 colorways. `small-size_24-48px/` = optical small-size master |
| 02_Lockups | horizontal-fa (primary), horizontal-en, horizontal-bgv, stacked-bgv × 5 colorways. Text is outlined |
| 03_Container | Cream-tile version — only on dark, photo or busy backgrounds |
| 04_App-Icon | iOS 1024, Android adaptive (foreground / background / monochrome), web icons, `site.webmanifest` |
| 05_Favicon | `favicon.ico` (pixel-tuned 16/32 + 48), PNGs, pixel SVG sources, `favicon.svg` (≥48px contexts) |
| 06_Social | Avatar 1080, share image 1200×630 |
| 07_Tokens | `bgv-tokens.json` (source of truth) and `bgv-tokens.css` |

## Naming
`BGV-[type]-[colorway][-small].svg` — colorways: primary · reversed · mono-green · mono-black · mono-white.
Platform icons keep their platform names (`apple-touch-icon-180.png`, `icon-192.png`, …).

## Colorway rule
- Light background → `primary` (top figure Coral Deep #E4603F, others Green #173A2D)
- Dark background → `reversed` (top figure Coral #F2765B, others Cream #F6F0E4)
- Photo / busy → `03_Container`

## Fonts (OFL, free)
- Vazirmatn — https://fonts.google.com/specimen/Vazirmatn (400 / 700 / 900)
- Manrope — https://fonts.google.com/specimen/Manrope (600 / 800)

## Website head
```html
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#173A2D" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F211A" media="(prefers-color-scheme: dark)">
```
Do not add `favicon.svg` as a tab icon: browsers would prefer it over the pixel-tuned ICO.

## Dark mode
Semantic light/dark roles are in `bgv-tokens.json → semantic` and `bgv-tokens.css` (prefers-color-scheme + `data-theme`). Dark mode is built from the brand green; logo switches to `reversed`. See brand book pages 10–11. In UI code use the semantic roles (`--bgv-text`, `--bgv-surface` …), not the primitives (`--bgv-green`, `--bgv-ink` …).

## Primary button (join / sit / start)
Chosen by the design system, not the brand book. Constraints: not red or coral (must never read like "leave"), label ≥ 4.5:1, visible on cream, destructive red defined separately. Coral is for invite highlights (empty-seat chips, "you"), not the default button. Evaluated options are in `bgv-tokens.json → semantic.primary_action`.

## Left to the design system
Primary button color, interaction states (hover / pressed / disabled), elevation shadows and status colors (success / warning / error).
