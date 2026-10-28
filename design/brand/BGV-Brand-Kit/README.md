> **v1.1 (2026-10-20): navy/amber recolour.** Same drawings; colours follow the site theme (navy #142B3B, amber #E8A642/#D8942F, cream #FAF5EC). The brand book PDF and the old `07_Tokens` were retired on 2026-10-20: the design system (`design/system/`) and `design/brand/LOGO-USAGE.md` are the only brand rules.

# Board Game Verse — Brand Kit v1.0

Rules for everything in this folder: `../LOGO-USAGE.md` and `design/system/docs/0-brand-and-principles.md` (the brand book PDF is retired).

## Folders
| Folder | Contents |
|---|---|
| 01_Symbol | Symbol in 5 colorways. `small-size_24-48px/` = optical small-size master |
| 02_Lockups | horizontal-fa (primary), horizontal-en, horizontal-bgv, stacked-bgv × 5 colorways. Text is outlined |
| 03_Container | Cream-tile version — only on dark, photo or busy backgrounds |
| 04_App-Icon | iOS 1024, Android adaptive (foreground / background / monochrome), web icons, `site.webmanifest` |
| 05_Favicon | `favicon.ico` (pixel-tuned 16/32 + 48), PNGs, pixel SVG sources, `favicon.svg` (≥48px contexts) |
| 06_Social | Avatar 1080, share image 1200×630 |

## Naming
`BGV-[type]-[colorway][-small].svg` — colorways: primary · reversed · mono-navy · mono-black · mono-white.
Platform icons keep their platform names (`apple-touch-icon-180.png`, `icon-192.png`, …).

## Colorway rule
- Light background → `primary` (top figure Amber Deep #D8942F, others Navy #142B3B)
- Dark background → `reversed` (top figure Amber #E8A642, others Cream #FAF5EC)
- Photo / busy → `03_Container`

## Fonts (OFL, free)
- Vazirmatn — https://fonts.google.com/specimen/Vazirmatn (400 / 700 / 900)
- Manrope — https://fonts.google.com/specimen/Manrope (600 / 800)

## Website head
```html
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#142B3B">
```
Do not add `favicon.svg` as a tab icon: browsers would prefer it over the pixel-tuned ICO.

## Colours, dark mode, buttons
All colours, light/dark roles, button roles and states live only in the design system: `design/system/tokens.css` and `design/system/docs/`. Dark mode is «ink navy» (page #0D1A23, cards #192E3C); the logo switches to `reversed`. Never use colours that are not design-system tokens.
