The canonical responsive app shell (brief/SHELL.html): ≥1200 full sidebar, 900–1199 icon sidebar 88px, <900 sticky top bar + floating dock — one markup for every width.

## When to use

Every page outside the game table. The table uses `TableScreen` + `GameBar` instead.

## Props / what the consumer provides

Data: `logo` (lock-up + symbol files, light and reversed), `nav` (canonical items with `{group}` headings), `dockItems`, `user` (Identity props for the footer card), `coins` (real-gold chip), `notifications` (bell count), `title` (phone top bar). Or pass your own `sidebar` / `topbar` / `dock` nodes. Page content goes in `children`. `layout` forces `full`/`icons`/`phone` for previews; default `auto` lets the viewport decide. Chrome uses `--surface-chrome` (= surface in light, charcoal #252826 in dark).

| Prop | Type | Description |
|---|---|---|
| `layout` | `'auto' \| 'full' \| 'icons' \| 'phone'` | auto (default) = the viewport decides: ≥1200 full sidebar, 900–1199 icon sidebar 88px, <900 sticky top bar + floating dock. full / icons / phone force one layout (previews, screenshots). |
| `logo` | `{ src: string; srcDark?: string; markSrc?: string; markSrcDark?: string }` | Brand-kit files: lock-up (src, srcDark) and symbol (markSrc, markSrcDark). |
| `nav` | `Array<NavItemProps \| { group: Node }>` | Sidebar items in the canonical order (NavItem props; {group} headings: بازی، من، کمک). |
| `dockItems` | `DockProps['items']` | Phone dock items: خانه، بازی‌ها، میزها، پیام‌ها، بیشتر (`turns` = coral count). |
| `user` | `IdentityProps & { href?: string }` | Identity card in the sidebar footer (links to the profile). |
| `coins` | `number` | Coin balance: real-gold coin chip in the sidebar footer and the top bar. |
| `coinsHref` | `string` | — |
| `buyLabel` | `string` | — |
| `notifications` | `number` | Unread notifications on the bell (sidebar header + top bar). |
| `notificationsHref` | `string` | — |
| `homeHref` | `string` | — |
| `title` | `Node` | Phone top-bar title. |
| `sidebar` | `Node` | Replace the built parts with your own nodes. |
| `topbar` | `Node` | — |
| `dock` | `Node` | — |
| `children` | `Node` | Page content (inside main.bgv-app__main, between top bar and dock). |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `AppShellProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Same nav, same badges and same identity card on every page: خانه، بازی‌ها، میزها و حریف‌یابی (coral «۳ نوبت»)، پیشرفت و رتبه، پیام‌ها و دوستان (crimson ۴)، اشتراک و سکه، راهنما، پشتیبانی، تنظیمات.
- Coins appear once: the real-gold chip in the sidebar footer (desktop) or the top bar (phone).
- Lay out page content with `.bgv-cols` (main + side column, stacks <1200), `.bgv-grid` / `.bgv-grid--sm` (auto-fill cards), wrapping rows, and tables inside `.bgv-scroll-x`. No fixed pixel widths on content.
- The page and the chrome are charcoal in dark (`--bg` #191B1A, `--surface-chrome` #252826); content cards stay dark green.

**Don't**

- Do not build other sidebar variants or hide the bell/coin chip on some pages.
- Do not show the shell on the game table.
- Do not give the root a fixed width/height or overflow:hidden; it is a fluid page (min-height 100vh).

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
(function () {
  var L = {src:'assets/logo-fa-primary.svg', srcDark:'assets/logo-fa-reversed.svg', markSrc:'assets/symbol-primary-small.svg', markSrcDark:'assets/symbol-reversed-small.svg'};
  var nav = [{group:'بازی'},{icon:'house', label:'خانه', active:true},{icon:'layout-grid', label:'بازی‌ها'},{icon:'dices', label:'میزها و حریف‌یابی', turns:3},{group:'من'},{icon:'trophy', label:'پیشرفت و رتبه'},{icon:'message-circle', label:'پیام‌ها و دوستان', count:4},{icon:'wallet', label:'اشتراک و سکه'},{group:'کمک'},{icon:'book-open', label:'راهنما'},{icon:'life-buoy', label:'پشتیبانی'},{icon:'settings', label:'تنظیمات'}];
  var dock = [{icon:'house', label:'خانه', active:true},{icon:'layout-grid', label:'بازی‌ها'},{icon:'dices', label:'میزها', turns:3},{icon:'message-circle', label:'پیام‌ها', count:4},{icon:'menu', label:'بیشتر'}];
  var user = {name:'مینا', initials:'م', frame:'gold', league:'gold', title:'شب‌زنده‌دار', level:18};
  var page = function (n) { return [
    h(B.PageHead, {key:'h', title:'خانه', sub:'۳ میز منتظر حرکت شماست'}),
    h('div', {key:'c', className:'bgv-cols'},
      h('div', {className:'bgv-grid bgv-grid--sm'}, ['کاتان','کودتا','پادشاه توکیو','جایپور'].slice(0, n || 4).map(function (t) { return h(B.Card, {key:t, title:t}, h('p', {className:'t-caption bgv-muted'}, '۲ میز باز')); })),
      h(B.Card, {title:'نوبت شما'}, h('p', {className:'t-caption bgv-muted'}, 'کاتان، ۵ ساعت مانده')))]; };
  var mock = function (layout, w, hgt, s, t) {
    return h('figure', {style:{margin:0, display:'grid', gap:'6px', justifyItems:'start'}},
      h('div', {style:{width:Math.round(w * s) + 'px', height:Math.round(hgt * s) + 'px', overflow:'hidden', borderRadius:'12px', border:'1px solid var(--line)', position:'relative'}},
        h('div', {style:{width:w + 'px', height:hgt + 'px', transform:'scale(' + s + ')', transformOrigin:'top right', position:'absolute', top:0, right:0}},
          h(B.AppShell, {layout:layout, logo:L, nav:nav, dockItems:dock, user:user, coins:2480, notifications:5, title:'خانه', style:{minHeight:hgt + 'px'}}, page(layout === 'phone' ? 2 : 4)))),
      h('figcaption', {style:{lineHeight:1.5}}, cap(t)));
  };
  return h('div', {style:{display:'flex', gap:'16px', alignItems:'flex-start', flexWrap:'wrap'}},
    h('div', {style:{display:'grid', gap:'12px'}}, mock('full', 1240, 850, 0.29, '۱۲۰۰ و بیشتر: سایدبار کامل ۲۷۲'), mock('icons', 1000, 560, 0.29, '۹۰۰ تا ۱۱۹۹: سایدبار آیکونی ۸۸')),
    mock('phone', 390, 844, 0.54, 'زیر ۹۰۰: نوار بالا + داک شناور'));
})()
```
