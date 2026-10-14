A small floating panel anchored to a control, for short interactive content.

## When to use

Quick player info, emoji picker, colour pickers, clock rules explanation.

## Props / what the consumer provides

`title`, `children`. Position it yourself relative to the trigger.

| Prop | Type | Description |
|---|---|---|
| `title` | `Node` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `PopoverProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Keep it focused on one task.
- Close on outside click and Esc.

**Don't**

- Do not put long forms in a popover; use a Sheet or Dialog.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(
  h(B.Popover,{title:'قانون زمان این میز', style:{maxWidth:'280px'}}, h('p',{className:'t-body-sm'},'هر بازیکن ۵ دقیقه بانک زمان دارد و با هر حرکت ۵ ثانیه اضافه می‌گیرد.'), h(B.Clock,{size:'chip', time:300, sub:'+۵ ثانیه'})),
  h(B.Popover,null, h(B.ReactionBar,{style:{boxShadow:'none', border:0}}))
)
```
