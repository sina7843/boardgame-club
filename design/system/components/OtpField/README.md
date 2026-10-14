Six single-digit boxes for the SMS login code, LTR, with an invalid state.

## When to use

Login step 2 after the mobile number (+98), and confirming a changed number.

## Props / what the consumer provides

`length` (default 6), `value`/`defaultValue`, `onChange`, `onComplete`, `invalid`. Typed digits (Latin or Persian) display as Persian digits.

| Prop | Type | Description |
|---|---|---|
| `length` | `number` | Number of digits. Default 6. |
| `value` | `string` | Controlled code (Latin or Persian digits). |
| `defaultValue` | `string` | — |
| `invalid` | `boolean` | Wrong code: crimson boxes. |
| `onChange` | `(code: string) => void` | — |
| `onComplete` | `(code: string) => void` | Called once all digits are filled. |
| `label` | `string` | Group accessible name. Default «کد ۶ رقمی». |
| `disabled` | `boolean` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `OtpFieldProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Autofocus the first box and submit on `onComplete`.
- Pair `invalid` with a hint in crimson: «کد درست نیست؛ دوباره امتحان کنید».

**Don't**

- Do not split into boxes with dashes or spaces.
- Do not clear the code silently on error.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.OtpField,{defaultValue:'482', label:'کد تأیید'}),
  h(B.OtpField,{defaultValue:'482915', invalid:true, label:'کد تأیید نادرست'}),
  h('span',{className:'bgv-hint bgv-hint--error', style:{justifyContent:'center'}}, 'کد درست نیست؛ دوباره امتحان کنید')
)
```
