A labelled big number with an optional signed delta (arrow + colour + sign).

## When to use

Profile stats, progress pages, wallet, admin dashboards.

## Props / what the consumer provides

`label`, `value`, `delta` (number → signed with arrow), `deltaDir` for strings, `deltaText`.

| Prop | Type | Description |
|---|---|---|
| `label` (required) | `Node` | — |
| `value` (required) | `Node` | — |
| `delta` | `number \| string` | Change; number → signed, arrow icon, green/crimson. |
| `deltaDir` | `'up' \| 'down'` | Force direction for string deltas. |
| `deltaText` | `Node` | Muted words after the delta («این هفته»). |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `StatProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Keep labels short: «برد این فصل», «ریتینگ کاتان».
- Always show the sign and arrow; colour is never alone.

**Don't**

- Do not use Latin digits or «·» separators.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(
  h(B.Stat,{label:'ریتینگ کاتان', value:1501, delta:19, deltaText:'امروز'}),
  h(B.Stat,{label:'برد این فصل', value:38, delta:4}),
  h(B.Stat,{label:'رتبه در لیگ', value:128, delta:-6, deltaText:'این هفته'})
)
```
