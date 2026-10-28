Your area under the felt: prompt («نوبت شماست»), your resources, the table actions (dice roll, build, end turn) and your clock; sunken while waiting.

## When to use

Bottom of every table screen (phone) or under the felt (desktop). The game's own hand and game-specific controls stay in the felt stage; the dock holds the shared actions.

## Props / what the consumer provides

`prompt`, `resources` (HudStat props → tiles), `actions` (Button props with `label`, or nodes), `clock` (lg), `waiting`, `children`.

| Prop | Type | Description |
|---|---|---|
| `prompt` | `Node` | What to do now («یک کارت بازی کنید») or who is next. |
| `resources` | `Array<HudStatProps \| Node> \| Node` | Your resources: HudStat props (tile form) or nodes. |
| `actions` | `Array<(ButtonProps & { label: Node }) \| Node> \| Node` | Button props (with `label`) or nodes; one primary. |
| `clock` | `ClockProps \| Node` | Your clock (lg by default). |
| `waiting` | `boolean` | Not your turn: sunken dock. |
| `label` | `string` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ActionDockProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- One primary action («تاس بریز», «بازی کن», «پایان نوبت»); the rest are secondary tiles. Actions wrap on narrow screens.
- While waiting, say when you play next: «بعد از نیلوفر نوبت شماست», clock paused.

**Don't**

- Do not hide disabled actions; show them disabled with the reason in the prompt.
- Do not style actions with `--invite`; the only amber here is the one primary button.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.ActionDock,{prompt:'نوبت شماست: تاس بریزید', clock:{time:42, p:0.7, sub:'زمان شما'}, resources:[{resource:'#2F6B3A', value:3, label:'چوب'},{resource:'#B9573A', value:1, label:'آجر'},{resource:'#8DBF4E', value:4, label:'گوسفند'},{resource:'#E3B93C', value:2, label:'گندم'},{resource:'#8A8F98', value:0, label:'سنگ'}], actions:[{label:'تاس بریز', icon:'dices', variant:'primary'},{label:'تجارت', disabled:true},{label:'ساختن', disabled:true}]}),
  h(B.ActionDock,{waiting:true, prompt:'بعد از آرش نوبت شماست', clock:{time:30, state:'paused', sub:'زمان شما'}, actions:[{label:'بکش', icon:'layers', disabled:true},{label:'اونو!', disabled:true},{label:'بازی کن', variant:'primary', disabled:true}]})
)
```
