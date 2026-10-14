A labelled range input with the current value spelled out.

## When to use

Turn time in Create Table, sound volume, bot think delay.

## Props / what the consumer provides

All `<input type="range">` props (min, max, step, value, onChange), plus `label`, `valueText` (shown and announced) and `hint`.

| Prop | Type | Description |
|---|---|---|
| `label` | `Node` | — |
| `valueText` | `string` | Current value as words, e.g. «۶۰ ثانیه». Shown and announced. |
| `hint` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element (form controls: to the control; `className`/`style` to the field wrapper). Types: `SliderProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Always show the value as words: «۶۰ ثانیه».
- Snap to meaningful steps (15s, 30s, 60s…).

**Don't**

- Do not use a slider when users need an exact value they will type.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.Slider,{label:'زمان هر نوبت', min:15, max:300, step:15, defaultValue:60, valueText:'۶۰ ثانیه', hint:'میز زنده: ۱۵ ثانیه تا ۵ دقیقه'}),
  h(B.Slider,{label:'صدای هشدار', min:0, max:100, defaultValue:70, valueText:'۷۰٪'})
)
```
