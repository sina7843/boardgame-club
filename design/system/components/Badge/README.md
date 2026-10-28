A small pill for status, counts, «شما» and premium; always text or icon, never colour alone.

**Material (v2.0): print** — flat on its surface, never a frame+shadow (badges do not press); the turn badge included.

## When to use

Ready/waiting states, «اونو!», unread counts, «پریمیوم» premium, «شما» next to the viewer, «آزمایشی» test items.

## Props / what the consumer provides

`tone`, `size`, `icon`, `children`. Numeric children render with Persian digits.

| Prop | Type | Description |
|---|---|---|
| `tone` | `'neutral' \| 'you' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'premium' \| 'test' \| 'count' \| 'count-invite'` | you = navy «شما» only (cream in dark); count = crimson number pill; premium = soft cream with an amber-brown edge «پریمیوم» (soft in dark too, never a solid amber fill); test = dashed. |
| `size` | `'sm' \| 'md'` | — |
| `icon` | `IconName` | Leading 14px icon (status is never colour-only). |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `BadgeProps` in `components/index.d.ts`.

## One meaning, one look (owner decision, v2.1.3)

The crown and the cream-gold premium look belong to premium only. Other meanings use tones the system already has:

| Meaning | Tone | Icon | Example |
|---|---|---|---|
| Premium subscription, premium-only item | `premium` | `crown` | «پریمیوم»، «اشتراک پریمیوم» |
| Role in a club or group | neutral (no tone) | `shield` | «مالک»، «مدیر» |
| Won a table | `success` | `trophy` | «پیروزی، رتبه‌ای» (`Result` does this for a text `badge`) |
| Mastery of one game | `info` | `star` | «استاد» |
| Saving on a plan | `success` | `coins` | «به‌صرفه‌تر» |
| Popular game | neutral | `flame` | «محبوب» |

## Do / Don't

**Do**

- `tone="you"` (navy, always with the word) is only for «شما»; `count` (crimson) only for unread/attention counts.
- Pair status tones with an icon: success + check «آماده», warning + hourglass «منتظر».
- On the felt badges switch to `--felt-plate` automatically.

**Don't**

- Do not use `premium` or the crown for anything except the premium subscription and premium-only items.
- Do not fill a badge with solid amber (decision 2.4).
- Do not use badges as buttons.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  row(h(B.Badge,{tone:'you'},'شما'), h(B.Badge,{tone:'success',icon:'check'},'آماده'), h(B.Badge,{tone:'warning',icon:'hourglass'},'منتظر'), h(B.Badge,{tone:'danger',icon:'flag'},'اونو!'), h(B.Badge,{tone:'info',icon:'info'},'نوبتی'), h(B.Badge,{tone:'premium',icon:'crown'},'پریمیوم')),
  row(h(B.Badge,{tone:'premium',icon:'crown'},'پریمیوم'), h(B.Badge,{icon:'shield'},'مالک'), h(B.Badge,{tone:'success',icon:'trophy'},'پیروزی، رتبه‌ای'), h(B.Badge,{tone:'info',icon:'star'},'استاد'), h(B.Badge,{tone:'success',icon:'coins'},'به‌صرفه‌تر'), h(B.Badge,{icon:'flame'},'محبوب')),
  row(h(B.Badge,null,'۴ نفر'), h(B.Badge,{tone:'test'},'آزمایشی'), h(B.Badge,{tone:'count'},3), h(B.Badge,{tone:'count'},12), h(B.Badge,{tone:'count-invite'},'@'), h(B.Badge,{tone:'you',size:'sm'},'شما'), h(B.Badge,{tone:'success',size:'sm'},'برنده'))
)
```
