A small rarity label: معمولی، کمیاب، حماسی، افسانه‌ای.

## When to use

Cosmetic tiles, shop item sheets, wardrobe filters.

## Props / what the consumer provides

`level`, optional `children`.

| Prop | Type | Description |
|---|---|---|
| `level` (required) | `'common' \| 'rare' \| 'epic' \| 'legend'` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `RarityProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Always the word, not just the colour.

**Don't**

- Do not use rarity colours for other meanings.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(h(B.Rarity,{level:'common'}), h(B.Rarity,{level:'rare'}), h(B.Rarity,{level:'epic'}), h(B.Rarity,{level:'legend'}))
```
