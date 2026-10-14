A 44px navigation row with icon, label and optional count / turn badge.

## When to use

Inside `Sidebar`; also in «بیشتر» menus on phones.

## Props / what the consumer provides

`icon`, `label`, `href`, `active`, `count` (crimson unread), `turns` (coral, tables where it is your turn), `badge`.

| Prop | Type | Description |
|---|---|---|
| `icon` | `IconName` | — |
| `label` | `Node` | — |
| `href` | `string` | — |
| `active` | `boolean` | Current page (raised tile, aria-current). |
| `count` | `number` | Crimson unread count. |
| `turns` | `number` | Tables where it's your turn: coral «you» badge. |
| `badge` | `Node` | Any other trailing badge node. |
| `onClick` | `React.MouseEventHandler` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `NavItemProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Mark the current page with `active` (raised tile + `aria-current`).
- Use `turns` only for your-turn counts (coral = you).

**Don't**

- Do not put more than one badge on an item.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{display:'grid', gap:'4px', maxWidth:'280px'}},
  h(B.NavItem,{icon:'house', label:'خانه', active:true}), h(B.NavItem,{icon:'layout-grid', label:'میزها و حریف‌یابی', turns:2}), h(B.NavItem,{icon:'message-circle', label:'پیام‌ها و دوستان', count:4}), h(B.NavItem,{icon:'life-buoy', label:'پشتیبانی'})
)
```
