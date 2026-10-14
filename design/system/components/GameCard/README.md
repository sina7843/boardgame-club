A catalog tile: 16:9 cover, flags, Persian title with Latin original, meta line.

## When to use

Catalog grids, home carousels, «ادامهٔ بازی» rows, tournament pages.

## Props / what the consumer provides

`cover` (480×270 webp from the covers kit) or `art`, `title`, `latin`, `meta` (text or `{icon,text}`), `flags` (Badge props + `label`), `href`.

| Prop | Type | Description |
|---|---|---|
| `cover` | `string` | 480×270 cover URL. |
| `art` | `Node` | Node shown when there is no cover. |
| `title` (required) | `Node` | Persian game name. |
| `latin` | `string` | Latin original name (Manrope). |
| `meta` | `Array<Node \| { icon?: IconName; text: Node }>` | Meta items: text or {icon,text}; separated by space, never «·». |
| `flags` | `Array<Node \| (BadgeProps & { label: Node })>` | Badges on the cover: Badge props (+label) or nodes. |
| `href` | `string` | — |
| `footer` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `GameCardProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use the provided cover files; only the 22 listed covers exist.
- Meta: players, time, pace — with icons, Persian digits, no «·».

**Don't**

- Do not crop covers to other ratios.
- Do not put more than two flags on a cover.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:'12px', maxWidth:'560px'}},
  h(B.GameCard,{href:'#', cover:'covers/catan.webp', title:'کاتان', latin:'Catan', flags:[{tone:'premium', icon:'flame', label:'محبوب'}], meta:[{icon:'users',text:'۳ تا ۴ نفر'},{icon:'clock',text:'۶۰ دقیقه'}]}),
  h(B.GameCard,{href:'#', art:h('div',{style:{position:'absolute', inset:0, display:'grid', placeItems:'center', background:'var(--felt)', color:'var(--felt-gold)'}}, h(B.Icon,{name:'layers', size:48})), title:'اونو', latin:'UNO', flags:[{tone:'success', icon:'zap', label:'۱۲ میز باز'}], meta:[{icon:'users',text:'۲ تا ۱۰ نفر'},{icon:'clock',text:'۱۵ دقیقه'}]})
)
```
