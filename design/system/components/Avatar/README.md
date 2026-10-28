A round player picture or initials with seat ring, «you» ring, presence, bot and turn indicators.

## When to use

Everywhere a person appears: HUD cards, chat, lobby, lists, profile.

## Props / what the consumer provides

`initials` or `src` (the 11-layer avatar render), `name` for screen readers, `size` xs–2xl, `seat` 1–10, `you`, `status`, `bot`, `turn` (+`clockState`).

| Prop | Type | Description |
|---|---|---|
| `size` | `AvatarSize` | xs 24, sm 32, md 40 (default), lg 56, xl 96, 2xl 128. |
| `initials` | `string` | One or two letters shown when there is no image. |
| `src` | `string` | Image URL (the user's 11-layer avatar render). |
| `name` | `string` | Accessible name (role="img"). |
| `seat` | `SeatNo` | Seat ring colour 1–10. |
| `you` | `boolean` | Viewer: amber ring. |
| `status` | `'online' \| 'away' \| 'offline'` | Presence dot. |
| `bot` | `boolean` | Bot chip at the corner. |
| `turn` | `boolean` | Spinning turn ring. |
| `clockState` | `ClockState` | Colours the turn ring by clock state. |
| `onFelt` | `boolean` | Use on-felt clock colours. |
| `vote` | `'yes' \| 'no'` | Rematch vote ring. |
| `children` | `Node` | Custom art (e.g. inline SVG avatar). |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `AvatarProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Always show the seat ring (`seat`) at the table; the viewer gets the amber ring (`you`, `--invite-strong`).
- Pair the avatar with name and seat glyph (`Identity`, `PlayerCard`); never identify a player by ring colour only.
- Use xs in chat, sm in HUD strips, md in lists, xl/2xl in profiles.

**Don't**

- Do not draw your own rings or borders around avatars; use `Frame` for cosmetics.
- Do not mark bots only with a name; keep the bot chip.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  row(h(B.Avatar,{size:'xs',initials:'ن',seat:1}), h(B.Avatar,{size:'sm',initials:'آ',seat:2}), h(B.Avatar,{initials:'م',you:true,name:'مینا'}), h(B.Avatar,{size:'lg',initials:'س',seat:5,status:'online'}), h(B.Avatar,{size:'xl',initials:'ک',seat:3,status:'away'})),
  row(h(B.Avatar,{initials:'ر',seat:6,bot:true,name:'ربات'}), h(B.Avatar,{initials:'پ',seat:4,status:'offline'}), h(B.Avatar,{initials:'ن',seat:1,turn:true}), h(B.Avatar,{initials:'آ',seat:2,turn:true,clockState:'warn'}), h(B.Avatar,{initials:'ک',seat:3,turn:true,clockState:'critical'}))
)
```
