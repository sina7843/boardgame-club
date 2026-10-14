A 5:7 card back with cream border; colour and pattern are game-art cosmetics.

## When to use

Card-back cosmetics in the shop and wardrobe; on the felt for deck piles.

## Props / what the consumer provides

`color` (literal game-art colour allowed), `width`, `label`, `children` (pattern).

| Prop | Type | Description |
|---|---|---|
| `color` | `string` | Back colour (game art; literal colours allowed). |
| `width` | `number` | Width px. Default 72 (5:7). |
| `label` | `string` | — |
| `children` | `Node` | Pattern art; default a sparkle glyph. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `CardBackProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Name it in `label` for screen readers («پشت کارت پاییز مرجانی»).

**Don't**

- Do not use card backs as decorative UI elsewhere.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
felt({style:{padding:'16px'}}, h('div',{style:{display:'flex', gap:'14px', alignItems:'center'}},
  h(B.CardBack,{color:'#173A2D', label:'پشت کارت جنگلی'}), h(B.CardBack,{color:'#C9553A', label:'پشت کارت پاییز مرجانی', style:{transform:'rotate(-8deg)'}}), h(B.CardBack,{color:'#5B2E99', width:56, label:'پشت کارت شب پرستاره'}, h(B.Icon,{name:'moon', size:22})), h(B.CardBack,{color:'#1F3A5A', width:56, label:'پشت کارت دریا'}, h(B.Icon,{name:'droplet', size:22}))))
```
