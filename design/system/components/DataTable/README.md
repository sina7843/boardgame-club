A simple data table with column config, Persian digits and the viewer row highlighted.

## When to use

Rankings, score sheets after a game, transactions, admin lists.

## Props / what the consumer provides

`columns` ({key,label,align,width,strong,render}), `rows`, `youRow` (index/predicate or rows with `you:true`), `selectedRow`, `caption`.

| Prop | Type | Description |
|---|---|---|
| `columns` (required) | `DataTableColumn<Row>[]` | — |
| `rows` (required) | `Row[]` | — |
| `youRow` | `number \| ((row: Row, i: number) => boolean)` | Row index, predicate, or rows with `you: true` → coral-soft highlight. |
| `selectedRow` | `number` | — |
| `caption` | `string` | Screen-reader caption. |
| `rowKey` | `string` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `DataTableProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Highlight the viewer row (coral-soft `--invite-soft`) and also write «شما».
- Right-align text naturally (RTL), end-align numbers.

**Don't**

- Do not zebra-stripe; rows are separated by `--line`.
- Do not use tables for layout.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h(B.Card,{flush:true}, h(B.DataTable,{caption:'رتبه‌بندی لیگ طلا', columns:[
    {key:'rank', label:'رتبه', strong:true, width:'64px'},
    {key:'name', label:'بازیکن', render:function(r){return h(B.Identity,{name:r.name, initials:r.name.charAt(0), size:'sm', you:r.you, title:r.title});}},
    {key:'league', label:'لیگ', render:function(r){return h(B.League,{tier:r.league});}},
    {key:'score', label:'امتیاز', align:'end', strong:true}],
  rows:[{rank:1,name:'نیلوفر',title:'رستم دستان',league:'master',score:1982},{rank:2,name:'آرش',title:'کهنه‌کار',league:'diamond',score:1844},{rank:128,name:'مینا',title:'شب‌زنده‌دار',league:'gold',score:1584,you:true}]}))
```
