A circular progress ring with content in the middle.

## When to use

Level-up celebrations, completion of a collection, daily streaks.

## Props / what the consumer provides

`value` 0–1, `size`, `width`, `tone`, `label`, `children` (number/label in the middle).

| Prop | Type | Description |
|---|---|---|
| `value` (required) | `number` | 0–1. |
| `size` | `number` | Diameter px. Default 48. |
| `width` | `number` | Track width px. |
| `tone` | `'primary' \| 'accent' \| 'invite' \| 'success' \| 'warning' \| 'danger' \| 'info' \| string` | Fill colour token name or CSS colour. |
| `label` | `string` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `RingProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Put a number and a one-word label inside.
- Use `accent` for levels, `primary` for completion.

**Don't**

- Do not use a ring as a game clock; `Clock` carries clock states.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(
  h(B.Ring,{value:0.75, size:72, tone:'accent', label:'سطح ۱۲'}, h('b',{className:'t-num-md', style:{color:'var(--heading)'}}, B.fa(12))),
  h(B.Ring,{value:0.4, size:56, label:'کلکسیون'}, h('span',{className:'t-micro'}, '۴۰٪')),
  h(B.Ring,{value:1, size:48, tone:'success', label:'تمام'}, h(B.Icon,{name:'check', size:'sm'}))
)
```
