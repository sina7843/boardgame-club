A league tier: a coloured shield plus the Persian name in text colour — برنز، نقره، طلا، پلاتین، الماس، استاد.

## When to use

Next to names in HUD, chat, lobby and ranking; on profile headers and season pages.

## Props / what the consumer provides

`tier`; optional custom `children` (e.g. «لیگ استاد»).

| Prop | Type | Description |
|---|---|---|
| `tier` (required) | `LeagueTier` | — |
| `children` | `Node` | Custom label; default the Persian tier name (برنز… استاد). |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `LeagueProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- The shield carries the tier colour; the name is always `--text` (`--felt-muted` on the felt).
- Show the league only after placement (5 ranked games); before that use a Badge «موقت».

**Don't**

- Do not colour the league name or the player name by tier.
- Do not use league colours for anything else.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  row(h(B.League,{tier:'bronze'}), h(B.League,{tier:'silver'}), h(B.League,{tier:'gold'}), h(B.League,{tier:'platinum'}), h(B.League,{tier:'diamond'}), h(B.League,{tier:'master'}), h(B.League,{tier:'gold'},'لیگ طلا، ۱٬۵۸۴')),
  felt({style:{padding:'12px 16px'}}, row(h(B.League,{tier:'gold'}), h(B.League,{tier:'diamond'}), h(B.League,{tier:'master'})))
)
```
