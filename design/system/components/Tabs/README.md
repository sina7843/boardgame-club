Underline tabs (role="tablist") for sections of one object.

## When to use

Game detail «قوانین / میزها / رتبه‌بندی», profile sections, club pages.

## Props / what the consumer provides

`items` ({value,label,icon,count}), `value`/`defaultValue`, `onChange`.

| Prop | Type | Description |
|---|---|---|
| `items` (required) | `Array<{ value: string; label: Node; icon?: IconName; count?: number; countTone?: BadgeProps['tone'] }>` | — |
| `value` | `string` | — |
| `defaultValue` | `string` | — |
| `onChange` | `(value: string) => void` | — |
| `label` | `string` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `TabsProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Pair with `role="tabpanel"` content.
- Use icons sparingly.

**Don't**

- Do not nest tabs inside tabs.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.Tabs,{label:'کاتان', items:[{value:'r',label:'قوانین'},{value:'t',label:'میزهای باز',count:12},{value:'k',label:'رتبه‌بندی'},{value:'h',label:'تاریخچه'}], defaultValue:'t'}),
  h(B.Tabs,{label:'پروفایل', items:[{value:'a',label:'بازی‌ها',icon:'dices'},{value:'b',label:'جام‌ها',icon:'trophy'},{value:'c',label:'دوستان',icon:'users'}]})
)
```
