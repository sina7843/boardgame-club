Standings bars: who leads at a glance, by seat colour + glyph + name.

## When to use

Desktop rail under the player cards; result screens; tournament tables.

## Props / what the consumer provides

`rows` in rank order ({seat,name,value,p,you}), `max` (target or scale), `label`.

| Prop | Type | Description |
|---|---|---|
| `rows` (required) | `Array<{ seat: SeatNo; name: Node; value: number \| string; p?: number; you?: boolean }>` | Rows in rank order. `p` 0–1 bar length (auto from value/max). |
| `max` | `number` | Target or scale maximum. |
| `label` | `string` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `RaceProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Mark the viewer with `you` («(شما)» after the name).
- Use the game target as `max` («هدف ۵۰۰»).

**Don't**

- Do not drop names; bars alone are colour-only.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h(B.Card,{title:'امتیاز مسابقه', actions:h(B.Tag,null,'هدف ۵۰۰'), style:{maxWidth:'320px', padding:'14px'}},
  h(B.Race,{max:500, rows:[{seat:4,name:'نیلوفر',value:210},{seat:2,name:'سارا',value:185},{seat:6,name:'ربات',value:150},{seat:1,name:'آرش',value:120},{seat:5,name:'مینا',value:95,you:true},{seat:3,name:'کاوه',value:40}]}))
```
