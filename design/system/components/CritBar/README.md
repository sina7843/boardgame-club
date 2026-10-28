A crimson full-width alert bar with a draining track for the last seconds of a live turn: one bold line («۸ ثانیه تا حرکت خودکار») and one short line («وگرنه یک کارت کشیده و نوبت رد می‌شود»).

## When to use

**Inside the action dock, in place of the turn guide**, when your live turn reaches the critical threshold (last 10 s; turn-based tables: last hour, as a notification instead). It takes the guide's slot, so the table never shrinks.

## Props / what the consumer provides

`seconds` (and `total`) or `p`, `title`, `sub`, `icon`, `action`. Markup: `.bgv-critbar > .bgv-critbar__row (icon + .bgv-critbar__text > .bgv-critbar__t + .bgv-critbar__s) + .bgv-critbar__track`.

| Prop | Type | Description |
|---|---|---|
| `seconds` | `number` | Seconds left (live games, last 10s). |
| `total` | `number` | Total seconds, to derive `p`. |
| `p` | `number` | Remaining fraction 0–1. |
| `title` | `Node` | The bold line. |
| `sub` | `Node` | The short second line. |
| `text` | `Node` | Old name of `title`. |
| `icon` | `IconName` | — |
| `action` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `CritBarProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Show only for the viewer's own critical time; pair with sound + vibration if enabled.
- State the consequence: «بعد حرکت خودکار انجام می‌شود».

**Don't**

- Do not show for other players' clocks.
- Do not keep it after the move is made.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.CritBar,{seconds:8, total:60, p:0.13}),
  h(B.CritBar,{p:0.05, text:'۴۵ دقیقه تا پایان نوبت شما در کاتان؛ اخطار دوم از ۳', icon:'hourglass', action:h(B.Button,{size:'sm', variant:'primary'},'ورود')})
)
```
