A small pill for status, counts, «شما» and premium; always text or icon, never colour alone.

## When to use

Ready/waiting states, «اونو!», unread counts, «ویژه» premium, «شما» next to the viewer, «آزمایشی» test items.

## Props / what the consumer provides

`tone`, `size`, `icon`, `children`. Numeric children render with Persian digits.

| Prop | Type | Description |
|---|---|---|
| `tone` | `'neutral' \| 'you' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'premium' \| 'test' \| 'count' \| 'count-invite'` | you = coral «شما» only; count = crimson number pill; premium = gold «ویژه»; test = dashed. |
| `size` | `'sm' \| 'md'` | — |
| `icon` | `IconName` | Leading 14px icon (status is never colour-only). |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `BadgeProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- `tone="you"` (coral) is only for «شما»; `count` (crimson) only for unread/attention counts.
- Pair status tones with an icon: success + check «آماده», warning + hourglass «منتظر».
- On the felt badges switch to `--felt-plate` automatically.

**Don't**

- Do not put muted text on coral or gold badges.
- Do not use badges as buttons.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  row(h(B.Badge,{tone:'you'},'شما'), h(B.Badge,{tone:'success',icon:'check'},'آماده'), h(B.Badge,{tone:'warning',icon:'hourglass'},'منتظر'), h(B.Badge,{tone:'danger',icon:'flag'},'اونو!'), h(B.Badge,{tone:'info',icon:'info'},'نوبتی'), h(B.Badge,{tone:'premium',icon:'crown'},'ویژه')),
  row(h(B.Badge,null,'۴ نفر'), h(B.Badge,{tone:'test'},'آزمایشی'), h(B.Badge,{tone:'count'},3), h(B.Badge,{tone:'count'},12), h(B.Badge,{tone:'count-invite'},'@'), h(B.Badge,{tone:'you',size:'sm'},'شما'), h(B.Badge,{tone:'success',size:'sm'},'برنده'))
)
```
