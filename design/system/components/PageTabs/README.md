Segmented-style tabs that switch between sub-pages or views within a page.

## When to use

My tables «زنده / نوبتی / تمام‌شده», notifications filters, shop sections.

## Props / what the consumer provides

`items` ({value,label,href,count}), `value`/`defaultValue`, `onChange`.

| Prop | Type | Description |
|---|---|---|
| `items` (required) | `Array<{ value: string; label: Node; href?: string; count?: number }>` | — |
| `value` | `string` | — |
| `defaultValue` | `string` | — |
| `onChange` | `(value: string) => void` | — |
| `label` | `string` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `PageTabsProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use counts in Persian digits.
- Keep 2–5 tabs; scrolls horizontally on phones.

**Don't**

- Do not use for in-form choices; use `Segmented`.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.PageTabs,{label:'میزهای من', items:[{value:'live',label:'زنده',count:1},{value:'turn',label:'نوبتی',count:7},{value:'done',label:'تمام‌شده'}], defaultValue:'turn'}),
  h(B.PageTabs,{label:'فروشگاه', items:[{value:'a',label:'آواتار'},{value:'f',label:'قاب'},{value:'c',label:'پشت کارت'},{value:'b',label:'صفحهٔ بازی'}]})
)
```
