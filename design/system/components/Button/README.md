A claymorphic tile button with five roles: primary (go), secondary (neutral), ghost (low emphasis), leave (exit without destroying) and danger (destroys).

## When to use

Every action. Pick the role by what the action does, not by how important it looks: primary = join, sit, ready, rematch, send, accept · secondary = invite, details, «رد», cancel-but-stay · ghost = «قوانین», links inside bars · leave = «ترک میز», «انصراف از صف», «خروج از حساب» · danger = delete account, confirm resign. Icon-only buttons in game bars, chat heads and top bars.

## Props / what the consumer provides

`children` is the label (a short Persian verb). `variant` is the role (`secondary` is the default look); `leave` adds the `log-out` icon by itself. `size`, `icon`, `iconEnd`, `loading`, `disabled`, `count`, `pressed`, `href` cover every state. For `iconOnly`, `children` becomes the `aria-label` and `count` becomes a corner badge.

| Prop | Type | Description |
|---|---|---|
| `variant` | `'default' \| 'primary' \| 'secondary' \| 'ghost' \| 'leave' \| 'danger' \| 'outline'` | Roles: primary = go (join, ready, rematch, send, accept) · secondary (default) = neutral (invite, details, «رد», cancel-but-stay) · ghost = low emphasis («قوانین», links in bars) · leave = exits without destroying («ترک میز», «انصراف از صف», «خروج از حساب»; log-out icon by default) · danger = destroys (delete account, confirm resign). outline = legacy neutral. Never coral. |
| `size` | `'sm' \| 'md' \| 'lg'` | sm 36px, md 44px (default), lg 52px. |
| `block` | `boolean` | Full-width. |
| `icon` | `IconName \| React.ReactElement` | Leading icon (lucide name or element). |
| `iconEnd` | `IconName \| React.ReactElement` | Trailing icon. |
| `iconOnly` | `boolean` | Square icon button; a string `children` becomes the aria-label. |
| `loading` | `boolean` | Spinner, hides label, sets aria-busy. |
| `disabled` | `boolean` | Disabled tile (sunken, muted). |
| `count` | `number` | Small crimson count pill after the label. |
| `pressed` | `boolean` | Render pressed (sunken) — for toggles and open menus. |
| `href` | `string` | Render as a link. |
| `children` | `Node` | Label. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ButtonProps` in `components/index.d.ts`.

## Do / Don't

**Do**

- One `primary` per view: «بنشین», «آماده‌ام», «یه دست دیگه», «ارسال». Green on light, cream on dark (`--primary`).
- «رد» on an invite or notification is `secondary`, never ghost or danger: declining is neutral.
- Exits that can be undone or rejoined use `leave` (crimson label on a neutral tile + `log-out` icon); actions that destroy something use `danger` (crimson fill) and a confirm dialog.
- Keep touch targets ≥44px on phones: `size="sm"` (36px) is for dense desktop rows; coarse pointers get 44px automatically.
- Give every `iconOnly` button a Persian label: `h(Bgv.Button,{iconOnly:true,icon:"x"},"بستن")`.

**Don't**

- Never make a coral button: coral (`--invite`) is only for «you» and invitations; use `Chip variant="invite"` for empty seats.
- Do not use `danger` for «ترک میز» or «خروج»: leaving is not destroying (use `leave`).
- Do not add your own shadows or gradients; the bottom lip comes from `--shadow-tile`.
- Do not put two primary buttons side by side; demote the second to `secondary`. `outline` is kept only for old screens.

## Example

Rendered with `React.createElement` (`h`) and `Bgv` (`B`); the preview card defines small layout helpers `row`, `col`, `cap` and `felt`.

```js
(function () {
  var r = function (role, note) {
    var kids = [].slice.call(arguments, 2);
    return h('div', {style:{display:'grid', gridTemplateColumns:'150px minmax(0, 1fr)', gap:'12px', alignItems:'center'}},
      h('div', {style:{display:'grid', gap:'2px', minWidth:0}}, h('b', {className:'bgv-latin', style:{fontSize:'14px', color:'var(--heading)'}}, role), h('span', {className:'t-caption bgv-muted'}, note)),
      row.apply(null, kids));
  };
  return col(
    r('primary', 'برو: نشستن، آماده، ارسال', h(B.Button,{variant:'primary', icon:'armchair'},'بنشین'), h(B.Button,{variant:'primary'},'آماده‌ام'), h(B.Button,{variant:'primary', icon:'rotate-ccw'},'یه دست دیگه')),
    r('secondary', 'خنثی: دعوت، جزئیات، «رد»', h(B.Button,{variant:'secondary', icon:'user-plus'},'دعوت'), h(B.Button,{variant:'secondary'},'جزئیات'), h(B.Button,{variant:'secondary'},'رد')),
    r('ghost', 'کم‌تأکید: قوانین، لینک در نوار', h(B.Button,{variant:'ghost', icon:'book-open'},'قوانین'), h(B.Button,{variant:'ghost'},'همه را ببین')),
    r('leave', 'خروج بدون تخریب', h(B.Button,{variant:'leave'},'ترک میز'), h(B.Button,{variant:'leave'},'انصراف از صف'), h(B.Button,{variant:'leave'},'خروج از حساب')),
    r('danger', 'تخریب: حذف، تسلیم', h(B.Button,{variant:'danger', icon:'trash-2'},'حذف حساب'), h(B.Button,{variant:'danger', icon:'flag'},'تسلیم می‌شوم')),
    r('size, state', 'lg ۵۲، md ۴۴، sm ۳۶', h(B.Button,{variant:'primary', size:'lg'},'شروع بازی'), h(B.Button,{size:'sm', icon:'user-plus'},'دعوت'), h(B.Button,{variant:'primary', loading:true},'در حال پیوستن'), h(B.Button,{variant:'primary', disabled:true},'بازی کن'), h(B.Button,{iconOnly:true, icon:'message-circle', count:2},'گفت‌وگو'), h(B.Button,{iconOnly:true, variant:'ghost', icon:'arrow-right'},'بازگشت'))
  );
})()
```
