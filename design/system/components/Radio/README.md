A radio button with a label, used inside a group for one choice.

**Material (v2.0):** the ring is a well (`--field-edge`); the chosen dot is navy.

## When to use

Table type (دوستانه / رتبه‌ای), payment method, report reason.

## Props / what the consumer provides

`label`, optional `hint`; give radios in a group the same `name`. Wrap the group in a `fieldset` or a `role="radiogroup"` with a label.

| Prop | Type | Description |
|---|---|---|
| `label` | `Node` | Label text next to the box. |
| `hint` | `Node` | Second line, muted. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element (form controls: to the control; `className`/`style` to the field wrapper). Types: `RadioProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use radios when the options need a second explanatory line.
- Pre-select the safest option.

**Don't**

- Do not use a single radio on its own; use a Checkbox.
- Do not use radios for 2–3 short options in dense UI; `Segmented` is more compact.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{role:'radiogroup','aria-label':'نوع میز', style:{display:'grid', gap:'4px'}},
  h(B.Radio,{name:'t', label:'دوستانه', hint:'روی رتبه اثری ندارد', defaultChecked:true}),
  h(B.Radio,{name:'t', label:'رتبه‌ای', hint:'برد و باخت در لیگ حساب می‌شود'})
)
```
