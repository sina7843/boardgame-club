An on/off toggle row (role="switch"): ON is a navy track with a tick in the thumb and the word «روشن» (dark: a cream track with a navy thumb); OFF is an empty well and «خاموش».

**Material (v2.1):** the track is a well (filled `--selected` when ON, like every other selection); the thumb is a token seated in its slot (v2.1.9): 22px, 1.5px `--ink` ring and **no drop shadow**, exactly centred with 3px on every side in both states. (Before v2.1.9 it had a 2px hard shadow that touched the track's frame and made the thumb look off-centre.)

## When to use

Settings that take effect immediately: sound, vibration, push notifications, per-table chat mute, admin feature flags.

## Props / what the consumer provides

`checked`/`defaultChecked`, `onChange(next)`, `label`, `hint`, `disabled`, `stateLabels` (default «روشن» / «خاموش»), `hideState`. Controlled or uncontrolled.

| Prop | Type | Description |
|---|---|---|
| `checked` | `boolean` | Controlled state. |
| `defaultChecked` | `boolean` | — |
| `onChange` | `(checked: boolean, e: React.MouseEvent) => void` | Called with the next state. |
| `label` | `Node` | Label (the whole row toggles). |
| `hint` | `Node` | Muted second line. |
| `stateLabels` | `[string, string]` | State words shown beside the track. Default ['روشن', 'خاموش']; ON is the navy (--selected) track + tick (cream track + navy thumb in dark). |
| `hideState` | `boolean` | Hide the state word (only when the row already says it). |
| `disabled` | `boolean` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `SwitchProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- ON = navy `--selected` track + tick + «روشن»; OFF = sunken track + «خاموش». The word is always there (colour alone is never the state).
- Write the label as the thing being turned on: «صدای نوبت».
- Use the hint for the consequence: «وقتی نوبت شماست صدا پخش می‌شود».

**Don't**

- Do not use a switch for choices that need a Save button; use Checkbox.
- Do not recolour the ON track with `--primary` (amber means «go», not a state, and reads like a button).
- Do not hide the state word unless the row text already says it.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.Switch,{label:'صدای نوبت', hint:'وقتی نوبت شماست صدا پخش می‌شود', defaultChecked:true}),
  h(B.Switch,{label:'لرزش', hint:'در گوشی، هنگام هشدار زمان'}),
  h(B.Switch,{label:'اعلان وب', hint:'مرورگر اجازه نداده است', disabled:true})
)
```
