A wrapping or horizontally scrolling row of chips with single- or multi-select state.

## When to use

Filter bars on the catalog and open-tables pages, game-type pickers in Create Table, quick reply trays outside chat.

## Props / what the consumer provides

Either `options` (strings or `{value,label,icon,count}`) with `value`/`onChange` — pass an array value for multi-select — or your own `Chip` children. `scroll` keeps one line on phones.

| Prop | Type | Description |
|---|---|---|
| `options` | `Array<string \| { value: string; label: Node; icon?: IconName; count?: number }>` | Options rendered as chips. Omit and pass `children` for custom chips. |
| `value` | `string \| string[]` | Selected value; pass an array for multi-select. |
| `defaultValue` | `string \| string[]` | — |
| `onChange` | `(value: string \| string[]) => void` | Called with the new value (or array). |
| `scroll` | `boolean` | One horizontally scrolling row instead of wrapping. |
| `size` | `'sm' \| 'md'` | — |
| `label` | `string` | Group accessible name. |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ChipGroupProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use `scroll` on phones so filters stay on one 44px row.
- Give the group a Persian `label` («فیلتر سبک بازی») for screen readers.
- Keep the first chip «همه» when the filter can be cleared.

**Don't**

- Do not mix invite chips into a filter group.
- Do not exceed ~8 visible options; move the rest into a `Select` or a filter sheet.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.ChipGroup,{label:'سرعت بازی', options:['همه','زنده','نوبتی'], defaultValue:'زنده'}),
  h(B.ChipGroup,{label:'سبک', scroll:true, value:['کارتی','خانوادگی'], options:[{value:'کارتی',label:'کارتی',icon:'layers'},{value:'استراتژی',label:'استراتژی',icon:'swords'},{value:'خانوادگی',label:'خانوادگی',icon:'heart'},{value:'تیمی',label:'تیمی',icon:'handshake'},{value:'دونفره',label:'دونفره',icon:'users'}]})
)
```
