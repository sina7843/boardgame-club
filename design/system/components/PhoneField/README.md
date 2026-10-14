A mobile-number field with the fixed «+98» prefix, LTR digits, label, hint and error.

## When to use

Login and sign-up (mobile number + 6-digit code), account settings.

## Props / what the consumer provides

`label`, `hint`, `error`, optional `prefix` (default "+98"); other props go to the `<input type="tel">`.

| Prop | Type | Description |
|---|---|---|
| `prefix` | `string` | Country prefix shown in Manrope. Default "+98". |
| `label` | `Node` | Visible label (always give one; placeholder is not a label). |
| `hint` | `Node` | Helper text under the control. |
| `error` | `Node` | Error text: turns the field crimson, sets aria-invalid, replaces hint. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element (form controls: to the control; `className`/`style` to the field wrapper). Types: `PhoneFieldProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Accept both Persian and Latin digits and strip a leading 0.
- Hint: «کد ۶ رقمی به این شماره پیامک می‌شود».

**Don't**

- Do not ask for the country code in the input itself.
- Do not render the number RTL; the field is LTR by design.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.PhoneField,{label:'شمارهٔ موبایل', defaultValue:'۹۱۲ ۳۴۵ ۶۷۸۹', hint:'کد ۶ رقمی به این شماره پیامک می‌شود'}),
  h(B.PhoneField,{label:'شمارهٔ موبایل', defaultValue:'۹۱۲ ۳۴', error:'شماره باید ۱۰ رقم باشد'})
)
```
