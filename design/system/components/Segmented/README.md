A sunken track of 2–4 mutually exclusive options (radiogroup).

## When to use

Pace «زنده / نوبتی», view toggles «فهرست / شبکه», time ranges «هفته / ماه / فصل».

## Props / what the consumer provides

`options` (strings or `{value,label,icon}`), `value`/`defaultValue`, `onChange`, `block` for full width, `label` for screen readers.

| Prop | Type | Description |
|---|---|---|
| `options` (required) | `Array<string \| { value: string; label: Node; icon?: IconName; disabled?: boolean }>` | 2–4 options. |
| `value` | `string` | — |
| `defaultValue` | `string` | — |
| `onChange` | `(value: string) => void` | — |
| `block` | `boolean` | Stretch to full width. |
| `label` | `string` | Accessible name of the radiogroup. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `SegmentedProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Keep labels to one or two words.
- Use `block` inside sheets and phone forms.

**Don't**

- Do not exceed four options.
- Do not use for page navigation; use `PageTabs`.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.Segmented,{label:'سرعت', options:['زنده','نوبتی']}),
  h(B.Segmented,{label:'بازه', block:true, options:[{value:'w',label:'هفته'},{value:'m',label:'ماه'},{value:'s',label:'فصل'}], defaultValue:'m'}),
  h(B.Segmented,{label:'نما', options:[{value:'l',label:'فهرست',icon:'list'},{value:'g',label:'شبکه',icon:'layout-grid'}], defaultValue:'g'})
)
```
