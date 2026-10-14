A floating list of actions with icons, separators, trailing meta and destructive items.

## When to use

Overflow «بیشتر» menus, the chat message menu (پاسخ، ویرایش، کپی، حذف، گزارش، بی‌صدا کردن), profile actions.

## Props / what the consumer provides

`items`: `{icon,label,danger,meta,onClick,disabled}` or `"-"` for a separator.

| Prop | Type | Description |
|---|---|---|
| `items` (required) | `Array<MenuItem \| '-'>` | Items; `'-'` or `{separator:true}` draws a separator. |
| `label` | `string` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `MenuProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Put destructive items last, after a separator, in crimson (`danger`).
- Use `meta` for limits like «۲ دقیقه» on «ویرایش».

**Don't**

- Do not put more than ~8 items.
- Do not colour non-destructive items.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(
  h(B.Menu,{label:'پیام', items:[{icon:'reply',label:'پاسخ'},{icon:'pencil',label:'ویرایش',meta:'۲ دقیقه'},{icon:'copy',label:'کپی'},'-',{icon:'volume-x',label:'بی‌صدا کردن آرش'},{icon:'flag',label:'گزارش',danger:true},{icon:'trash-2',label:'حذف',danger:true}]}),
  h(B.Menu,{label:'بیشتر', items:[{icon:'link',label:'کپی لینک پروفایل'},{icon:'user-plus',label:'دعوت به میز',focus:true},'-',{icon:'ban',label:'مسدود کردن',danger:true}]})
)
```
