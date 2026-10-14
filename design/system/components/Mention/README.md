An inline @mention; coral when it mentions the viewer.

## When to use

Inside message text (Message parses «@name» automatically), notifications.

## Props / what the consumer provides

`name`, `you`.

| Prop | Type | Description |
|---|---|---|
| `name` | `Node` | — |
| `you` | `boolean` | Mention of the viewer: coral. |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `MentionProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Coral `you` mentions only for the viewer.

**Don't**

- Do not make mentions links to profiles inside bubbles on phones (tap opens the message menu).

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h('p',{className:'t-body-sm'}, 'حواست باشه ', h(B.Mention,{name:'مینا', you:true}), '، سارا یه کارت داره'),
  h('p',{className:'t-body-sm'}, h(B.Mention,{name:'آرش'}), ' قبوله؟')
)
```
