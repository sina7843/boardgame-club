An eye icon with the number of spectators.

## When to use

Inside the game only: game bar and lobby (v2.3.1, owner). Tap opens a sheet that lists every spectator with name, `@id` and since when. Public lists (home, open/live tables) show **no** spectator count.

## Props / what the consumer provides

`count`, `showLabel` to add «تماشاگر».

| Prop | Type | Description |
|---|---|---|
| `count` (required) | `number` | — |
| `showLabel` | `boolean` | Add the word «تماشاگر». |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `SpectatorsProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Spectators can read table chat but not write; pair with `Chat readOnly` for them.

**Don't**

- Do not show the spectator count on public table cards (home, live tables).
- Do not hide who is watching from the players: the sheet always shows names and `@id`.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(h(B.Spectators,{count:3}), h(B.Spectators,{count:12, showLabel:true}), felt({style:{padding:'10px'}}, h(B.Spectators,{count:5, showLabel:true, style:{color:'var(--felt-muted)'}})))
```
