A 1px `--line` separator, horizontal, vertical, or with a centered label.

## When to use

Between groups in menus, cards and forms; «یا» between login options.

## Props / what the consumer provides

`label`, `vertical`.

| Prop | Type | Description |
|---|---|---|
| `label` | `Node` | Centered label between two lines. |
| `vertical` | `boolean` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `DividerProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Prefer spacing over dividers; use a divider only where groups would blur.

**Don't**

- Do not use heavy or coloured rules.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h('p',{className:'t-body-sm'},'ورود با شمارهٔ موبایل'), h(B.Divider), h(B.Divider,{label:'یا'}),
  row(h('span',null,'زنده'), h(B.Divider,{vertical:true, style:{height:'20px'}}), h('span',null,'نوبتی'))
)
```
