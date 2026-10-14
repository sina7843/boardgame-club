Top-three podium (drawn 2-1-3) with avatars, seat + name and scores; first place gold with a crown.

## When to use

Inside `Result`; tournament finals.

## Props / what the consumer provides

`places` in rank order [1st, 2nd, 3rd] ({name,seat,initials,you,meta}).

| Prop | Type | Description |
|---|---|---|
| `places` (required) | `PodiumPlace[]` | In rank order [1st, 2nd, 3rd]; drawn 2-1-3. |
| `label` | `string` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `PodiumProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- List 4th place and below as a line under the podium.

**Don't**

- Do not reorder visually yourself; pass rank order.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{maxWidth:'380px'}}, h(B.Podium,{places:[{name:'نیلوفر', initials:'ن', seat:1, meta:'۲۱۰ امتیاز'},{name:'سارا', initials:'س', seat:2, meta:'۱۸۵ امتیاز'},{name:'مینا', initials:'م', seat:5, you:true, meta:'۱۵۰ امتیاز'}]}))
```
