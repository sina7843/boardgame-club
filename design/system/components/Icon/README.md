A lucide line icon (inner SVG embedded in the bundle) at 16, 20 or 24px.

## When to use

Inside buttons, nav items, badges, plates and states. `Bgv.iconNames` lists the embedded subset.

## Props / what the consumer provides

`name` (lucide), `size` (`sm` 16 / default 20 / `lg` 24 / px), `label` for meaningful standalone icons, `mirror` for directional icons in RTL.

| Prop | Type | Description |
|---|---|---|
| `name` (required) | `IconName` | Lucide icon name. |
| `size` | `'sm' \| 'md' \| 'lg' \| number` | sm 16, md 20 (default), lg 24, or px. |
| `label` | `string` | Accessible name; omit for decorative icons (aria-hidden). |
| `mirror` | `boolean` | Mirror horizontally (directional icons in RTL, e.g. "send"). |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `IconProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Decorative by default (`aria-hidden`); pass `label` when the icon alone carries meaning.
- Use `arrow-right` for «بازگشت» and `chevron-left` for «بعدی» (RTL).
- Stroke inherits `currentColor`, so colour via the parent token (`--text-muted`, `--heading`).

**Don't**

- Never use emoji as icons (emoji only in chat, reactions and quick chat).
- Do not mix icon families or fill styles.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  row.apply(null, ['house','dices','layout-grid','users','message-circle','bell','trophy','coins','settings','life-buoy','book-open','search','clock','hourglass','alarm-clock','crown','bot','eye','wifi-off','gift'].map(function(n){return h('span',{key:n,title:n,style:{display:'grid',placeItems:'center',width:'40px',height:'40px',borderRadius:'8px',background:'var(--surface)',border:'1px solid var(--line)',color:'var(--heading)'}}, h(B.Icon,{name:n}));})),
  row(h(B.Icon,{name:'star',size:'sm'}), h(B.Icon,{name:'star'}), h(B.Icon,{name:'star',size:'lg'}), h(B.Icon,{name:'star',size:32}), cap('۱۶، ۲۰، ۲۴ و ۳۲ پیکسل'))
)
```
