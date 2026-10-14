The «@» suggestion list: players at this table first, then spectators, with seat and state.

## When to use

Above the composer while typing «@».

## Props / what the consumer provides

`groups` ({title, items:[{name,seat,initials,meta,metaIcon,focus}]}) or `items`, `onPick`.

| Prop | Type | Description |
|---|---|---|
| `groups` | `Array<{ title?: Node; items: MentionSuggestItem[] }>` | Grouped people («بازیکن‌های این میز», «تماشاگرها»). |
| `items` | `MentionSuggestItem[]` | — |
| `onPick` | `(name: string) => void` | — |
| `label` | `string` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `MentionSuggestProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Players first (with seat glyph), then spectators.
- Keyboard focus is shown with `focus`.

**Don't**

- Do not suggest people who are not at the table or watching.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{maxWidth:'320px'}}, h(B.MentionSuggest,{groups:[{title:'بازیکن‌های این میز', items:[{name:'نیلوفر', seat:1, meta:'در نوبت', metaIcon:'hourglass', focus:true},{name:'آرش', seat:2},{name:'ربات', seat:3, bot:true, meta:'ربات'}]},{title:'تماشاگرها', items:[{name:'نیکا', meta:'تماشاگر', metaIcon:'eye'}]}]}))
```
