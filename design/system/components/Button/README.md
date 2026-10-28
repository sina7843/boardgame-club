A printed game token with five roles: primary (go), secondary (neutral), ghost (low emphasis), leave (exit without destroying) and danger (destroys).

**Material (v2.0): token** — an ink frame and a hard offset shadow (no blur), like a cardboard game token. **v2.1.10 (owner decision): in light the ink is soft** — primary has a 1.5px frame and shadow in burnt amber (`--ink-btn-primary` #B57A25), secondary is white with a 1.5px frame and shadow in soft slate (`--ink-btn` #A1AAB1). **v2.1.12: dark follows the same model** — primary 1.5px frame and shadow in burnt amber #B57A25, secondary (`--surface-raised` fill) with a 1.5px slate frame and shadow (`--ink-btn` #4A6476). Hover lifts it 1px; press lands it on the table; a toggle that is on is the same token, filled navy.

## When to use

Every action. Pick the role by what the action does, not by how important it looks: primary = join, sit, ready, rematch, send, accept · secondary = invite, details, change game, «رد» (decline an invite, a rematch or a request), cancel-but-stay («ماندن») · ghost = «قوانین», links inside bars · leave = «ترک میز», «انصراف از صف», «خروج از حساب» · danger = delete account, confirm resign. Icon-only buttons in game bars, chat heads and top bars.

## Props / what the consumer provides

`children` is the label (a short Persian verb). `variant` is the role (`secondary` is the default look); `leave` adds the `log-out` icon by itself. `size`, `icon`, `iconEnd`, `loading`, `disabled`, `count`, `pressed`, `href` cover every state. For `iconOnly`, `children` becomes the `aria-label` and `count` becomes a corner badge.

| Prop | Type | Description |
|---|---|---|
| `variant` | `'default' \| 'primary' \| 'secondary' \| 'ghost' \| 'leave' \| 'danger' \| 'outline'` | Roles: primary = go (join, ready, rematch, send, accept) · secondary (default) = neutral (invite, details, «رد», cancel-but-stay) · ghost = low emphasis («قوانین», links in bars) · leave = exits without destroying («ترک میز», «انصراف از صف», «خروج از حساب»; log-out icon by default) · danger = destroys (delete account, confirm resign). `outline` is deprecated: it renders as secondary. Only primary is a solid amber token; never style a button with --invite/--accent. |
| `size` | `'sm' \| 'md' \| 'lg'` | sm 36px (1.5px frame, 3px shadow), md 44px (4px shadow; default), lg 52px (5px shadow). Frame: 1.5px in both themes (`--btn-frame`, since v2.1.12). On touch screens sm grows to 44px. |
| `block` | `boolean` | Full-width. |
| `icon` | `IconName \| React.ReactElement` | Leading icon (lucide name or element). |
| `iconEnd` | `IconName \| React.ReactElement` | Trailing icon. |
| `iconOnly` | `boolean` | Square icon button; a string `children` becomes the aria-label. |
| `loading` | `boolean` | Spinner in the label colour, hides the label, sets `aria-busy` and `aria-disabled`, and blocks click, Enter and Space (focus stays). With reduced motion: the label stays, followed by «…». |
| `disabled` | `boolean` | The token lies flat: grey `--ink-disabled` frame, no shadow, no hover, no press. |
| `count` | `number` | Small crimson count pill after the label. |
| `pressed` | `boolean` | A toggle. `true` → `aria-pressed="true"`: the same raised token, filled navy (`--selected`) with a deeper `--ink-selected` frame and shadow — one family with its siblings; `false` → `aria-pressed="false"`. For a menu trigger pass `aria-expanded` instead. |
| `href` | `string` | Render as a link. |
| `children` | `Node` | Label. |

Everything else (`className`, `style`, `id`, `aria-*`, `data-*`, event handlers) passes through to the root element. Types: `ButtonProps` in `components/index.d.ts`.

## Motion: one spec for every button

Every button answers the same gesture the same way. Variants change colour and ink, never the mechanics.

| State | Rule | Timing |
|---|---|---|
| rest | `inset 0 0 0 var(--btn-frame) ink` + `0 4px 0 ink` (frame 1.5px); `margin-block-end` reserves the shadow's height | — |
| hover | Pointer devices only (`@media (hover: hover)`): the fill moves to the variant's hover colour and the token lifts 1px (shadow 5px). Ghost only tints. | `--dur-fast` / `--dur-instant` |
| press | The token lands: it moves down by its shadow and keeps only its frame. Ghost only tints. | `--dur-instant` |
| toggle on | Same raised token, navy `--selected` with `--ink-selected` (cream with the slate `#4A6476` ink in dark, v2.1.12); lands only while pressed | — |
| focus | 2px ring, 2px offset, no motion: `--focus`, or `--focus-on-felt` on the felt and hero. | — |
| loading | Spinner in the label colour (`800ms` linear); with reduced motion, «…» after the label. | — |
| disabled | Lies flat, grey frame; no hover, no press. | — |

No blur, glow, gradient or bounce on a button. Pulses and spins belong to states (turn pill, critical clock, turn ring).

## Containers, not hidden variants

A container only re-maps colours and ink. Primary stays amber everywhere.

| Container | Tokens |
|---|---|
| Page, card, dialog, sheet, menu | Primary: amber with `--ink-btn-primary`. Secondary: white with `--ink-btn`. Leave = `--leave` with `--ink-leave`; danger = crimson with `--ink-danger` |
| Felt and hero | Light: the same buttons as on the page (`--felt-btn-*` map to white + `--ink-btn`, amber + `--ink-btn-primary`), so the soft ink stays visible on navy. Dark: cream cardboard (`--felt-control`) with the slate `--ink-btn` frame and shadow; primary with `--ink-btn-primary` (v2.1.12). Leave = pink with `--ink-felt`; toggle on = navy with the dark `--ink-felt` print |
| A light surface on the felt (card, action dock, result, chat, sheet, dialog, menu, popover) | Back to the page defaults (focus ring navy again) |
| Toast | Small token in the page colours (`--bg` fill, `--text` label) with a deep #0A1720 ink (kept: toasts are navy, amber or crimson, and need the deep ink) |
| Dark theme | Primary: burnt amber `--ink-btn-primary` #B57A25; secondary: slate `--ink-btn` #4A6476 (v2.1.12). Leave muted rose (`--ink-leave` #B06F69); danger keeps its own ink; the toggle (on) is cream with `--ink-selected` #4A6476 |

## Do / Don't

**Do**

- One `primary` per view: «بنشین», «آماده‌ام», «یه دست دیگه», «ارسال». Solid amber with a navy label (`--primary`, 6.9:1). On cream the frame is its edge (amber vs `--bg` is only 1.8:1): the burnt-amber frame is 3.1:1 on cream and 3.6:1 on white.
- Neutral (`secondary`, plain and non-ghost icon buttons) is a white token with a 1.5px soft-slate frame and a 4px hard shadow (`--ink-btn` #A1AAB1). It is deliberately quiet so the amber primary leads; the navy label (14.6:1) identifies the button. In dark: 2px warm ink.
- «رد» on an invite, a rematch or a notification is `secondary`: declining is an ordinary choice, not a warning. Never ghost, leave or danger.
- Exits that can be undone or rejoined use `leave` (soft pink token, crimson label and ink, `log-out` icon); actions that destroy something use `danger` (crimson token, deep crimson ink) and a confirm dialog.
- Keep touch targets ≥44px on phones: `size="sm"` (36px) is for dense desktop rows; coarse pointers get 44px automatically.
- Leave the bottom margin alone: it is the token's shadow, so a pressed token never overlaps the next row.
- Give every `iconOnly` button a Persian label: `h(Bgv.Button,{iconOnly:true,icon:"x"},"بستن")`.

**Don't**

- Never style a button with `--invite` or `--accent`: primary, invite and accent share one amber, so the form tells them apart. A solid amber token always means «go»; a toggle that is on is navy, like every other selection.
- Do not use `danger` for «ترک میز» or «خروج»: leaving is not destroying (use `leave`).
- Do not add your own shadows, blur, gradients, filters or animations; frame and shadow come from `--ink-*` and the `--shadow-tile-*` tokens.
- Do not put two primary buttons side by side; demote the second to `secondary`.

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
    r('secondary', 'خنثی: دعوت، جزئیات، رد', h(B.Button,{variant:'secondary', icon:'user-plus'},'دعوت'), h(B.Button,{variant:'secondary'},'جزئیات'), h(B.Button,{variant:'secondary', icon:'x'},'رد')),
    r('ghost', 'کم‌تأکید: قوانین، لینک در نوار', h(B.Button,{variant:'ghost', icon:'book-open'},'قوانین'), h(B.Button,{variant:'ghost'},'همه را ببین')),
    r('leave', 'خروج بدون تخریب', h(B.Button,{variant:'leave'},'ترک میز'), h(B.Button,{variant:'leave'},'انصراف از صف')),
    r('danger', 'تخریب: حذف، تسلیم', h(B.Button,{variant:'danger', icon:'trash-2'},'حذف حساب'), h(B.Button,{variant:'danger', icon:'flag'},'تسلیم می‌شوم')),
    r('size, state', 'lg ۵۲، md ۴۴، sm ۳۶', h(B.Button,{variant:'primary', size:'lg'},'شروع بازی'), h(B.Button,{size:'sm', icon:'user-plus'},'دعوت'), h(B.Button,{variant:'primary', loading:true},'در حال پیوستن'), h(B.Button,{variant:'primary', disabled:true},'بازی کن'), h(B.Button,{iconOnly:true, icon:'message-circle', count:2},'گفت‌وگو'), h(B.Button,{iconOnly:true, icon:'message-circle', pressed:true},'گفت‌وگو باز است'), h(B.Button,{iconOnly:true, variant:'ghost', icon:'arrow-right'},'بازگشت')),
    r('on the felt', 'ژتون مقوایی؛ primary همان کهربایی', felt({style:{padding:'12px', display:'flex', gap:'10px', flexWrap:'wrap'}}, h(B.Button,{variant:'primary', icon:'dices'},'تاس بریز'), h(B.Button,null,'پایان نوبت'), h(B.Button,{variant:'leave', size:'sm'},'ترک میز'), h(B.Button,{disabled:true},'ساختن')))
  );
})()
```
