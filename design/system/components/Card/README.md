A board-like surface (radius 20, line border, soft float) with an optional heading row.

**Material (v2.0): board** — `--line` + a 3px hard edge in the line colour (the printed card's thickness), no blur. `interactive` cards lift 2px on hover (pointer only, hard 6px shadow) and land again on press.

## When to use

Dashboard sections, settings groups, side columns of content (`.bgv-cols`), lists (`flush`), clickable summaries (`interactive`).

## Props / what the consumer provides

`title`, `actions` (heading row), `raised`, `flush`, `interactive`, `as`, `children`.

| Prop | Type | Description |
|---|---|---|
| `raised` | `boolean` | surface-raised background. |
| `flush` | `boolean` | No padding, clips children (lists, tables, covers). |
| `interactive` | `boolean` | Hover lift 2px (pointer only), lands on press; focusable when onClick is given. |
| `title` | `Node` | Card heading. |
| `actions` | `Node` | Nodes at the end of the heading row. |
| `as` | `string` | Root element. Default "section". |
| `onClick` | `React.MouseEventHandler` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `CardProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use `flush` for lists and tables so rows touch the edges.
- Use `raised` for nested emphasis, not for every card.

**Don't**

- Do not nest cards more than one level.
- Do not add custom shadows; `--shadow-card` is built in.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(
  h(B.Card,{title:'میزهای نوبتی من', actions:h(B.Button,{size:'sm',variant:'ghost',iconEnd:'chevron-left'},'همه'), style:{flex:'2 1 300px'}}, h('p',{className:'t-body-sm bgv-muted'},'۲ میز منتظر حرکت شماست؛ کاتان تا ۵ ساعت دیگر.')),
  h(B.Card,{raised:true, style:{flex:'1 1 200px'}}, h(B.Stat,{label:'برد این فصل', value:38, delta:4})),
  h(B.Card,{interactive:true, onClick:function(){}, style:{flex:'1 1 200px'}}, h('b',{style:{color:'var(--heading)'}},'تورنمنت آخر هفته'), h('p',{className:'t-caption bgv-muted'},'جمعه، ۲۱ مهر'))
)
```
