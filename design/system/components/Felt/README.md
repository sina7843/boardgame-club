Our table frame: the fixed felt (same in both themes) that holds the game's REAL UI in a letterboxed stage, with the turn pill and public plates around it.

## When to use

The centre of every table screen; also small on-felt previews for HUD/table components.

## Props / what the consumer provides

`stage` (the game's own UI: a capture URL or the renderer node) + `stageRatio`, `top`/`bottom` rows (turn pill and plates), `children` (e.g. a second stage for your hand), `variant` (`felt`; `board`/`world` only for legacy art), `as` ("main" on the screen).

| Prop | Type | Description |
|---|---|---|
| `variant` | `'felt' \| 'board' \| 'world'` | felt = cards on cloth; board = a game board sits ON the felt; world = full-bleed art (Gaia). |
| `board` | `Node` | Board art (variant board). |
| `top` | `Node` | Top row (turn pill + plates). |
| `bottom` | `Node` | Bottom row of plates. |
| `world` | `string` | CSS background for variant world. |
| `stage` | `string \| Node` | The game's OWN UI (board, hand, game controls) rendered as-is inside our frame: an image URL (capture) or the renderer node. Letterboxed, never stretched. |
| `stageRatio` | `number \| string` | Width / height of the stage content (e.g. 728/718) so it keeps its shape at any size. |
| `stageAlt` | `string` | — |
| `as` | `string` | Root element. Default "div" (use "main" on the screen). |
| `label` | `string` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `FeltProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- The board, hand and game controls are the game's own renderer, unchanged; the stage keeps their aspect ratio (letterbox, never stretch).
- Exactly one `TurnPill` goes in the top row; plates (`FeltPlate`) carry public facts around the stage.
- Everything we draw on the felt uses felt tokens (`--felt-ink`, `--felt-muted`, `--felt-plate`) and keeps 16px from the felt edge.

**Don't**

- Do not redraw boards or invent game art.
- Do not theme the felt light/dark; it is fixed.
- Do not put cards (`bgv-card`) on the felt unless they are overlays (results, sheets).

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'12px'}},
  felt({style:{height:'330px'}, top:h(B.TurnPill,{mine:true, initials:'م', clock:{time:42, p:0.7}}), stage:'assets/games/uno-table.webp', stageRatio:'520/316', stageAlt:'میز اونو'},
    h('div',{className:'bgv-felt__stage', style:{'--ar':'808/233', flex:'none'}}, h('img',{src:'assets/games/uno-hand.webp', alt:'دست شما'}))),
  felt({style:{height:'330px'}, top:h(B.TurnPill,{who:'آرش', seat:2, initials:'آ', clock:{time:15600, p:0.65}}), stage:'assets/games/catan-board.webp', stageRatio:'480/473', stageAlt:'نقشهٔ کاتان',
    bottom:[h(B.FeltPlate,{key:1, icon:'trophy', label:'طولانی‌ترین جاده', seat:2}), h(B.FeltPlate,{key:2, label:'دزد روی', value:'۸'})]})
)
```
