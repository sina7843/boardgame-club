The identity pattern: avatar (+frame) with name, seat glyph, «شما», league, title «لقب» and level.

## When to use

Lobby seats, rail cards, ranking rows, notifications, friend lists, chat headers — wherever a person is named.

## Props / what the consumer provides

`name`, avatar fields (`initials`/`src`, `seat`, `you`, `status`, `bot`), cosmetics (`frame`, `title`, `league`, `level`), `size` xs–lg, `trailing` node.

| Prop | Type | Description |
|---|---|---|
| `name` (required) | `Node` | Display name. |
| `initials` | `string` | — |
| `src` | `string` | — |
| `seat` | `SeatNo` | Seat glyph before the name and seat ring on the avatar. |
| `you` | `boolean` | Viewer: amber ring + «شما» badge. |
| `status` | `'online' \| 'away' \| 'offline'` | — |
| `bot` | `boolean` | — |
| `frame` | `FrameTier` | Cosmetic frame tier. |
| `title` | `Node` | Title «لقب» (`--label`: cream in dark, decision 2.7; `--felt-gold` on the felt). |
| `league` | `LeagueTier` | — |
| `level` | `number` | — |
| `sub` | `Node` | Extra sub-line item. |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | xs (chat), sm (HUD/ranking), md (lobby/rail/notifications, default), lg (lists/headers). |
| `avatar` | `AvatarProps` | Extra Avatar props. |
| `trailing` | `Node` | Node pushed to the far end. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `IdentityProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Show title, frame and league consistently: HUD, chat, lobby and ranking all use this pattern.
- Sizes: sm for HUD/ranking, md for lobby/rail/notifications, lg for lists and headers.
- The viewer always gets `you` (amber ring + «شما»).

**Don't**

- Do not drop the seat glyph at the table.
- Do not abbreviate Persian names; let them ellipsize.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.Identity,{name:'مینا', initials:'م', seat:4, you:true, frame:'gold', league:'gold', title:'شب‌زنده‌دار'}),
  h(B.Identity,{name:'نیلوفر', initials:'ن', frame:'master', league:'master', title:'رستم دستان', level:41, status:'online', size:'lg'}),
  h(B.Identity,{name:'آرش', initials:'آ', size:'sm', seat:2, league:'diamond', trailing:h(B.Badge,{tone:'success',icon:'check'},'آماده')}),
  h(B.Identity,{name:'ربات', initials:'ر', bot:true, size:'sm', sub:'سطح متوسط'})
)
```
