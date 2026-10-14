The «یه دست دیگه؟» vote: each player's vote (بله / نه / فکر می‌کند) with a countdown.

## When to use

Under the result card after a game.

## Props / what the consumer provides

`votes` ({name,seat,initials,you,vote}), `countdown` (Clock props), `title`, `note`, `actions`.

| Prop | Type | Description |
|---|---|---|
| `title` | `Node` | — |
| `votes` (required) | `Array<{ name: Node; seat?: SeatNo; initials?: string; src?: string; you?: boolean; vote?: 'yes' \| 'no' \| 'wait' }>` | — |
| `countdown` | `ClockProps \| Node` | Vote countdown (Clock props, chip). |
| `note` | `Node` | — |
| `actions` | `Node` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `RematchProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Explain what happens to «نه» seats: «صندلی کاوه برای دعوت یا ربات باز می‌شود».
- The viewer's vote button is primary.

**Don't**

- Do not start without the countdown ending or everyone voting.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{maxWidth:'440px'}}, h(B.Rematch,{countdown:{time:24, p:0.8}, votes:[{name:'مینا',initials:'م',seat:3,you:true,vote:'yes'},{name:'نیلوفر',initials:'ن',seat:1,vote:'yes'},{name:'آرش',initials:'آ',seat:2,vote:'wait'},{name:'کاوه',initials:'ک',seat:4,vote:'no'}], note:'صندلی کاوه برای دعوت یا ربات باز می‌شود. با همان تنظیمات: زنده، ۶۰ ثانیه، رتبه‌ای'}))
```
