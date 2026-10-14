A centered dialog with heading, body and footer actions; inline for specs or `modal` with a scrim.

## When to use

Confirmations (leave table, delete account), short forms (report), purchase confirmations on desktop.

## Props / what the consumer provides

`title`, `icon`, `children`, `footer`, `onClose`, `danger`, `modal`.

| Prop | Type | Description |
|---|---|---|
| `title` | `Node` | — |
| `icon` | `IconName` | Leading icon tile. |
| `danger` | `boolean` | Destructive confirm: crimson icon tile, role alertdialog. |
| `footer` | `Node` | Footer buttons (cancel, then the one main action). |
| `onClose` | `() => void` | Shows a close button; also scrim click in modal mode. |
| `closeLabel` | `string` | — |
| `modal` | `boolean` | Render fixed with a scrim. Default false (inline, for specs and previews). |
| `children` | `Node` | — |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `DialogProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- Footer: the staying choice first (secondary), then the one main action (primary, leave or danger).
- Leaving a table is `leave` («ترک میز»); destroying something is a `danger` button in a `danger` dialog («حذف حساب»).
- Say the consequence in the body: «ربات جای شما بازی می‌کند و باخت ثبت می‌شود».

**Don't**

- Do not stack dialogs.
- Do not use dialogs on phones for long content; use `Sheet`.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
row(
  h(B.Dialog,{style:{width:'340px'}, title:'ترک میز؟', icon:'log-out', onClose:function(){}, footer:[h(B.Button,{key:1, variant:'secondary'},'ماندن'), h(B.Button,{key:2, variant:'leave'},'ترک میز')]},
    h('p',null,'بازی رتبه‌ای در جریان است. اگر بروید ربات جای شما بازی می‌کند و باخت برای شما ثبت می‌شود.')),
  h(B.Dialog,{style:{width:'340px'}, title:'دعوت به میز کاتان', onClose:function(){}, footer:[h(B.Button,{key:1, variant:'secondary'},'رد'), h(B.Button,{key:2, variant:'primary'},'پیوستن')]},
    h(B.Identity,{name:'نیلوفر', initials:'ن', frame:'master', league:'master', title:'رستم دستان'}), h('p',{className:'bgv-muted'},'زنده، ۶۰ ثانیه هر نوبت، دوستانه'))
)
```
