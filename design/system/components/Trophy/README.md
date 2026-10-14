A trophy tile in five tiers (bronze, silver, gold, turquoise, diamond) or locked with progress.

## When to use

Profile trophy showcase, achievements page, level-up rewards.

## Props / what the consumer provides

`tier`, `locked`, `icon`, `name`, `sub` (progress or date).

| Prop | Type | Description |
|---|---|---|
| `tier` | `'bronze' \| 'silver' \| 'gold' \| 'turquoise' \| 'diamond'` | — |
| `locked` | `boolean` | — |
| `icon` | `IconName` | — |
| `name` | `Node` | — |
| `sub` | `Node` | Progress or date, e.g. «۳۲ از ۵۰». |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `TrophyProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Locked trophies show progress «۳۲ از ۵۰».

**Don't**

- Do not show more than 6 in a showcase row.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(h(B.Trophy,{tier:'bronze', name:'اولین برد'}), h(B.Trophy,{tier:'silver', name:'۱۰ برد', icon:'star'}), h(B.Trophy,{name:'استاد کاتان', icon:'crown'}), h(B.Trophy,{tier:'turquoise', name:'هم‌تیمی', icon:'handshake'}), h(B.Trophy,{tier:'diamond', name:'۱۰۰ برد', icon:'gem'}), h(B.Trophy,{locked:true, name:'ماراتن', sub:'۳۲ از ۵۰'}))
```
