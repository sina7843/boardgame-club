A labelled multi-line text field with hint and error.

## When to use

Bio «دربارهٔ من», report reasons, support tickets, club descriptions.

## Props / what the consumer provides

Same contract as `TextField`: `label`, `hint`, `error`; other props go to the `<textarea>` (`rows` defaults to 4).

| Prop | Type | Description |
|---|---|---|
| `label` | `Node` | Visible label (always give one; placeholder is not a label). |
| `hint` | `Node` | Helper text under the control. |
| `error` | `Node` | Error text: turns the field crimson, sets aria-invalid, replaces hint. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element (form controls: to the control; `className`/`style` to the field wrapper). Types: `TextareaProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Show a length hint in Persian digits («۰ از ۱۶۰»).
- Keep the field resizable vertically only (default).

**Don't**

- Do not use a textarea for chat; use `Composer`.
- Do not disable paste or spellcheck.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.Textarea,{label:'دربارهٔ من', defaultValue:'عاشق کاتان و شب‌های بازی با دوستان. دنبال هم‌تیمی برای هانابی هستم.', hint:'۷۰ از ۱۶۰ حرف', rows:3}),
  h(B.Textarea,{label:'توضیح گزارش', rows:2, error:'لطفاً دست‌کم یک جمله بنویسید'})
)
```
