A bottom sheet (phones, radius 28) or side sheet (desktop) with handle, heading, scrollable body and footer.

## When to use

Player detail from the HUD (mirrors what the real game shows for that player), filters, quick chat on phones, the chat panel below 1200px, shop item purchase.

## Props / what the consumer provides

`title`, `icon`, `children`, `footer`, `onClose`, `side`, `handle`.

| Prop | Type | Description |
|---|---|---|
| `side` | `boolean` | Desktop side panel (all corners rounded, no handle). |
| `title` | `Node` | — |
| `icon` | `IconName` | — |
| `footer` | `Node` | — |
| `onClose` | `() => void` | — |
| `handle` | `boolean` | Show the drag handle (bottom sheets). Default true. |
| `closeLabel` | `string` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `SheetProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- On phones keep the board visible above (half height).
- Put the main action in the footer; the staying/neutral action is secondary.
- Everything inside keeps the 20px body padding: identity rows, stat tiles and frames never touch the sheet edge.

**Don't**

- Do not nest sheets.
- Do not remove the handle on bottom sheets.
- Do not size inner grids with fixed widths; tiles use `minmax(0, 1fr)`.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(
  h(B.Sheet,{title:'آرش', onClose:function(){}, style:{width:'340px'}, footer:[h(B.Button,{key:1, variant:'secondary', icon:'message-circle'},'پیام'), h(B.Button,{key:2, variant:'primary', icon:'user-plus', style:{flex:1}},'درخواست دوستی')]},
    h(B.Identity,{name:'آرش', initials:'آ', seat:2, frame:'diamond', league:'diamond', title:'کهنه‌کار', level:33}),
    h('div',{style:{display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:'8px'}}, h(B.HudStat,{tile:true, icon:'star', label:'امتیاز', value:7}), h(B.HudStat,{tile:true, icon:'map', label:'جاده', value:9}), h(B.HudStat,{tile:true, icon:'swords', label:'شوالیه', value:2}))),
  h(B.Sheet,{side:true, title:'فیلترها', icon:'sliders-horizontal', onClose:function(){}, style:{width:'300px'}},
    h(B.Segmented,{block:true, options:['زنده','نوبتی']}), h(B.Checkbox,{label:'فقط دوستانه', defaultChecked:true}))
)
```
