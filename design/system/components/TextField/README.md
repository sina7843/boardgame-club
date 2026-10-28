A labelled single-line input with optional prefix icon, trailing node, hint and error.

**Material (v2.0):** a well — a hard 2px inner edge (`--shadow-field`) and a 1px `--field-edge` (3.5:1, WCAG 1.4.11).

## When to use

Usernames, search, table names, club names, coupon codes. Use `PhoneField` for mobile numbers and `OtpField` for login codes.

## Props / what the consumer provides

`label` (always), `hint`, `error`, `icon` (prefix), `end` (trailing node). Every other prop (value, onChange, placeholder, maxLength, disabled…) goes to the `<input>`; `className`/`style` go to the field wrapper.

| Prop | Type | Description |
|---|---|---|
| `icon` | `IconName` | Prefix icon inside the field (e.g. "search"). |
| `end` | `Node` | Trailing node inside the field (e.g. a ghost icon Button). |
| `label` | `Node` | Visible label (always give one; placeholder is not a label). |
| `hint` | `Node` | Helper text under the control. |
| `error` | `Node` | Error text: turns the field crimson, sets aria-invalid, replaces hint. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element (form controls: to the control; `className`/`style` to the field wrapper). Types: `TextFieldProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Always give a visible Persian `label`; placeholders are examples («میپل‌باز»), not labels.
- Write `error` as the fix: «نام کاربری باید ۲ تا ۲۴ حرف باشد».
- Inputs are 44px (`--control-md`) with `--shadow-field`; keep 16px text so iOS does not zoom.

**Don't**

- Do not show an error before the user leaves the field or submits.
- Do not put Latin digits in hints; use Persian digits.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.TextField,{label:'نام کاربری', placeholder:'میپل‌باز', hint:'۲ تا ۲۴ حرف؛ بعداً هم می‌توانید عوضش کنید'}),
  h(B.TextField,{label:'جست‌وجو', icon:'search', placeholder:'نام بازی یا بازیکن', defaultValue:'کاتان'}),
  h(B.TextField,{label:'نام میز', defaultValue:'ک', error:'نام میز باید دست‌کم ۲ حرف باشد'})
)
```
