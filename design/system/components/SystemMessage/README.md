A centered chat line for system notices (filled) and game events (outlined, with seat glyph).

## When to use

Inside `Chat`: «دست ۲ شروع شد», «آرش ۱۲ امتیاز گرفت», timeouts, joins/leaves.

## Props / what the consumer provides

`game`, `seat`, `icon`, `text`/children (bold the names).

| Prop | Type | Description |
|---|---|---|
| `game` | `boolean` | Game event (outlined) vs system notice (filled). |
| `seat` | `SeatNo` | — |
| `icon` | `IconName` | — |
| `text` | `Node` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `SystemMessageProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Bold player names and keep the seat glyph for game events.

**Don't**

- Do not use system messages for chatty text.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{display:'grid', justifyItems:'center', gap:'8px'}},
  h(B.SystemMessage,null,'دست ۲ شروع شد؛ پخش‌کننده: ', h('b',null,'آرش')),
  h(B.SystemMessage,{game:true, seat:1}, h('b',null,'آرش'),' ۱۲ امتیاز گرفت'),
  h(B.SystemMessage,{game:true, seat:3}, h('b',null,'کاوه'),' وقتش تمام شد؛ خودکار کشید (اخطار ۲ از ۳)'),
  h(B.SystemMessage,{icon:'user-plus'}, h('b',null,'پریسا'),' به تماشاگرها پیوست')
)
```
