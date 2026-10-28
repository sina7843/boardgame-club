A felt-coloured feature banner with eyebrow, title, text, actions and an optional side panel.

## When to use

Home «ادامهٔ بازی», wallet balance, tournament promos, onboarding.

## Props / what the consumer provides

`eyebrow`, `title`, `text`, `actions`, `aside`, `dark`.

| Prop | Type | Description |
|---|---|---|
| `eyebrow` | `Node` | — |
| `title` | `Node` | — |
| `text` | `Node` | — |
| `actions` | `Node` | — |
| `aside` | `Node` | Right-side (start-end) panel, e.g. a progress plate. |
| `dark` | `boolean` | Force dark tokens inside the hero. |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `HeroProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Primary buttons inside stay amber with a navy label (5.7:1 against the felt); secondary turns translucent automatically.
- One hero per page.

**Don't**

- Do not put long paragraphs in a hero.
- Do not use amber backgrounds for heroes; amber is for the one primary action.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h(B.Hero,{eyebrow:'ادامهٔ بازی', title:'نوبت شما در کاتان', text:'آرش جادهٔ بلند را گرفت. ۵ ساعت و ۲۰ دقیقه تا پایان نوبت شما مانده.', actions:[h(B.Button,{key:1, variant:'primary', icon:'play'},'ورود به میز'), h(B.Button,{key:2},'همهٔ میزها')],
  aside:h(B.Clock,{size:'lg', time:19200, p:0.66, sub:'زمان شما'})})
```
