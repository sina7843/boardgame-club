A simple data table with column config, Persian digits and the viewer row highlighted; under 600px it can fold into stacked rows (`stack`).

## When to use

Rankings, score sheets after a game, transactions, admin lists.

## Props / what the consumer provides

`columns` ({key,label,align,width,strong,render,stack}), `rows`, `youRow` (index/predicate or rows with `you:true`), `selectedRow`, `caption`, `stack`.

| Prop | Type | Description |
|---|---|---|
| `columns` (required) | `DataTableColumn<Row>[]` | — |
| `rows` (required) | `Row[]` | — |
| `youRow` | `number \| ((row: Row, i: number) => boolean)` | Row index, predicate, or rows with `you: true` → the whole row gets `--row-you` and a 3px navy bar at its start. |
| `stack` | `boolean \| 'phone'` | `.bgv-table--stack`: under 600px each row folds into lead · main · end on one line and the other cells below with their column label (`data-stack`, `data-label`). `phone` forces it (previews). |
| `selectedRow` | `number` | — |
| `caption` | `string` | Screen-reader caption. |
| `rowKey` | `string` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `DataTableProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Highlight the viewer (or selected) row: a pale tint over the **whole row** plus a 3px navy bar (cream in dark) at its start; also write «شما». Never amber.
- On phones use `stack`: give rank/icon `stack:'lead'`, the name `main`, the score `end`, and `hide` what does not matter on a phone.
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
