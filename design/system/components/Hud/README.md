Our in-game dashboard that replaces the game's own player panels: phone strip, desktop rail, duel or 3-column grid of player cards, fed by `publicSummary`.

## When to use

Every table: strip on phones (≤4 players; 5–6 as `grid3`; 7–10 first four + «+۶»), rail on desktop (296px at the inline start, with `Race`), duel above/below the board on the felt.

## Props / what the consumer provides

`layout` (`strip`, `grid3`, `rail`, `duel`), `players` (PlayerCard props; variant follows the layout) or PlayerCard children, `onFelt`, `label`.

| Prop | Type | Description |
|---|---|---|
| `layout` | `'strip' \| 'rail' \| 'duel' \| 'grid3'` | strip (phone, ≤5 mini cards), rail (desktop column), duel (two wide cards), grid3 (5–10 players, rows of 3). |
| `players` | `PlayerCardProps[]` | PlayerCard props; variant picked from the layout. |
| `onFelt` | `boolean` | — |
| `label` | `string` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `HudProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Gaps: 8px between cards (10px rows in grid3); cards keep their own 12px padding, so rings and «شما» never touch a neighbour.
- The viewer's card is last in the strip and the rail.
- Desktop: `rail` of default cards plus a `Race` card for standings.

**Don't**

- Do not scroll the strip horizontally; collapse into «+N» or `grid3`.
- Do not repeat the turn text in cards.
- Do not show the game's own player panels alongside the HUD.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{display:'flex', gap:'12px', alignItems:'flex-start', flexWrap:'wrap'}},
  h('div',{style:{display:'grid', gap:'8px', width:'380px', maxWidth:'100%'}},
    cap('نوار، گوشی تا چهار بازیکن'),
    h(B.Hud,{layout:'strip', players:[{name:'سارا',initials:'س',seat:1,score:8,scoreLabel:'امتیاز',done:true},{name:'آرش',initials:'آ',seat:2,score:7,scoreLabel:'امتیاز',turn:true,clock:{time:15600,p:0.6}},{name:'کاوه',initials:'ک',seat:4,score:5,scoreLabel:'امتیاز',out:true},{name:'مینا',initials:'م',seat:3,you:true,score:10,scoreLabel:'امتیاز',leader:true}]}),
    cap('سه‌ستونی، پنج و شش بازیکن'),
    h(B.Hud,{layout:'grid3', players:[{name:'نیلوفر',initials:'ن',seat:1,score:3,scoreLabel:'کارت'},{name:'آرش',initials:'آ',seat:2,score:5,scoreLabel:'کارت',turn:true,clock:{time:9,p:0.15}},{name:'سارا',initials:'س',seat:5,score:1,scoreLabel:'کارت'},{name:'ربات',initials:'ر',seat:6,bot:true,score:4,scoreLabel:'کارت'},{name:'کاوه',initials:'ک',seat:3,score:0,scoreLabel:'کارت'},{name:'مینا',initials:'م',seat:4,you:true,score:6,scoreLabel:'کارت'}]})),
  h('div',{style:{display:'grid', gap:'8px', width:'300px', maxWidth:'100%'}},
    cap('ریل، دسکتاپ'),
    h(B.Hud,{layout:'rail', players:[{name:'نیلوفر',initials:'ن',seat:1,league:'master',score:7,scoreLabel:'امتیاز',leader:true,stats:[{icon:'layers',value:4,label:'کارت'}]},{name:'مینا',initials:'م',seat:4,you:true,league:'gold',score:5,scoreLabel:'امتیاز',turn:true,clock:{time:42,p:0.7},stats:[{icon:'layers',value:6,label:'کارت'}]}]}),
    h(B.Card,{title:'امتیاز پیروزی', actions:h(B.Tag,null,'هدف ۱۰'), style:{padding:'14px 16px'}}, h(B.Race,{max:10, rows:[{seat:1,name:'نیلوفر',value:7},{seat:4,name:'مینا',value:5,you:true},{seat:2,name:'آرش',value:3}]})))
)
```
