# لوگو، نشان، فاویکن و آیکن‌ها — قوانین استفاده
# Logo, symbol, favicon and icons — usage rules

**مرجع برند فقط دیزاین سیستم است** (`design/system/`: توکن‌ها، مستندات و همین فایل). PDF برندبوک از ۲۸ مهر ۱۴۰۵ کنار گذاشته شد و در این بسته نیست؛ همهٔ قوانین لازمش (شکل، اندازه، حریم، رنگ) همین‌جا ثبت شده است.
**The design system is the only brand source** (`design/system/` tokens + docs + this file). The brand book PDF is retired and not shipped; every rule you need from it (shapes, sizes, clear space, colour) is written here.

## 1. Files
| Need | File (in this folder) | Ship as |
|---|---|---|
| Primary lockup (Persian, horizontal) on light | `BGV-Brand-Kit/02_Lockups/horizontal-fa/BGV-horizontal-fa-primary.svg` (= `design/system/assets/logo-fa-primary.svg`) | `/brand/logo-fa-primary.svg` |
| Same, reversed — dark theme, navy chrome, felt | `…/BGV-horizontal-fa-reversed.svg` (= `logo-fa-reversed.svg`) | `/brand/logo-fa-reversed.svg` |
| Symbol 24–48px (phone top bar) | `01_Symbol/small-size_24-48px/BGV-symbol-primary-small.svg` / `-reversed-small.svg` | `/brand/symbol-primary-small.svg`, `/brand/symbol-reversed-small.svg` |
| Symbol ≥48px | `01_Symbol/BGV-symbol-primary.svg` / `-reversed.svg` | as needed |
| Latin lockups (`horizontal-en`, `horizontal-bgv`, `stacked-bgv`) | `02_Lockups/…` | marketing / English contexts only |
| On photos or busy backgrounds | `03_Container/BGV-container.svg` (`-small` for small sizes) | |
| One-ink (print, emboss) | `mono-black` / `mono-navy` / `mono-white` variants | never in the app UI |
| Browser tab icons | `favicon-production/favicon.ico` (16+32+48), `favicon-16.png`, `favicon-32.png`, `favicon-48.png` | site root |
| iOS home screen | `favicon-production/apple-touch-icon-180.png` | site root |
| PWA | `favicon-production/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `site.webmanifest` | site root |
| Large vector icon (≥48px contexts only) | `favicon-production/favicon.svg` | **not** as `rel="icon"` |
| Native app icons | `BGV-Brand-Kit/04_App-Icon/ios`, `android-adaptive` | stores |
| Social | `06_Social/BGV-og-image-1200x630.png` (link previews), `BGV-avatar-1080.png` (accounts) | `og:image` |

> `favicon-production/` supersedes `BGV-Brand-Kit/05_Favicon/`: at 16px the cream brand-kit favicon disappears on light tab bars, so the production tab icons use the reversed colourway on a solid navy tile `#142B3B` (pixel-tuned 16/32 drawings, colours swapped, no resampling). Colours and tokens come only from `design/system/tokens.css`.

## 2. HTML head (apps/web/index.html)
```html
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#142B3B">
<meta property="og:image" content="/brand/BGV-og-image-1200x630.png">
```
- Never add `favicon.svg` as `rel="icon"` (browsers would prefer it over the pixel-tuned bitmaps).
- One `theme-color` (`#142B3B`) serves both themes; `prefs.tsx` no longer needs to swap it. `site.webmanifest`: `theme_color #142B3B`, `background_color #F3EBDD`.

## 3. Colourway rule
| Background | Use |
|---|---|
| Light (`--bg`, `--surface`, cream) | `primary` — top figure Amber Deep `#D8942F`, others Navy `#142B3B` |
| Dark theme (`--bg` `#142B3B`, `--surface` `#20394A`), felt `#20394A` / `#142B3B`, brand navy | `reversed` — top figure Amber `#E8A642`, others Cream `#FAF5EC` |
| Photo / busy | `container` (cream tile) |
- The top figure is always amber. Never put the primary (navy) logo on felt, the dark theme or amber.

## 4. Size and clear space
- Persian horizontal lockup: min **120px** wide. English lockup min 160px; `horizontal-bgv` min 80px; `stacked-bgv` min 64px tall.
- Symbol: below 48px use the `-small` optical master; never below **24px**.
- In the app (v2.1): site header (≥900) Persian horizontal lockup **32px** high (`.bgv-siteheader .bgv-logo img`); site footer the reversed lockup; phone top bar symbol **32px** (small file). There is no sidebar any more.
- Clear space: **1×** the head diameter of a figure on every side. Nothing (text, badges, edges) inside it.

## 5. In code
- Use the `Logo` component: `<Logo src="/brand/logo-fa-primary.svg" srcDark="/brand/logo-fa-reversed.svg" markSrc="/brand/symbol-primary-small.svg" markSrcDark="/brand/symbol-reversed-small.svg" href="/" />`. CSS shows the right file per theme and per shell width (`.bgv-logo__light/__dark/__full/__mark`).
- `alt="بردگیم‌ورس"`; when the brand name is printed next to it use `alt=""` and put `aria-label` on the link.
- Product name in text: **بردگیم‌ورس** (with ZWNJ); Latin: **Board Game Verse** / **BGV**.

## 6. Never
- Recolour, outline, add shadows/gradients, rotate, stretch, crop or animate the logo; rebuild it in CSS/SVG/JSX; use an emoji or icon in its place.
- Use mono variants in the UI; place the logo on a background that breaks the colourway rule; scale below the minimum sizes.
- Use the old VibeFarsi favicon, the old green/coral logo files, or any colour that is not a `design/system` token. The logos and favicon currently in `apps/web/public` are still green/coral: replace them with these files.
