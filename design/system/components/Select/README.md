A labelled native select with the BGV chevron.

**Material (v2.1.5):** the closed field is a field like `TextField`. The open list is a floating board like `Menu` (1px line, hard 6px shadow) with 44px rows; hover and keyboard focus use the ghost tint (focus also gets the focus ring), and the chosen option sits on the navy selection token with a check (cream in dark). The chevron turns up while the list is open.

This uses the customizable select (`appearance: base-select`, Chrome and Edge 135+), so it stays a real `<select>`: keyboard, forms and screen readers work as before. Browsers without it (Firefox, Safari for now) show their own list; the closed field looks the same everywhere. Use `<select class="bgv-select">` inside `.bgv-select-wrap`; do not build a fake dropdown out of divs.

## When to use

Bot difficulty, turn time, language, sort order — any single choice from more than four options.

## Props / what the consumer provides

`options` as strings or `{value,label,disabled}`; `label`, `hint`, `error`. Other props go to the `<select>`.

| Prop | Type | Description |
|---|---|---|
| `options` (required) | `Array<string \| { value: string; label: string; disabled?: boolean }>` | Options; strings or {value,label}. |
| `label` | `Node` | Visible label (always give one; placeholder is not a label). |
| `hint` | `Node` | Helper text under the control. |
| `error` | `Node` | Error text: turns the field crimson, sets aria-invalid, replaces hint. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element (form controls: to the control; `className`/`style` to the field wrapper). Types: `SelectProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use a `Segmented` control instead when there are 2–4 options visible at once.
- Write option labels the way they read on the table: «۶۰ ثانیه»، «۲۴ ساعت».

**Don't**

- Do not use a select for navigation.
- Do not leave the first option empty without a label like «انتخاب کنید».

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{display:'flex', flexWrap:'wrap', gap:'12px', alignItems:'flex-start'}},
  h('div',{style:{minWidth:'220px',flex:1}}, h(B.Select,{label:'زمان هر نوبت', defaultValue:'60', options:[{value:'30',label:'۳۰ ثانیه'},{value:'60',label:'۶۰ ثانیه'},{value:'120',label:'۲ دقیقه'},{value:'86400',label:'۲۴ ساعت (نوبتی)'}], hint:'برای میز زنده'})),
  h('div',{style:{minWidth:'220px',flex:1}}, h(B.Select,{label:'سطح ربات', options:['آسان','متوسط','سخت'], defaultValue:'متوسط'}))
)
```
