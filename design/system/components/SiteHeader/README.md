The desktop site header (v2.1): 72px, sticky, on `--surface-chrome` with a hairline. It replaces the sidebar. In order: logo, five destinations, search, «بازی سریع», messages, notifications, avatar.

**Material (v2.1):** a chrome strip, no shadow. Destinations are rows (tint on hover; current = a 3px navy rule under the label, cream in dark). «بازی سریع» is the one amber token in the header. It is a **registered exception** to «one amber action per page» (owner decision, 30 Mehr 1405): it is the site-wide action, so on desktop it may sit next to the page's own primary action; it hides on the home page. Messages and notifications are ghost icons; the icon of the page you are on is a flat navy fill. The avatar is a neutral disc, never amber.

## When to use

Every page at 900px and wider, inside `AppShell` (which builds it from `nav`, `user`, `messages`, `notifications` and `guest`). Below 900px it hides and the phone `TopBar` + `Dock` take over. Tables use `GameBar`.

## Props / what the consumer provides

| Prop | Type | Description |
|---|---|---|
| `logo` | `{ src, srcDark }` | Lock-up files (primary / reversed). |
| `nav` | `Array<{ label, href, active?, turns? }>` | Default: خانه، بازی‌ها، میزها، تورنمنت‌ها، رتبه‌بندی. `active` = current destination; `turns` = crimson count on «میزها» (members only). |
| `guest` | `boolean` | «ورود / ثبت‌نام» as a **secondary** token in place of the icons and the avatar; no counts. |
| `user` | `{ initials, src, name, current? }` | Avatar button (opens `AccountMenu`). `current` = navy ring: you are on an account page. |
| `messages`, `notifications` | `{ href, count?, current? } \| false` | Ghost icons with crimson counts; `current` = filled navy. |
| `quickPlay` | `false \| { href, label }` | Amber «بازی سریع». Pass `false` on the home page: its first section already has it. |
| `search` | `SiteSearchProps \| Node \| false` | The header search. |
| `width` | `'auto' \| 'mid' \| 'wide'` | Force the 900–1199 or ≥1200 look (previews). |
| `onAvatar`, `menuOpen` | | Open the account menu; sets `aria-expanded`. |

Types: `SiteHeaderProps` in `components/index.d.ts`. Classes: `.bgv-siteheader`, `.bgv-siteheader__in`, `.bgv-sitenav`, `.bgv-siteheader__actions`, `.bgv-siteheader__quick`, `.bgv-avatarbtn`.

## Responsive

| Width | Header |
|---|---|
| ≥1200 (`--bp-lg`) | Full: search field 200–340px. |
| 900–1199 | Search collapses to a 44px round button (opens the same popover); «بازی سریع» keeps its label; destinations tighten to 14px. |
| <900 (`--bp-md`) | Hidden: the top bar and dock take its place. |

## Do / Don't

**Do**

- Keep exactly five destinations in this order. Coins live in the avatar menu on desktop, not in the header.
- Give the current destination `active`; on an account page mark the avatar `current`; on messages or notifications mark that icon `current`.
- Guest header: secondary «ورود / ثبت‌نام» that goes to the full login page and returns to the same page.

**Don't**

- Do not add a second amber control to the header; «بازی سریع» is the only one, and it hides on the home page.
- Do not show counts to guests.
- Do not put the header on a table page.

## Example

```js
h(B.SiteHeader, {logo:{src:'logo-fa-primary.svg', srcDark:'logo-fa-reversed.svg'},
  nav:[{label:'خانه', href:'/'},{label:'بازی‌ها', href:'/games', active:true},{label:'میزها', href:'/tables', turns:3},{label:'تورنمنت‌ها', href:'/tournaments'},{label:'رتبه‌بندی', href:'/ranking'}],
  user:{initials:'م', name:'مینا'}, messages:{href:'/messages', count:4}, notifications:{href:'/notifications', count:5}})
```
