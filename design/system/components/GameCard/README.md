A catalog tile: the game box photo on a white shelf (the box is the only image, with 6px corners; it grows a little from its centre on hover or keyboard focus), a faint line, then flags, Persian title with Latin original, meta line.

**Material (v2.0): board** that presses: lifts 2px on hover/focus while the box grows to 106% from its centre, lands on press (same as Card). The box photo keeps its soft contact shadow — product photography, the one sanctioned exception to «no blur».

## When to use

Catalog grids, home shelves, search results, «ادامهٔ بازی» rows. Wide banners (tournament, game page header) use the painted cover alone: pass only `cover` for the 16:9 card.

## Props / what the consumer provides

`box` (box photo: real box from the box kit, any ratio) or `boxArt` (house box node for our own games), `cover` (480×270 painted cover: only for the 16:9 card without a box), `title`, `latin`, `meta` (text or `{icon,text}`), `flags` (Badge props + `label`), `footer` (e.g. `ModeTag`), `href`. Without `box`/`boxArt` the card falls back to the 16:9 cover (`cover` or `art`).

| Prop | Type | Description |
|---|---|---|
| `box` | `string` | Box photo URL (any ratio; shown whole with object-fit: contain on a square shelf). When set, the box is the card's only image; hover / keyboard focus enlarges it (no image swap). |
| `boxArt` | `Node` | Node drawn instead of a box photo (house box for our own games). Same shelf treatment as `box`. |
| `cover` | `string` | 480×270 painted cover URL, used only without `box`/`boxArt` (16:9 card). Ignored when a box is given. |
| `art` | `Node` | Node shown when there is no cover. |
| `title` (required) | `Node` | Persian game name. |
| `latin` | `string` | Latin original name (Manrope). |
| `meta` | `Array<Node \| { icon?: IconName; text: Node }>` | Meta items: text or {icon,text}; separated by space, never «·». |
| `flags` | `Array<Node \| (BadgeProps & { label: Node })>` | Badges on the cover: Badge props (+label) or nodes. |
| `href` | `string` | — |
| `footer` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `GameCardProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Box first: the box photo is the default face of every game in lists. It is shown whole at its own shape (never cropped or stretched), centred on the shelf, with **6px rounded corners** and a soft contact shadow under it.
- A faint 1px line (`--line`) separates the shelf from the text.
- Hover (pointer devices) and keyboard focus lift the card 2px and enlarge the box to 106% from its centre (the contact shadow widens with it). The image never changes: no cross-fade to the painted cover. Touch screens show the resting state.
- Our own games (sealed-bids, line-three) have no box photo: pass `boxArt` with the house box.
- Put `ModeTag` in `flags` for games that have a bot: it sits under the game name (icons only on phones).
- The whole card is one link to the game page (opening the game in place was dropped); keep buttons out of the card.
- Meta: players, time, pace, with icons, Persian digits, no «·».

**Don't**

- Do not crop or stretch box photos, and do not put them on a grey or tinted plate.
- Do not swap the box for the painted cover on hover, and do not use the cover as the face of a card in lists. Box photos come first; the cover is only for wide banners (tournament, game page header).
- Do not put more than two flags on a card.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
(function () {
  var cap2 = function (t, el) { return h('div', {style:{display:'grid', gap:'6px', alignContent:'start'}}, el, h('span', {className:'t-micro', style:{color:'var(--label)', textAlign:'center'}}, t)); };
  var meta = [{icon:'users',text:'۳ تا ۴ نفر'},{icon:'clock',text:'۶۰ دقیقه'}];
  return h('div',{style:{display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:'14px', maxWidth:'640px'}},
    cap2('حالت عادی: جعبهٔ بازی', h(B.GameCard,{href:'#', box:'box/catan.webp', title:'کاتان', latin:'Catan', flags:[{icon:'flame', label:'محبوب'}], meta:meta})),
    cap2('هاور یا فوکوس: جعبه بزرگ‌تر می‌شود', h(B.GameCard,{href:'#', className:'is-hover', box:'box/catan.webp', title:'کاتان', latin:'Catan', flags:[{icon:'flame', label:'محبوب'}], meta:meta})),
    cap2('بازی با ربات: ModeTag زیر اسم', h(B.GameCard,{href:'#', box:'box/uno.webp', title:'اونو', latin:'UNO', flags:[h(B.ModeTag,{key:'m'})], meta:[{icon:'users',text:'۲ تا ۱۰ نفر'},{icon:'clock',text:'۱۵ دقیقه'}]}))
  );
})()
```
