The row of emoji reaction counts under a message; yours are the navy selection tile.

**Material (v2.1): small tokens**; others are the white token with a soft `--ink-btn` frame (#A1AAB1 in light, v2.1.11; #4A6476 in dark, v2.1.12); your own reaction is the same token filled navy with a deeper ink (`aria-pressed`, cream in dark). 30px tall with an 8px gap; the hit area grows to 44px.

## When to use

Under chat messages.

## Props / what the consumer provides

`items` ({emoji,count,mine}), `onToggle`, `onAdd` (shows an add button).

| Prop | Type | Description |
|---|---|---|
| `items` (required) | `Array<{ emoji: string; count: number; mine?: boolean; label?: string }>` | — |
| `onToggle` | `(emoji: string) => void` | — |
| `onAdd` | `() => void` | Shows an add-reaction button. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ReactionsProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Toggle your own reaction on tap.
- Counts in Persian digits.

**Don't**

- Do not show more than ~6 distinct reactions; collapse into the add button.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(h(B.Reactions,{items:[{emoji:'😂',count:3,mine:true},{emoji:'👍',count:2},{emoji:'🔥',count:1}], onAdd:function(){}}), h(B.Reactions,{items:[{emoji:'👏',count:12}]}))
```
