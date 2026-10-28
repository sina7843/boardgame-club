The بردگیم‌ورس logo as `<img>` from brand-kit files the consumer provides; optional dark and symbol files switch automatically.

## When to use

Site header and footer (lock-up), phone top bar (symbol), login and onboarding, receipts. Use the `-small` symbol files between 24 and 48px.

## Props / what the consumer provides

Pass `src` (the brand-kit file). For theme-aware use pass `srcDark` too (`logo-fa-reversed.svg`); add `markSrc`/`markSrcDark` (symbol files) and the class `bgv-logo--mark` when one logo must show the symbol — CSS shows the right image per theme. `href` makes it the home link. The component never draws the mark itself.

| Prop | Type | Description |
|---|---|---|
| `src` (required) | `string` | URL of a brand-kit file (logo-fa-primary.svg on light, logo-fa-reversed.svg on dark). Required: the logo is never redrawn. |
| `alt` | `string` | Accessible name. Default «بردگیم‌ورس»; pass "" when the name is printed beside it. |
| `height` | `number` | Rendered height in px. Default 32. |
| `srcDark` | `string` | Reversed file for dark theme (logo-fa-reversed.svg); both render, CSS shows the right one per theme. |
| `markSrc` | `string` | Symbol file (symbol-primary-small.svg) shown instead of the lock-up when the logo has the class `bgv-logo--mark`. |
| `markSrcDark` | `string` | Reversed symbol for dark theme. |
| `href` | `string` | Renders an <a> (home link). |
| `children` | `Node` | Optional content after the image (e.g. a product label). |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `LogoProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Primary file (navy body, deep-amber top figure) on `--bg`/`--surface` in light theme; reversed file (cream body, amber top figure) in dark theme, on the navy chrome and on `--felt`.
- Heights: 32px in the site header and the phone top bar (44px tap target), never below 24px (symbol) / 120px wide (Persian lock-up).
- Keep `alt="بردگیم‌ورس"` unless the link around it already carries the name (then `alt=""` + `aria-label` on the link).
- Favicon and app icons come from the Favicon and App icons asset groups, never from this component.

**Don't**

- Do not recolour, outline, add shadows to, or redraw the logo in CSS/SVG.
- Do not put the primary (navy) logo on the felt, on the navy dark chrome or on amber; it loses contrast.
- Do not use emoji or an icon as a stand-in for the mark.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
(function () {
  var tile = function (src, hgt, bg, line, caption) {
    return h('div', {style:{display:'grid', gap:'8px'}},
      h('div', {style:{display:'grid', placeItems:'center', height:'88px', padding:'16px', borderRadius:'20px', background:bg, border:line ? '1px solid var(--line)' : '1px solid transparent'}}, h(B.Logo, {src:src, height:hgt})),
      h('span', {className:'t-caption bgv-muted', style:{textAlign:'center'}}, caption));
  };
  return h('div', {style:{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'12px'}},
    tile('assets/logo-fa-primary.svg', 32, 'var(--brand-cream)', true, 'قفل افقی، زمینهٔ روشن'),
    tile('assets/logo-fa-reversed.svg', 32, 'var(--felt)', true, 'قفل معکوس، تیره و میز'),
    tile('assets/symbol-primary-small.svg', 40, 'var(--brand-cream)', true, 'نشان کوچک، ۲۴ تا ۴۸'),
    tile('assets/symbol-reversed-small.svg', 40, 'var(--brand-ink)', true, 'نشان معکوس، روی سرمه‌ای'));
})()
```
