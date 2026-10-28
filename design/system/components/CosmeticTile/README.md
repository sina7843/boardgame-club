A shop/wardrobe tile for a cosmetic: art, name, rarity and state (owned, equipped, locked with price, trying on), premium flag.

**Material (v2.0): large token** (2px frame, 5px hard shadow; the ink is the soft `--ink-btn`, #A1AAB1 in light since v2.1.11 and #4A6476 in dark since v2.1.12, so the art leads): the art sits on the token itself, no grey box. Equipped = a heavier 3px frame in the strong `--ink` (navy) and «پوشیده», still raised like its neighbours; trying on = a dashed `--link` outline.

## When to use

Cosmetics shop, wardrobe, avatar studio (11 layers), card backs, board skins, emotes.

## Props / what the consumer provides

`art`, `name`, `state`, `price`, `lockText`, `rarity`, `premium`, `onClick`.

| Prop | Type | Description |
|---|---|---|
| `art` (required) | `Node` | Preview art (avatar part, card back, board skin swatch). |
| `name` (required) | `Node` | — |
| `state` | `'owned' \| 'equipped' \| 'locked' \| 'trying'` | — |
| `price` | `number` | Coin price (locked items). |
| `lockText` | `Node` | Lock reason when not for sale («سطح ۲۰»). |
| `rarity` | `RarityProps['level']` | — |
| `premium` | `boolean` | Premium-subscription exclusive. |
| `onClick` | `React.MouseEventHandler` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `CosmeticTileProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Equipped tiles show «پوشیده» and the navy `--selected` ring.
- Premium-exclusive items show the «پریمیوم» badge instead of a price.
- «در حال امتحان» uses the dashed outline (it is about you, like an invitation).

**Don't**

- Do not hide locked items; show the price or the unlock rule.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(116px, 1fr))', gap:'10px', maxWidth:'560px'}},
  h(B.CosmeticTile,{art:h(B.CardBack,{color:'#142B3B', width:44}), name:'پشت کارت سرمه‌ای', state:'equipped', rarity:'common'}),
  h(B.CosmeticTile,{art:h(B.CardBack,{color:'#C9553A', width:44}), name:'پاییز آجری', state:'owned', rarity:'rare'}),
  h(B.CosmeticTile,{art:h(B.CardBack,{color:'#5B2E99', width:44}), name:'شب پرستاره', state:'locked', price:470, rarity:'epic'}),
  h(B.CosmeticTile,{art:h(B.Frame,{tier:'master', avatar:{initials:'م', size:'lg'}}), name:'قاب استاد', state:'locked', premium:true, rarity:'legend'}),
  h(B.CosmeticTile,{art:h(B.Avatar,{size:'lg', initials:'م', you:true}), name:'هدفون گیمینگ', state:'trying', rarity:'epic'})
)
```
