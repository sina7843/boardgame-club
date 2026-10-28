The game-table page: our frame around the game's REAL UI. Phone: game bar, HUD strip, felt, action dock. Desktop: rail (inline-start, right in RTL) | felt + action dock | chat (inline-end, left).

## When to use

The root of every in-game screen.

## Props / what the consumer provides

`desk` for the responsive desktop grid (≥1200 rail 296 | felt + dock | chat 360; 900–1199 rail | felt + dock, chat opens from the game bar as a side sheet; <900 the phone order). Fluid height, `min-height: min(900px, 100dvh)` so laptops 768–900px tall never push the action dock off screen. `layout` forces `full`/`mid`/`phone` for previews. Children: `GameBar`, `Hud`, `Felt` (with the game's own UI in `stage`), `ActionDock`, `Chat`.

| Prop | Type | Description |
|---|---|---|
| `desk` | `boolean` | Desktop grid: rail 296 (inline-start, right in RTL) \| felt + action dock \| chat 360 (inline-end) with the game bar on top; fluid height, min `min(900px, 100dvh)`. <1200 the chat column hides (open it from the game bar as a side sheet); <900 the phone order. |
| `layout` | `'auto' \| 'full' \| 'mid' \| 'phone'` | With `desk`: auto (viewport decides) or force full / mid (rail + felt) / phone — for previews and screenshots. |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `TableScreenProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Real game UI policy: the game's own board, hand and game-specific controls render as-is inside `Felt` (`stage`, letterboxed). We own only the frame: game bar, HUD, one turn pill, plates on the felt, the action dock and chat.
- The game's own player panels and turn text are hidden; our HUD shows the same facts from `publicSummary`.
- Phone order: GameBar → Hud strip → Felt (flexes) → ActionDock. Desktop: rail at the inline start, chat at the inline end.

**Don't**

- Do not redraw a game board, invent game art or stretch a capture.
- Do not show the site header, footer or dock on the table.
- Do not let the HUD scroll the felt off screen.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
(function () {
  var phone = h(B.TableScreen, null,
    h(B.GameBar, {title:'اونو', latin:'UNO', meta:['زنده', '۳۰ ثانیه هر نوبت', h(B.Spectators, {count:3})], actions:h(B.Button, {iconOnly:true, icon:'message-circle', count:2}, 'گفت‌وگو')}),
    h(B.Hud, {layout:'strip', players:[{name:'نیلوفر', initials:'ن', seat:1, score:5, scoreLabel:'کارت', turn:true, clock:{time:24, p:0.8}}, {name:'آرش', initials:'آ', seat:2, score:1, scoreLabel:'کارت', badge:h(B.Badge, {tone:'danger', size:'sm'}, 'اونو!')}, {name:'ربات', initials:'ر', seat:3, bot:true, score:7, scoreLabel:'کارت', strikes:1}, {name:'مینا', initials:'م', seat:4, you:true, score:6, scoreLabel:'کارت', waiting:'بعدی'}]}),
    h(B.Felt, {as:'main', top:h(B.TurnPill, {who:'نیلوفر', seat:1, initials:'ن', clock:{time:24, p:0.8}}), stage:'assets/games/uno-table.webp', stageRatio:'520/316', stageAlt:'میز اونو، رابط خود بازی'},
      h('div', {className:'bgv-felt__stage', style:{'--ar':'808/233', flex:'none'}}, h('img', {src:'assets/games/uno-hand.webp', alt:'دست شما، رابط خود بازی'}))),
    h(B.ActionDock, {waiting:true, prompt:'بعد از نیلوفر نوبت شماست', clock:{time:30, state:'paused', sub:'زمان شما'}, actions:[{label:'بکش', icon:'layers', disabled:true}, {label:'اونو!', disabled:true}]}));
  var rail = h(B.Hud, {layout:'rail', players:[
      {name:'آرش', initials:'آ', seat:2, league:'diamond', title:'کهنه‌کار', score:6, scoreLabel:'امتیاز', leader:true, stats:[{icon:'layers', value:4, label:'کارت'}, {icon:'swords', value:2, label:'شوالیه'}]},
      {name:'نیلوفر', initials:'ن', seat:1, league:'master', title:'رستم دستان', score:5, scoreLabel:'امتیاز', stats:[{icon:'layers', value:7, label:'کارت'}]},
      {name:'کاوه', initials:'ک', seat:3, league:'silver', score:3, scoreLabel:'امتیاز', offline:true, status:'offline'},
      {name:'مینا', initials:'م', seat:4, you:true, league:'gold', title:'شب‌زنده‌دار', score:4, scoreLabel:'امتیاز', turn:true, clock:{time:15600, p:0.65}}]});
  var desk = h(B.TableScreen, {desk:true, layout:'full', style:{height:'900px'}},
    h(B.GameBar, {title:'کاتان', latin:'Catan', meta:['نوبتی', '۲۴ ساعت هر نوبت', 'رتبه‌ای', h(B.Connection, {state:'ok'})], actions:[h(B.Button, {key:1, variant:'ghost', iconOnly:true, icon:'volume-2'}, 'صدا و لرزش'), h(B.Button, {key:2, iconOnly:true, icon:'message-circle', pressed:true, 'aria-pressed':'true'}, 'گفت‌وگو'), h(B.Button, {key:3, variant:'leave', size:'sm'}, 'ترک میز')]}),
    rail,
    h(B.Felt, {as:'main', top:[h(B.TurnPill, {key:1, mine:true, initials:'م', clock:{time:15600, p:0.65}}), h(B.FeltPlate, {key:2, label:'دور', value:7})], stage:'assets/games/catan-board.webp', stageRatio:'480/473', stageAlt:'نقشهٔ کاتان، رابط خود بازی', bottom:[h(B.FeltPlate, {key:1, seat:2, icon:'trophy', label:'طولانی‌ترین جاده'}), h(B.FeltPlate, {key:2, icon:'swords', label:'بزرگ‌ترین ارتش:', value:'—'})]}),
    h(B.ActionDock, {prompt:'نوبت شماست: تاس بریزید', clock:{time:15600, p:0.65, sub:'زمان شما'}, resources:[{resource:'#2F6B3A', value:3, label:'چوب'}, {resource:'#B9573A', value:1, label:'آجر'}, {resource:'#8DBF4E', value:4, label:'گوسفند'}, {resource:'#E3B93C', value:2, label:'گندم'}, {resource:'#8A8F98', value:0, label:'سنگ'}], actions:[{label:'تاس بریز', icon:'dices', variant:'primary'}, {label:'تجارت', disabled:true}, {label:'ساختن', disabled:true}]}),
    h(B.Chat, {title:'گفت‌وگوی میز', mutedToggle:true, bottom:true, composer:h(B.Composer, {quick:['کسی گندم داره؟', 'سنگ می‌دم', '👏']})},
      h(B.SystemMessage, {game:true, seat:2}, h('b', null, 'آرش'), ' جاده ساخت'),
      h(B.Message, {author:'نیلوفر', initials:'ن', seat:1, time:'۲ دقیقه', text:'کسی چوب داره؟'}),
      h(B.Message, {mine:true, time:'الان', seen:true, text:'بعد از تاس می‌گم'})));
  var scaled = function (node, w, hgt, s) { return h('div', {style:{width:Math.round(w * s) + 'px', height:Math.round(hgt * s) + 'px', position:'relative', overflow:'hidden', borderRadius:'12px', border:'1px solid var(--line)'}}, h('div', {style:{width:w + 'px', height:hgt + 'px', transform:'scale(' + s + ')', transformOrigin:'top right', position:'absolute', top:0, right:0}}, node)); };
  var li = function (t) { return h('li', {className:'t-caption bgv-muted'}, t); };
  return h('div', {style:{display:'flex', gap:'16px', alignItems:'flex-start', flexWrap:'wrap'}},
    h('figure', {style:{margin:0, display:'grid', gap:'6px'}}, scaled(h('div', {style:{height:'800px'}}, phone), 390, 800, 0.56), cap('گوشی، زیر ۹۰۰')),
    h('figure', {style:{margin:0, display:'grid', gap:'8px', maxWidth:'462px'}}, scaled(desk, 1280, 900, 0.36), cap('دسکتاپ، ۱۲۰۰ و بیشتر'),
      h('ul', {style:{margin:0, paddingInlineStart:'18px', display:'grid', gap:'2px'}},
        li('ریل بازیکن‌ها در شروع خواندن (راست)؛ گفت‌وگو در انتها (چپ)'),
        li('وسط: رابط واقعی خود بازی در قاب میز، با یک قرص نوبت و پلاک‌ها'),
        li('اکشن‌داک زیر میز: تاس، «نوبت شماست»، ساختن'),
        li('۹۰۰ تا ۱۱۹۹: گفت‌وگو دکمهٔ نوار بازی و شیت کناری'),
        li('پنل بازیکن خود بازی پنهان؛ داشبورد ما از publicSummary'))));
})()
```
