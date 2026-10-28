A sunken track with a filled bar, label and value text.

## When to use

XP to next level, season pass, mission progress, upload progress.

## Props / what the consumer provides

`value` 0–1, `label`, `valueText`, `tone` (`primary`, `accent`, `invite`). Every tone fills with the selection colour (navy, cream in dark): amber fill is reserved for the page's one action, the turn pill and the coin (owner decision 2.4). `accent` and `invite` stay for compatibility.

| Prop | Type | Description |
|---|---|---|
| `value` (required) | `number` | 0–1. |
| `label` | `Node` | — |
| `valueText` | `Node` | Right-hand value text, e.g. «۹۶۰ از ۱٬۲۰۰». |
| `tone` | `'primary' \| 'invite' \| 'accent'` | All three render navy (cream in dark) since v2.1.2; say whose share it is in the label. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ProgressProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Always show the numbers: «۹۶۰ از ۱٬۲۰۰».
- Name the progress in the label («سهم شما از امتیاز تیم») instead of relying on colour.

**Don't**

- Do not paint a progress bar amber.

- Do not use progress bars for time running out; use `Clock`.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.Progress,{value:0.8, label:'سطح ۱۲', valueText:'۹۶۰ از ۱٬۲۰۰', tone:'accent'}),
  h(B.Progress,{value:0.45, label:'مأموریت هفتگی: ۵ برد', valueText:'۲ از ۵'}),
  h(B.Progress,{value:0.62, label:'سهم شما از امتیاز تیم', valueText:'۶۲٪', tone:'invite'})
)
```
