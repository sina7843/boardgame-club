A 22px checkbox with a label, optionally with a muted second line.

**Material (v2.0):** unchecked = a well (`--field-edge` 3.5:1, hard inner edge); checked = a flat navy fill with a cream tick.

## When to use

Agreements, multi-select settings, «فقط میزهای دوستانه» filters.

## Props / what the consumer provides

`label`, optional `hint`; other props (checked, defaultChecked, onChange, disabled) go to the `<input type="checkbox">`.

| Prop | Type | Description |
|---|---|---|
| `label` | `Node` | Label text next to the box. |
| `hint` | `Node` | Second line, muted. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element (form controls: to the control; `className`/`style` to the field wrapper). Types: `CheckboxProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Keep the whole label clickable (it is a `<label>`), 44px tall.
- Phrase labels positively: «نمایش میزهای پر».

**Don't**

- Do not use a checkbox for an instant on/off setting; use `Switch`.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.Checkbox,{label:'قوانین بازی منصفانه را خوانده‌ام', defaultChecked:true}),
  h(B.Checkbox,{label:'فقط میزهای دوستانه', hint:'میزهای رتبه‌ای پنهان می‌شوند'}),
  h(B.Checkbox,{label:'ربات‌ها را هم نشان بده', disabled:true})
)
```
