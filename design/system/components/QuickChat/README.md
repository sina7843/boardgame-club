A horizontal tray of quick-message chips, context-aware per game and phase.

## When to use

In the composer and as a floating tray on phone tables (sending shows a bubble over your seat).

## Props / what the consumer provides

`items` (strings), `onPick`, `label`.

| Prop | Type | Description |
|---|---|---|
| `items` (required) | `string[]` | — |
| `onPick` | `(text: string) => void` | — |
| `label` | `string` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `QuickChatProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Keep 4–8 short items; emoji allowed here.

**Don't**

- Do not include taunts; keep it friendly.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(h(B.QuickChat,{items:['اونو!','خوب بازی کردی','بجنب 😅','👏','ببخشید!','یه دست دیگه؟']}), h(B.QuickChat,{items:['کسی گندم داره؟','سنگ می‌دم','دزد رو نذار رو من 🙏']}))
```
