The profile header: banner art, framed avatar, name, title «لقب», league, level, meta, actions and a stats strip.

## When to use

Own and public profile pages (desktop and phone `compact`).

## Props / what the consumer provides

`banner`, `bannerArt`, `name`, avatar fields, `frame`, `title`, `league`, `level`, `badges`, `meta` (array), `actions`, `stats` ({value,label}), `compact`, `children` (bio).

| Prop | Type | Description |
|---|---|---|
| `banner` | `BannerArtProps['variant']` | — |
| `bannerArt` | `Node` | — |
| `name` (required) | `Node` | — |
| `initials` | `string` | — |
| `src` | `string` | — |
| `status` | `'online' \| 'away' \| 'offline'` | — |
| `avatar` | `AvatarProps` | — |
| `frame` | `FrameTier` | — |
| `title` | `Node` | — |
| `league` | `LeagueTier` | — |
| `level` | `number` | — |
| `badges` | `Node` | Badges after the name (premium). |
| `meta` | `Node \| Node[]` | Meta line items (online state, current game, member since). |
| `actions` | `Node` | — |
| `stats` | `Array<{ value: Node; label: Node }>` | 2–4 stats under the header. |
| `compact` | `boolean` | Phone layout: xl avatar, shorter banner. |
| `children` | `Node` | Bio paragraph. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ProfileHeadProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Show premium with `Badge tone="premium"` in `badges`.
- Actions: «دوست شدن» (primary), «پیام» (secondary), «بیشتر» menu.

**Don't**

- Do not put more than four stats.
- Do not recolour the banner; use the banner variants.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
h(B.ProfileHead,{banner:'night', frame:'master', name:'نیلوفر', initials:'ن', status:'online', title:'رستم دستان', league:'master', level:41,
  badges:h(B.Badge,{tone:'premium', icon:'crown'},'اشتراک پریمیوم'),
  meta:[h(B.Connection,{key:1, label:'آنلاین'}), 'در حال بازی کاتان', 'عضو از ۱۲ فروردین ۱۴۰۲'],
  actions:[h(B.Button,{key:1, variant:'primary', icon:'user-plus'},'دوست شدن'), h(B.Button,{key:2, variant:'secondary', icon:'message-circle'},'پیام')],
  stats:[{value:1284,label:'بازی'},{value:'۶۲٪',label:'برد'},{value:38,label:'جام'},{value:1982,label:'بالاترین ریتینگ'}]})
```
