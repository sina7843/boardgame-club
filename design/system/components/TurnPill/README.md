The single place that says whose turn it is: avatar + «نوبت …» + clock; amber when it is yours; simultaneous phases show progress.

**Material (v2.0): a plate printed into the felt** (opaque `--felt-plate`, hard `--shadow-plate`). Yours is the flat amber plate — no frame, no shadow, no halo: it is not pressable, so it must not look like an amber «go» token.

## When to use

Top row of the felt on every table screen, exactly once.

## Props / what the consumer provides

`who`, `seat`, `initials`/`src`, `mine`, `simul` (text), `clock` (Clock props), `text`.

| Prop | Type | Description |
|---|---|---|
| `who` | `Node` | Player name («نوبت نیلوفر»). |
| `seat` | `SeatNo` | — |
| `initials` | `string` | — |
| `src` | `string` | — |
| `avatar` | `AvatarProps` | — |
| `mine` | `boolean` | Your turn: amber pill «نوبت شماست». |
| `simul` | `Node` | Simultaneous phase text, e.g. «همه انتخاب می‌کنند، ۲ از ۴ آماده». |
| `clock` | `ClockProps \| Node` | Clock props or node after a divider. |
| `text` | `Node` | Override the text. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `TurnPillProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use `mine` (amber, `--invite`) only when it is the viewer's turn: «نوبت شماست».
- Simultaneous phases: «همه انتخاب می‌کنند، ۲ از ۴ آماده» with the shared deadline.
- The pill never grows past its row: long names ellipsize, the avatar ring and the clock never get cut.
- Player cards only mark the turn with `turn`; never repeat «نوبت …» elsewhere.

**Don't**

- Do not show two turn pills.
- Do not put the pill outside the felt.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
felt(null, col(
  row(h(B.TurnPill,{who:'نیلوفر', seat:1, initials:'ن', clock:{time:24, p:0.4}}), h(B.TurnPill,{mine:true, initials:'م', clock:{time:42, p:0.7}})),
  row(h(B.TurnPill,{simul:'همه انتخاب می‌کنند، ۲ از ۴ آماده', clock:{time:18, p:0.3}}), h(B.TurnPill,{who:'کاوه', seat:3, initials:'ک', clock:{time:7, p:0.12}})),
  row(h(B.TurnPill,{mine:true, initials:'م', clock:{time:27, state:'stale', p:0.45}}), h('div',{style:{maxWidth:'250px', minWidth:0, display:'flex'}}, h(B.TurnPill,{who:'امیرحسین فرهادی‌نژاد', seat:5, initials:'ا', clock:{time:9, p:0.2}})))
))
```
