A «همه آماده‌اند؟» check with a countdown and each player's ready state.

## When to use

Before a live table starts or after a rematch vote passes.

## Props / what the consumer provides

`players` ({name,seat,initials,you,bot,ready}), `clock` (lg), `title`, `text` (auto «۲ از ۴ بازیکن آماده‌اند»), `actions`.

| Prop | Type | Description |
|---|---|---|
| `title` | `Node` | — |
| `text` | `Node` | — |
| `players` (required) | `Array<{ name: Node; seat?: SeatNo; initials?: string; src?: string; you?: boolean; bot?: boolean; ready?: boolean }>` | — |
| `clock` | `ClockProps` | — |
| `actions` | `Node` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ReadyCheckProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- The viewer's main action is primary «آماده‌ام».
- Show the countdown; unready players are removed when it ends — say so.

**Don't**

- Do not auto-start without the countdown.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h(B.Card,{style:{maxWidth:'440px'}}, h(B.ReadyCheck,{clock:{time:18, p:0.6}, players:[{name:'نیلوفر',initials:'ن',seat:1,ready:true},{name:'آرش',initials:'آ',seat:2,ready:true},{name:'مینا',initials:'م',seat:4,you:true},{name:'کاوه',initials:'ک',seat:3}], actions:[h(B.Button,{key:1, variant:'leave'},'ترک میز'), h(B.Button,{key:2, variant:'primary', icon:'check'},'آماده‌ام')]}))
```
