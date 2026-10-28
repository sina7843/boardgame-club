A player's at-a-glance status in the HUD: identity, primary score, 1–3 key stats, turn, clock, strikes and done/waiting/offline/out state — data from the game's `publicSummary`.

## When to use

Phone HUD strip (`mini`), desktop rail (`default`), duel games above and below the board on the felt (`wide`). Tapping opens the player-detail sheet.

## Props / what the consumer provides

`name`, avatar fields, `seat` (required at the table), `you`, `bot`, `frame`, `title`, `league`, `score`/`scoreLabel`, `stats` (HudStat props), `clock`, `strikes`, flags `turn`, `out`, `offline`, `leader`, `done`, `waiting`, `badge`, `foot`, `detail`, `onClick`.

| Prop | Type | Description |
|---|---|---|
| `variant` | `'mini' \| 'default' \| 'wide'` | mini (phone strip), default (desktop rail), wide (duel, on felt). |
| `name` (required) | `Node` | — |
| `initials` | `string` | — |
| `src` | `string` | — |
| `avatar` | `AvatarProps` | — |
| `seat` | `SeatNo` | — |
| `you` | `boolean` | — |
| `bot` | `boolean` | — |
| `botLevel` | `string` | «آسان» \| «متوسط» \| «سخت». |
| `status` | `'online' \| 'away' \| 'offline'` | — |
| `frame` | `FrameTier` | — |
| `title` | `Node` | — |
| `league` | `LeagueTier` | — |
| `level` | `number` | — |
| `sub` | `Node` | — |
| `score` | `Node` | Primary stat of the game. |
| `scoreLabel` | `Node` | Unit under the score («امتیاز», «کارت در دست»). |
| `stats` | `Array<HudStatProps \| Node>` | 1–3 key secondary stats (HudStat props or nodes). |
| `clock` | `ClockProps` | The player's clock (chip on mini/default, md on wide). |
| `strikes` | `number` | Timeouts used (shows dots; label on default/wide). |
| `strikesOf` | `number` | — |
| `turn` | `boolean` | Their turn: edge in clock colour, spinning avatar ring. |
| `out` | `boolean \| string` | Eliminated (string = custom text). |
| `offline` | `boolean \| string` | Offline (string = custom text). |
| `leader` | `boolean` | Leading: «پیشتاز» over the score. |
| `done` | `boolean \| string` | Done/ready this phase (string = custom text). |
| `waiting` | `Node` | Waiting text, e.g. «۲ نوبت دیگر». |
| `badge` | `Node` | Extra badge (e.g. «اونو!»). |
| `foot` | `Node` | Footer row node. |
| `detail` | `Node` | Expanded public stats grid. |
| `onFelt` | `boolean` | Card sits on the felt (duel): on-felt clock colours. |
| `onClick` | `React.MouseEventHandler` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `PlayerCardProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Symmetric padding (12px mini, 12–14px default): the turn ring, «شما» and badges never touch the card edge or each other.
- «شما» is inline after the name (`is-you`), wrapping under it on narrow mini cards; never positioned on the card border.
- Turn is marked with `turn` (ring + card edge) only; the TurnPill says the words.
- Wide cards on the felt pass `onFelt` (the Hud duel layout does this).
- On the felt the «turn» and «you» edges are cream (`#FAF5EC`), and the «شما» tag is a cream pill with navy text, so both read on the navy felt.

**Don't**

- Do not identify players by colour alone: seat glyph + name always.
- Do not put more than three secondary stats on a card.
- Do not keep the game's own player panels next to these cards.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h('div',{style:{display:'grid', gridTemplateColumns:'repeat(4, minmax(0, 1fr))', gap:'8px', maxWidth:'420px'}},
    h(B.PlayerCard,{variant:'mini', name:'نیلوفر', initials:'ن', seat:1, score:5, scoreLabel:'کارت', turn:true, clock:{time:24, p:0.4}}),
    h(B.PlayerCard,{variant:'mini', name:'آرش', initials:'آ', seat:2, score:1, scoreLabel:'کارت', badge:h(B.Badge,{tone:'danger', size:'sm'},'اونو!')}),
    h(B.PlayerCard,{variant:'mini', name:'ربات', initials:'ر', seat:3, bot:true, score:7, scoreLabel:'کارت', strikes:2}),
    h(B.PlayerCard,{variant:'mini', name:'مینا', initials:'م', seat:4, you:true, score:6, scoreLabel:'کارت', waiting:'بعدی'})),
  h('div',{style:{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:'8px', maxWidth:'640px'}},
    h(B.PlayerCard,{name:'کاوه', initials:'ک', seat:3, league:'silver', title:'تازه‌وارد', score:6, scoreLabel:'کارت در دست', turn:true, clock:{time:13, p:0.43}, stats:[{icon:'star', value:40, label:'امتیاز'}]}),
    h(B.PlayerCard,{name:'مینا', initials:'م', seat:5, you:true, league:'gold', title:'شب‌زنده‌دار', score:7, scoreLabel:'کارت در دست', strikes:1, stats:[{icon:'star', value:95, label:'امتیاز'}]})),
  felt({style:{maxWidth:'460px', padding:'16px'}}, h(B.PlayerCard,{variant:'wide', onFelt:true, name:'آرش', initials:'آ', seat:2, league:'gold', title:'تاس‌باز', sub:'مهره‌های تیره', status:'online', score:3, scoreLabel:'امتیاز مسابقه', clock:{time:220, state:'paused', p:0.73, sub:'بانک زمان'}, stats:[{icon:'gauge', value:123, label:'پیپ'},{icon:'door-open', value:0, label:'بیرون'}]}))
)
```
