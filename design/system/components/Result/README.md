The end-of-game card: headline, podium, rating/XP/coin rewards and next actions.

## When to use

Game over on phone and desktop, usually above the rematch vote.

## Props / what the consumer provides

`title`, `sub`, `badge`, `podium` (places or node), `rewards` (Reward props), `actions`, `children` (e.g. `Rematch`).

| Prop | Type | Description |
|---|---|---|
| `title` (required) | `Node` | — |
| `sub` | `Node` | — |
| `badge` | `Node` | Text (premium trophy badge) or node. |
| `podium` | `PodiumPlace[] \| Node` | Podium places or a node. |
| `rewards` | `Array<RewardProps \| Node>` | — |
| `actions` | `Node` | — |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ResultProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Lead with the outcome for the viewer: «شما بردید!» or «نیلوفر برد».
- Show rating change, XP and coins as `Reward` rows with signs.

**Don't**

- Do not hide losses; show «−۱۲» with the down arrow.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h('div',{style:{maxWidth:'480px'}}, h(B.Result,{badge:'پیروزی، رتبه‌ای', title:'شما بردید!',
  podium:[{name:'مینا', initials:'م', seat:3, you:true, meta:'۱۰ امتیاز'},{name:'نیلوفر', initials:'ن', seat:1, meta:'۸ امتیاز'},{name:'آرش', initials:'آ', seat:2, meta:'۷ امتیاز'}],
  rewards:[{icon:'trophy', label:'ریتینگ کاتان ۱٬۴۸۲ ← ۱٬۵۰۱', value:19}],
  actions:[h(B.Button,{key:1},'بازگشت به لابی'), h(B.Button,{key:2, variant:'primary', icon:'rotate-ccw'},'یه دست دیگه')]}))
```
