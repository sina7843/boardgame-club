Timeout strikes as dots («۱ از ۳»). In 16 games a player who times out three turns in a row is removed or loses; a move made in time resets the count.

## When to use

Player cards, player detail sheets, timeout notifications.

## Props / what the consumer provides

`used`, `of` (default 3), `showLabel` to add «اخطار ۲ از ۳».

| Prop | Type | Description |
|---|---|---|
| `used` (required) | `number` | Timeouts used. |
| `of` | `number` | Limit. Default 3. |
| `showLabel` | `boolean` | Add «اخطار ۱ از ۳» text. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `StrikesProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Turn the dots crimson at the last strike before removal (automatic).
- Show the label on desktop cards; dots alone on phone mini cards (the label is still announced).
- Code: `MAX_TIMEOUTS = 3` in ابلون، مونوپولی، تخته‌نرد، کاتان، پروژه گایا، گو، کندو، منچ، کریدور، ریسک، سانتورینی، مارپله، تاک، تیکت تو راید، آنمچد، اونو. Chess, checkers, Onitama and Othello lose on the first flag fall; other games play an automatic move. In tournaments a bot takes the seat instead.

**Don't**

- Do not show strikes for games without the timeout rule.
- Do not call them «consecutive» unless the game resets them on a move (all 16 do).

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  row(h(B.Strikes,{used:0}), h(B.Strikes,{used:1}), h(B.Strikes,{used:2}), h(B.Strikes,{used:1, showLabel:true}), h(B.Strikes,{used:2, showLabel:true})),
  felt({style:{padding:'12px 16px'}}, row(h(B.Strikes,{used:1}), h(B.Strikes,{used:2, showLabel:true})))
)
```
