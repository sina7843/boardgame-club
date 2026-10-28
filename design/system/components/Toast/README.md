A transient message: ink by default, amber for «نوبت شماست», crimson for critical time.

**Material (v2.0):** the toast is a floating board (hard 6px shadow); its action is a small token in the page colours (`--bg` fill, `--text` label, deep #0A1720 ink), so it reads on ink, cream, amber and crimson toasts. The close «×» is a ghost button.

## When to use

Turn start (live), timer warnings, auto-move notices, saved/copied confirmations.

## Props / what the consumer provides

`tone`, `title`, `text`, `icon`, `action` (node or `{label,onClick}`), `onClose`.

| Prop | Type | Description |
|---|---|---|
| `tone` | `'default' \| 'turn' \| 'critical'` | turn = amber «نوبت شماست»; critical = crimson last seconds; default = ink. |
| `title` | `Node` | — |
| `text` | `Node` | — |
| `icon` | `IconName \| false` | Icon name or false for none. |
| `action` | `Node \| ({ label: Node } & ButtonProps)` | Node or {label,onClick} rendered as a small token button. |
| `onClose` | `() => void` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ToastProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- `turn` tone only when it is the viewer's turn (amber = you); play sound + vibration with it if enabled.
- Critical at the last 10s of a live turn, with the seconds left.

**Don't**

- Do not use toasts for errors that need a decision; use a Banner or Dialog.
- Do not stack more than two.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.Toast,{tone:'turn', title:'نوبت شماست', text:'۱:۰۰ وقت دارید'}),
  h(B.Toast,{tone:'critical', title:'۸ ثانیه مانده', text:'بعد از آن حرکت خودکار انجام می‌شود', action:{label:'بازی کن'}}),
  h(B.Toast,{title:'حرکت خودکار انجام شد', text:'یک کارت کشیده شد؛ اخطار ۱ از ۳', icon:'bot', onClose:function(){}})
)
```
