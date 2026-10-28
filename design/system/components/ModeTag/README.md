A two-part pill that tells who you can play with: real players («آنلاین») and/or a bot («ربات»). It replaces the old «ربات» tag.

## When to use

Game cards, catalog, search results, game page header, lobby list.

## Props / what the consumer provides

`people` (default true), `bot` (default true), `compact` for the icon-only phone version.

| Prop | Type | Description |
|---|---|---|
| `people` | `boolean` | Real players can join (people half, outlined navy). Default true. |
| `bot` | `boolean` | A bot is available (bot half, filled navy). Default true. |
| `compact` | `boolean` | Icons only, for phone; the aria-label still names both modes. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ModeTagProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Desktop: the labelled pill «آنلاین | ربات». Phone: `compact` (icons only); the screen-reader label still says «بازی آنلاین یا با ربات».
- The people half is outlined navy, the bot half is filled navy; in dark the colours invert to cream.
- Show it only when a bot is available; games without a bot need no tag.

**Don't**

- Do not write «آدم یا ربات» or other text next to the icons.
- Do not colour it amber; amber is only for the main action.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(row(h(B.ModeTag,null), cap('دسکتاپ')), row(h(B.ModeTag,{compact:true}), cap('گوشی، فقط آیکن')), row(h(B.ModeTag,{people:false}), cap('فقط ربات')))
```
