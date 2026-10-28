The site shell (v2.1): the sticky `SiteHeader` on top and one centred content column (max `--content-max` 1320, the same width as the header and footer). Under 900px the header steps aside for the sticky phone `TopBar` and the floating `Dock`. One markup for every width. The sidebar is gone.

**Material (v2.1):** chrome strips (header, top bar) with a hairline and no shadow; the dock is a floating board; content sits on `--bg`.

## When to use

Every page outside the game table. The table uses `TableScreen` + `GameBar` instead. Add `SiteFooter` (via `footer`) only on public pages: games, game page, wiki, support.

## Widths

| Width | Shell |
|---|---|
| ≥1200 (`--bp-lg`) | Header with the full search field; content padding 32px. Two-column pages use `.bgv-cols` (main + 280–360px side column). |
| 900–1199 | Header with search collapsed to a 44px button; content padding 20px; `.bgv-cols` stacks. |
| <900 (`--bp-md`) | No header: sticky 56px top bar (`--topbar-h`) + floating dock; content padding 16px, 104px at the bottom for the dock. |

**Phone design rule:** a page that has its own phone board is designed as that board; every other page uses the desktop page's layout at 390px (same markup, stacked).

## Props / what the consumer provides

| Prop | Type | Description |
|---|---|---|
| `layout` | `'auto' \| 'full' \| 'mid' \| 'phone'` | auto (default) = the viewport decides; the others force one layout (previews, screenshots). |
| `logo` | `{ src, srcDark, markSrc, markSrcDark }` | Lock-up for the header, symbol for the phone top bar. |
| `nav` | header destinations | Default: خانه، بازی‌ها، میزها، تورنمنت‌ها، رتبه‌بندی. |
| `dockItems` | `DockProps['items']` | خانه، میزها، پیام‌ها، بیشتر — for guests too. |
| `guest` | `boolean` | Header and top bar show «ورود / ثبت‌نام» (secondary); the dock keeps four items without counts. |
| `user` | `{ initials, name, current }` | Avatar button (account menu). |
| `coins` | `number` | Coin chip in the phone top bar (on desktop it lives in the account menu). |
| `messages`, `notifications` | `{ href, count, current }` | Header icons; `notifications` also takes a number. |
| `quickPlay` | `false \| { href, label }` | Pass `false` on the home page. |
| `search` | `SiteSearchProps \| Node \| false` | Header search; on phones the top bar shows the magnifier. |
| `title` | `Node` | Phone top-bar title. |
| `header`, `topbar`, `dock`, `footer` | `Node` | Replace or add parts. |
| `children` | `Node` | Page content inside `main.bgv-app__main`. |

Types: `AppShellProps` in `components/index.d.ts`. Markup: `.bgv-app > header.bgv-siteheader + main.bgv-app__main (> .bgv-topbar.bgv-app__top … .bgv-dock.bgv-app__dock) [+ footer.bgv-sitefooter]`. `.bgv-app--site` is kept as an alias for markup written for v1.8.

## Guest pattern

- Same four dock items; no counts anywhere.
- Header and top bar: «ورود / ثبت‌نام» as a secondary token; it opens the full login page and returns to the same page.
- Pages that need an account (messages) show `StateBlock kind="guest"`.
- Sitting at a table opens `LoginSheet` in place; the seat is held for 2 minutes.

## Do / Don't

**Do**

- Keep header, page and footer on the same 1320 column.
- Hide «بازی سریع» on the home page (`quickPlay={false}`).

**Don't**

- Do not bring back a sidebar or a second navigation column.
- Do not show the footer on tables, messages or settings.

## Example

```js
h(B.AppShell, {logo:L, user:{initials:'م', name:'مینا'}, messages:{href:'/messages', count:4}, notifications:5, coins:2480, title:'بازی‌ها',
  nav:[{label:'خانه', href:'/'},{label:'بازی‌ها', href:'/games', active:true},{label:'میزها', href:'/tables', turns:3},{label:'تورنمنت‌ها', href:'/tournaments'},{label:'رتبه‌بندی', href:'/ranking'}],
  dockItems:[{icon:'house', label:'خانه', active:true},{icon:'dices', label:'میزها', turns:3},{icon:'message-circle', label:'پیام‌ها', count:4},{icon:'menu', label:'بیشتر'}],
  footer:h(B.SiteFooter, {logo:{src:L.srcDark}})},
  h(B.PageHead, {title:'بازی‌ها'}))
```
