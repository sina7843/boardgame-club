The seat marker: a colour AND a glyph for seats 1–10 (circle, square, triangle, diamond, star, pentagon, plus, hexagon, down-triangle, crescent).

## When to use

Before every player name at the table, in chat meta, move logs, race rows, plates on the felt.

## Props / what the consumer provides

`n` 1–10, `size` (`lg` 22px), `label` (`true` announces «صندلی ۳، قرمز، مثلث»).

| Prop | Type | Description |
|---|---|---|
| `n` (required) | `SeatNo` | Seat 1–10 (colour + glyph). |
| `size` | `'md' \| 'lg'` | md 16px, lg 22px. |
| `label` | `boolean \| string` | true = announce «صندلی ۳، قرمز، مثلث»; string = custom; default decorative. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `SeatProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Always put the seat glyph next to the player name; colour-blind players rely on the shape.
- Use the same seat number for a player across HUD, chat and log.

**Don't**

- Do not use the seat colour alone (e.g. a coloured name) to identify a player.
- Do not recolour seats; they come from `--seat-1…10`.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  row.apply(null, [1,2,3,4,5,6,7,8,9,10].map(function(n){return h('span',{key:n, style:{display:'inline-flex',alignItems:'center',gap:'6px',fontSize:'13px'}}, h(B.Seat,{n:n, size:'lg', label:true}), B.fa(n));})),
  felt({style:{padding:'12px'}}, row.apply(null, [1,2,3,4,5,6,7,8,9,10].map(function(n){return h(B.Seat,{key:n, n:n, size:'lg'});})))
)
```
