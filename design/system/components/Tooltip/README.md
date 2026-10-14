A small ink bubble that explains an icon or abbreviation on hover/focus.

## When to use

Icon-only buttons on desktop, HUD stat icons, truncated names.

## Props / what the consumer provides

`content` and a `trigger` element (shows on hover/focus), or just `children` to render the bubble inline; `open` forces it; `placement`.

| Prop | Type | Description |
|---|---|---|
| `content` | `Node` | Tooltip text (or children when there is no trigger). |
| `trigger` | `React.ReactElement` | Element that shows the tooltip on hover/focus. Without it, the bubble renders inline. |
| `open` | `boolean` | Force open. |
| `placement` | `'top' \| 'bottom'` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `TooltipProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Keep it to one short sentence.
- Also give the trigger an `aria-label`; tooltips are not the only label.

**Don't**

- Do not put actions or links inside a tooltip; use `Popover`.
- Do not rely on tooltips on touch devices.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(
  h('div',{style:{paddingTop:'44px', paddingInline:'48px'}}, h(B.Tooltip,{open:true, content:'صدا و لرزش', trigger:h(B.Button,{iconOnly:true, icon:'volume-2', variant:'ghost'},'صدا و لرزش')})),
  h(B.Tooltip,null,'۳ اخطار = حذف از میز'),
  h(B.Tooltip,null,'روی هر بازیکن بزنید تا آمار کاملش را ببینید')
)
```
