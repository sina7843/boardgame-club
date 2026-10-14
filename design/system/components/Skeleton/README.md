A shimmering placeholder block or set of lines shown while content loads.

## When to use

Lists, cards and HUD while the first data arrives (under ~2s). For longer waits use `StateBlock kind="loading"`.

## Props / what the consumer provides

`width`, `height`, `radius`, `circle`, `lines`.

| Prop | Type | Description |
|---|---|---|
| `width` | `number \| string` | — |
| `height` | `number \| string` | — |
| `radius` | `number \| string` | — |
| `circle` | `boolean` | Circle of `width`. |
| `lines` | `number` | Render N text lines (last one shorter). |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `SkeletonProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Mirror the real layout (avatar circle + two lines).
- Respect reduced motion (already handled in CSS).

**Don't**

- Do not show skeletons for more than a few seconds; switch to a state with text.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  row(h(B.Skeleton,{circle:true, width:40}), h('div',{style:{flex:1, display:'grid', gap:'8px'}}, h(B.Skeleton,{width:'40%', height:14}), h(B.Skeleton,{width:'70%', height:12}))),
  h(B.Skeleton,{height:120, radius:20}),
  h(B.Skeleton,{lines:3})
)
```
