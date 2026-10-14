A 56px list row with leading node/icon, title, sub-line and trailing node.

## When to use

Settings lists, friends, game history, transactions — inside a `Card flush` wrapped in `div.bgv-list`.

## Props / what the consumer provides

`leading` or `icon`, `title`, `sub`, `trailing`, `href`/`onClick`, `as`.

| Prop | Type | Description |
|---|---|---|
| `leading` | `Node` | Leading node (Avatar, Coin…). |
| `icon` | `IconName` | Leading icon tile instead of `leading`. |
| `title` (required) | `Node` | — |
| `sub` | `Node` | — |
| `trailing` | `Node` | — |
| `href` | `string` | — |
| `as` | `string` | — |
| `onClick` | `React.MouseEventHandler` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ListItemProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Wrap rows in `<div class="bgv-list">` inside a flush card.
- Keep one action per row (trailing).

**Don't**

- Do not put more than two lines of text in a row.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h(B.Card,{flush:true}, h('div',{className:'bgv-list'},
  h(B.ListItem,{leading:h(B.Avatar,{initials:'س', status:'online'}), title:'سارا', sub:'در حال بازی آزول', trailing:h(B.Button,{size:'sm', variant:'primary'},'تماشا')}),
  h(B.ListItem,{icon:'history', title:'کاتان، برد', sub:'۱۰ امتیاز، ۲۱ مهر', trailing:h('b',{className:'bgv-num', style:{color:'var(--success)'}}, h('bdi',{dir:'ltr'},'+۱۹'))}),
  h(B.ListItem,{leading:h(B.Coin,{}), title:'خرید ۲۰۰ سکه', sub:'۲۹٬۰۰۰ تومان', trailing:h(B.Badge,{tone:'success', icon:'check'},'موفق')})
))
```
