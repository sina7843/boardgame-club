A system push-notification mock (web push / lock screen), fixed light styling.

## When to use

Specs for alerts outside the app: turn reminders, invitations. (No SMS.)

## Props / what the consumer provides

`app`, `iconSrc` (app-icon.svg from the brand kit), `time`, `title`, `text`.

| Prop | Type | Description |
|---|---|---|
| `app` | `Node` | — |
| `iconSrc` | `string` | URL of app-icon.svg from the brand kit. |
| `time` | `Node` | — |
| `title` | `Node` | — |
| `text` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `PushNotificationProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Title states the game and the ask; text says how long is left.

**Don't**

- Do not imitate a specific OS chrome beyond this neutral card.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
col(
  h(B.PushNotification,{iconSrc:'assets/app-icon.svg', time:'۲۲:۴۰', title:'نوبت شما در کاتان', text:'آرش حرکتش را انجام داد. ۲۴ ساعت وقت دارید.'}),
  h(B.PushNotification,{iconSrc:'assets/app-icon.svg', time:'الان', title:'نیلوفر شما را به اونو دعوت کرد', text:'میز زنده، ۶۰ ثانیه هر نوبت؛ ۲ صندلی خالی'})
)
```
