An opaque dark plate sunk into the felt for public info: piles, active colour, longest road, last move.

**Material (v2.0):** an opaque plate printed into the felt (`--felt-plate`, hard `--shadow-plate`) — never translucent.

## When to use

Around the board or cards on the felt.

## Props / what the consumer provides

`icon`, `seat`, `label`, `value` (bold number), `children`.

| Prop | Type | Description |
|---|---|---|
| `icon` | `IconName` | — |
| `seat` | `SeatNo` | — |
| `label` | `Node` | — |
| `value` | `Node` | Bold number. |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `FeltPlateProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Keep each plate to one fact.
- Name players with seat glyph + name.

**Don't**

- Do not use plates off the felt.
- Do not put buttons inside plates.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
felt(null, h('div',{className:'bgv-felt-row', style:{justifyContent:'flex-start'}},
  h(B.FeltPlate,{icon:'layers', label:'دسته', value:48}),
  h(B.FeltPlate,{label:'رنگ فعال:', value:'آبی'}, h('span',{style:{width:'12px', height:'12px', borderRadius:'50%', background:'#2862C9', boxShadow:'0 0 0 2px var(--felt-ink)'}})),
  h(B.FeltPlate,{seat:2}, h('span',null, h('b',null,'سارا'), ' ۷ آبی گذاشت و «اونو!» گفت')),
  h(B.FeltPlate,{label:'دست', value:2}, ' از مسابقهٔ ۵۰۰ امتیازی')))
```
