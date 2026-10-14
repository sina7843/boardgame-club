The desktop sidebar (272px, `--surface-chrome`): brand + bell, the canonical nav in three groups, and the footer identity card with the real-gold coin chip. Collapses to 88px icons at 900–1199 inside `AppShell`.

## When to use

Inside `AppShell` on every desktop page outside the game table.

## Props / what the consumer provides

`brand` (a `Logo` with `srcDark`/`markSrc`), `headerActions` (notification bell), `items` (NavItem props; `{group}` headings), `footer` (identity link + coin chip + «خرید سکه»).

| Prop | Type | Description |
|---|---|---|
| `brand` | `Node` | Brand node, usually <Logo src=…/>. |
| `headerActions` | `Node` | Header nodes after the brand (notification bell). |
| `items` | `Array<NavItemProps \| { group: Node }>` | NavItem props; `{group:'نقش‌ها'}` inserts a group heading. |
| `footer` | `Node` | Pinned to the bottom (account, coins). |
| `label` | `string` | nav aria-label. Default «بخش‌های اصلی». |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `SidebarProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Nav order: بازی (خانه، بازی‌ها، میزها و حریف‌یابی) · من (پیشرفت و رتبه، پیام‌ها و دوستان، اشتراک و سکه) · کمک (راهنما، پشتیبانی، تنظیمات).
- Bell with a crimson count in the header; coral «۳ نوبت» on میزها; crimson unread on پیام‌ها.
- Footer: identity card (frame, league, title «لقب», level) and the coin chip with «خرید سکه» (secondary).

**Don't**

- Do not invent other sidebar variants; use `AppShell` so collapse and phone shell come for free.
- Do not add icons without labels (the 88px version keeps them as `title`).

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
(function () {
  var items = [{group:'بازی'},{icon:'house', label:'خانه', active:true},{icon:'layout-grid', label:'بازی‌ها'},{icon:'dices', label:'میزها و حریف‌یابی', turns:3},{group:'من'},{icon:'trophy', label:'پیشرفت و رتبه'},{icon:'message-circle', label:'پیام‌ها و دوستان', count:4},{icon:'wallet', label:'اشتراک و سکه'},{group:'کمک'},{icon:'book-open', label:'راهنما'},{icon:'life-buoy', label:'پشتیبانی'},{icon:'settings', label:'تنظیمات'}];
  var bell = h(B.Button, {iconOnly:true, variant:'ghost', icon:'bell', count:5}, 'اعلان‌ها');
  var foot = h('div', {className:'bgv-sidebar__foot'},
    h(B.Identity, {name:[h('span', {key:'n'}, 'مینا'), h(B.League, {key:'l', tier:'gold'})], initials:'م', frame:'gold', title:'شب‌زنده‌دار', level:18}),
    h('div', {className:'bgv-row bgv-sidebar__text', style:{justifyContent:'space-between', flexWrap:'nowrap'}}, h(B.Coin, {chip:true, amount:2480, href:'#'}), h(B.Button, {size:'sm', variant:'secondary', icon:'plus'}, 'خرید سکه')));
  var logo = h(B.Logo, {src:'assets/logo-fa-primary.svg', srcDark:'assets/logo-fa-reversed.svg', markSrc:'assets/symbol-primary-small.svg', markSrcDark:'assets/symbol-reversed-small.svg', height:36});
  var bar = function (cls) { return h('div', {className:'bgv-app ' + cls, style:{display:'block', padding:0, minHeight:0, background:'transparent'}}, h(B.Sidebar, {brand:logo, headerActions:bell, items:items, footer:foot})); };
  var zoomed = function (node, w) { return h('div', {style:{width:w + 'px', zoom:0.56}}, node); };
  return h('div', {style:{display:'flex', gap:'24px', alignItems:'flex-start', flexWrap:'wrap'}},
    h('figure', {style:{margin:0, display:'grid', gap:'6px'}}, zoomed(bar('bgv-app--full'), 272), cap('۱۲۰۰ و بیشتر، ۲۷۲')),
    h('figure', {style:{margin:0, display:'grid', gap:'6px'}}, zoomed(bar('bgv-app--icons'), 88), cap('۹۰۰ تا ۱۱۹۹، ۸۸')),
    h('ul', {style:{margin:0, paddingInlineStart:'18px', display:'grid', gap:'4px', maxWidth:'300px'}},
      ['زمینهٔ کروم: توکن surface-chrome؛ در تیره زغالی', 'گروه‌ها: بازی، من، کمک', 'نوبت‌های منتظر: نشان مرجانی «۳ نوبت»', 'پیام خوانده‌نشده: شمارندهٔ زرشکی', 'پایین: کارت هویت و چیپ سکهٔ طلایی + «خرید سکه»'].map(function (t) { return h('li', {key:t, className:'t-caption bgv-muted'}, t); })));
})()
```
