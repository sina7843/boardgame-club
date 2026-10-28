The profile banner background in five variants (`felt` navy, `coral` amber, `gold` amber-gold, `night`, `cream`) with a dot texture.

## When to use

Top of `ProfileHead`, banner pickers in the shop/studio.

## Props / what the consumer provides

`variant`, `height`, `children` (art layered on top).

| Prop | Type | Description |
|---|---|---|
| `variant` | `'felt' \| 'coral' \| 'gold' \| 'night' \| 'cream'` | — |
| `height` | `number` | px. Default 160. |
| `children` | `Node` | Art layered on top (pattern, illustration). |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `BannerArtProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Use the variants; extra art goes in `children`.

**Don't**

- Do not put text on banners.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'10px'}},
  ['felt','coral','gold','night','cream'].map(function(v){ return h('div',{key:v, style:{display:'grid', gap:'4px'}}, h(B.BannerArt,{variant:v, height:72, style:{borderRadius:'12px'}}), h('span',{className:'t-caption bgv-muted'}, {felt:'نمد',coral:'کهربایی',gold:'طلایی',night:'شب',cream:'کرم'}[v])); })
)
```
