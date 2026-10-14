A felt plate for shared/team state: a gold label and resources with counts or pips.

## When to use

Co-op games (Hanabi hint/fuse tokens, The Mind lives/stars), table direction in UNO, team scores.

## Props / what the consumer provides

`label`, `resources` ({icon,label,value,of,tone}) — with `of` the value renders as pips, `children`.

| Prop | Type | Description |
|---|---|---|
| `label` | `Node` | Gold label, e.g. «تیم» or «جهت». |
| `resources` | `Array<{ icon?: IconName; label?: Node; value: number; of?: number; tone?: string }>` | Shared resources; with `of` they render pips («۵/۸»). |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `TeamPlateProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use pips for small fixed pools (≤8).
- Spell out what the tokens are («راهنما», «فیوز»).

**Don't**

- Do not put per-player info here; use PlayerCards.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
felt(null, col(
  h(B.TeamPlate,{label:'تیم', resources:[{icon:'info', label:'راهنما', value:5, of:8},{icon:'flame', label:'فیوز', value:1, of:3, tone:'var(--clock-on-felt-critical)'},{icon:'layers', label:'دسته', value:23}]}),
  h(B.TeamPlate,{label:'جهت'}, h(B.Icon,{name:'rotate-ccw', size:'sm'}), 'ساعتگرد')
))
```
