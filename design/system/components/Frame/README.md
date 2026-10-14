A cosmetic tier frame drawn as a ring with a transparent gap around the avatar, so seat, «شما» and turn rings never sit on the frame colour.

## When to use

Profile headers, lobby seats, ranking rows, the sidebar identity card — wherever identity shows a chosen frame.

## Props / what the consumer provides

`tier` (bronze… master, coral), `size` of the avatar inside, and either `avatar` props or an `Avatar` child. `ring` (auto with a seat/«شما» avatar) widens the gap so there are ≥4px between the two rings. CSS: `bgv-frame--xs/sm/xl/2xl`, `--tight`, `--ringed`.

| Prop | Type | Description |
|---|---|---|
| `tier` | `FrameTier` | Cosmetic frame drawn outside the seat ring. |
| `size` | `AvatarSize` | Avatar size inside, to pick the frame thickness. |
| `ring` | `boolean` | True when the avatar has a seat/you ring (adds room). Auto from `avatar`. |
| `avatar` | `AvatarProps` | Avatar props to render inside (alternative to children). |
| `title` | `string` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `FrameProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Frames are earned or bought cosmetics; they always sit outside the seat ring with a visible gap.
- Match `size` to the avatar so ring thickness and gap scale (xs 2px … 2xl 5px).
- The gap is transparent: the frame works on cream, charcoal, felt and coral rows alike.

**Don't**

- Do not use frames to signal turn or status.
- Do not stack two frames or fill the space between the rings.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  row(h(B.Frame,{tier:'bronze', avatar:{initials:'آ', size:'lg'}}), h(B.Frame,{tier:'silver', avatar:{initials:'س', size:'lg'}}), h(B.Frame,{tier:'gold', avatar:{initials:'م', size:'lg'}}),
    h(B.Frame,{tier:'platinum', avatar:{initials:'ک', size:'lg'}}), h(B.Frame,{tier:'diamond', avatar:{initials:'ن', size:'lg'}}), h(B.Frame,{tier:'master', avatar:{initials:'پ', size:'lg'}}), h(B.Frame,{tier:'coral', avatar:{initials:'ی', size:'lg'}})),
  row(h(B.Frame,{tier:'gold', avatar:{initials:'آ', size:'sm', seat:2}}), h(B.Frame,{tier:'master', avatar:{initials:'م', you:true}}), h(B.Frame,{tier:'diamond', avatar:{initials:'ن', size:'xl', seat:1}}),
    felt({style:{padding:'14px'}}, h(B.Frame,{tier:'gold', avatar:{initials:'ک', seat:3, onFelt:true}})),
    h('div', {style:{padding:'14px', borderRadius:'12px', background:'var(--invite-soft)'}}, h(B.Frame,{tier:'coral', avatar:{initials:'م', you:true}}))),
  cap('حلقهٔ قاب با فاصلهٔ شفاف؛ حلقهٔ صندلی و «شما» هیچ‌وقت روی رنگ قاب نمی‌نشیند')
)
```
