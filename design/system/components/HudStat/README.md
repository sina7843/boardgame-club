A compact stat: icon or resource swatch, value, label and an animated delta.

## When to use

Secondary stats in player cards, resources in the action dock (tile form), player-detail sheets.

## Props / what the consumer provides

`icon` or `resource` (colour), `value`, `label`, `delta`, `tile`.

| Prop | Type | Description |
|---|---|---|
| `icon` | `IconName` | Icon name (or use `resource`). |
| `resource` | `string` | Resource swatch colour (game art may use literal colours). |
| `value` (required) | `Node` | — |
| `label` | `Node` | — |
| `delta` | `number \| string` | Change since last turn; animated pop. |
| `tile` | `boolean` | Tile form for the action dock (label over big number). |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `HudStatProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use the 1–3 stats that matter for that game (Catan: VP, cards, knights; Gaia: power, ore, credits).
- Resource swatches may use literal game-art colours; always add the label.

**Don't**

- Do not show a swatch without its name somewhere (label or tooltip).

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  row(h(B.HudStat,{icon:'star', value:7, label:'امتیاز', delta:2}), h(B.HudStat,{icon:'layers', value:5, label:'کارت'}), h(B.HudStat,{icon:'swords', value:2, label:'شوالیه', delta:-1}), h(B.HudStat,{resource:'#2F6B3A', value:3, label:'چوب'}), h(B.HudStat,{resource:'#B9573A', value:1, label:'آجر'})),
  row(h(B.HudStat,{tile:true, resource:'#2F6B3A', value:3, label:'چوب'}), h(B.HudStat,{tile:true, resource:'#B9573A', value:1, label:'آجر'}), h(B.HudStat,{tile:true, resource:'#8DBF4E', value:4, label:'گوسفند', delta:2}), h(B.HudStat,{tile:true, resource:'#E3B93C', value:2, label:'گندم'}), h(B.HudStat,{tile:true, resource:'#8A8F98', value:0, label:'سنگ'})),
  felt({style:{padding:'12px'}}, row(h(B.HudStat,{icon:'star', value:7, label:'امتیاز'}), h(B.HudStat,{icon:'zap', value:12, label:'قدرت', delta:3})))
)
```
