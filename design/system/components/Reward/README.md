A sunken row for a reward or rating change: icon/coin, label (optionally with XP bar) and a signed value.

## When to use

Results, level-ups, mission completion, daily rewards.

## Props / what the consumer provides

`icon` or `coin`, `label`, `value` (signed number or text), `dir`, `unit`, `progress`/`progressText`.

| Prop | Type | Description |
|---|---|---|
| `icon` | `IconName` | — |
| `coin` | `boolean` | Coin glyph instead of an icon. |
| `label` (required) | `Node` | — |
| `value` | `number \| string` | Signed number (+۱۹) or text («باز شد»). |
| `dir` | `'up' \| 'down'` | — |
| `unit` | `string` | Unit after the value («XP», «سکه»). |
| `progress` | `number` | 0–1 progress bar under the label (XP). |
| `progressText` | `Node` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `RewardProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Numbers always signed with arrow + colour + sign.
- Use `progress` for XP to the next level.

**Don't**

- Do not use rewards for neutral info.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{display:'grid', gap:'6px', maxWidth:'420px'}},
  h(B.Reward,{icon:'trophy', label:'ریتینگ کاتان', value:19}),
  h(B.Reward,{icon:'trophy', label:'ریتینگ اونو', value:-12}),
  h(B.Reward,{icon:'sparkles', label:'سطح ۱۲', progress:0.8, progressText:'۹۶۰ از ۱٬۲۰۰', value:120, unit:'XP'}),
  h(B.Reward,{coin:true, label:'سکهٔ سطح ۱۲', value:120}),
  h(B.Reward,{icon:'image', label:'قاب نقره‌ای پروفایل', value:'باز شد'})
)
```
