The chat input: emoji/quick button, auto-growing field, primary send, optional reply strip and quick tray.

## When to use

Bottom of `Chat` for players (spectators get the read-only footer instead).

## Props / what the consumer provides

`value`/`onChange`, `onSend` (Enter sends), `placeholder`, `reply` ({author,text,onCancel}), `quick` (strings) + `onQuick`, `onEmoji`, `disabled`.

| Prop | Type | Description |
|---|---|---|
| `value` | `string` | — |
| `placeholder` | `string` | — |
| `onChange` | `(value: string) => void` | — |
| `onSend` | `(value: string) => void` | Enter sends; Shift+Enter breaks a line. |
| `reply` | `{ author: Node; text: Node; onCancel?: () => void }` | Reply preview strip. |
| `quick` | `string[]` | Context-aware quick messages above the field. |
| `onQuick` | `(text: string) => void` | — |
| `onEmoji` | `() => void` | — |
| `disabled` | `boolean` | — |
| `sendLabel` | `string` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ComposerProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Placeholder «پیام به میز… (@ برای نام بردن)».
- Quick messages are context-aware (UNO: «اونو!», Catan: «کسی گندم داره؟»).
- The send icon is mirrored for RTL.

**Don't**

- Do not show the composer to spectators.
- Do not disable send while text is present.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.Composer,{quick:['کسی گندم داره؟','خوب بازی کردی','یه لحظه صبر کنید','👏'], reply:{author:'سارا', text:'حواسم هست'}}),
  h(B.Composer,{value:'@آرش قبوله؟'})
)
```
