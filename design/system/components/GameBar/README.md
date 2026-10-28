The 56px bar on top of the table: back, game name (+Latin original), meta line and table actions — all centred in the bar with symmetric padding.

## When to use

Top of every table screen (phone and desktop).

## Props / what the consumer provides

`title`, `latin`, `meta` (pace, clock rule, type, `Connection`, `Spectators`), `actions`, `onBack`.

| Prop | Type | Description |
|---|---|---|
| `title` (required) | `Node` | Persian game name. |
| `latin` | `string` | — |
| `meta` | `Node[]` | Meta items (pace, clock rule, table type, Connection, Spectators). Each is a whole `.bgv-gamebar__mi`: when space runs out a whole item drops, never half a word. Separated by dots, never «·». |
| `actions` | `Node` | Icon buttons at the end (sound, fullscreen, chat, leave). |
| `onBack` | `() => void` | — |
| `backLabel` | `string` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `GameBarProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Meta reads like a sentence of facts separated by dots: «زنده • ۳۰ ثانیه هر نوبت • ۳ اخطار = حذف». Static markup: `<span class="bgv-gamebar__meta"><span class="bgv-gamebar__mi is-first">زنده</span><span class="bgv-gamebar__mi">…</span></span>`.
- Under 480px the Latin name hides; on phones «ترک میز» may be its icon only (still `leave`, with its label as `aria-label`).
- Actions on phones, at most three, in this order: chat (icon with a corner count; `pressed` while the chat sheet is open, which reads as the navy selection), «ترک میز» (`leave`), «بیشتر» (ghost). Sound, rules, resign and report live in «بیشتر». Desktop adds sound/vibration (ghost icon). Every action is the same 44px token (2px frame, 4px shadow) — the bar enforces it, even if a `size` is passed.
- Below 1200px the docked chat disappears and the chat button opens it as a side sheet.

**Don't**

- Do not write «·» next to Persian digits; the component inserts `bgv-sep` dots.
- Do not put the turn indicator here; it lives in the TurnPill.
- Do not let actions shrink or wrap; the title ellipsizes instead.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.GameBar,{title:'اونو', latin:'UNO', meta:['زنده','۳۰ ثانیه هر نوبت','۳ اخطار = حذف', h(B.Connection,{state:'ok'}), h(B.Spectators,{count:3, showLabel:true})], actions:[h(B.Button,{key:1, variant:'ghost', iconOnly:true, icon:'volume-2'},'صدا و لرزش'), h(B.Button,{key:2, iconOnly:true, icon:'message-circle', count:2},'گفت‌وگو'), h(B.Button,{key:3, variant:'leave'},'ترک میز')]}),
  h(B.GameBar,{title:'کاتان', latin:'Catan', meta:['نوبتی','۲۴ ساعت هر نوبت','رتبه‌ای', h(B.Connection,{state:'retry'})], actions:h(B.Button,{iconOnly:true, icon:'message-circle', pressed:true, 'aria-pressed':'true'},'گفت‌وگو')}),
  h('div',{style:{maxWidth:'390px'}}, h(B.GameBar,{title:'عجایب هفت‌گانه: دوئل', latin:'7 Wonders Duel', meta:['زنده','۶۰ ثانیه هر نوبت'], actions:[h(B.Button,{key:1, iconOnly:true, icon:'message-circle', count:12},'گفت‌وگو'), h(B.Button,{key:2, variant:'ghost', iconOnly:true, icon:'more-vertical'},'بیشتر')]}))
)
```
