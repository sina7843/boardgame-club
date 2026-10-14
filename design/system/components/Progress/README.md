A sunken track with a filled bar, label and value text.

## When to use

XP to next level, season pass, mission progress, upload progress.

## Props / what the consumer provides

`value` 0–1, `label`, `valueText`, `tone` (`primary`, `accent` for XP/rewards, `invite` for your share).

| Prop | Type | Description |
|---|---|---|
| `value` (required) | `number` | 0–1. |
| `label` | `Node` | — |
| `valueText` | `Node` | Right-hand value text, e.g. «۹۶۰ از ۱٬۲۰۰». |
| `tone` | `'primary' \| 'invite' \| 'accent'` | primary (default), invite (you), accent (XP/rewards). |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ProgressProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Always show the numbers: «۹۶۰ از ۱٬۲۰۰».
- Use `accent` (gold) for XP and rewards.

**Don't**

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
