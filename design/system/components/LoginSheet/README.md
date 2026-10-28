In-page login for a guest at a table lobby. The guest sees the lobby; «بنشین» opens this sheet and holds the seat for 2 minutes; after login they land back in the same seat.

**Material (v2.1):** a bottom sheet (board) over a scrim; the cover is a small photo; «دریافت کد» is the one amber token (lg, full width); close is a ghost icon.

## When to use

Any action that needs an account but should not leave the page: sitting at a table, accepting an invite. The header's «ورود / ثبت‌نام» uses the full login page instead and returns to the same page.

## Content

Game cover and title, why («صندلی ۳ میز کاتانِ نیلوفر ۲ دقیقه برای شما نگه داشته می‌شود.»), the `Stepper`, mobile number with `+۹۸`, «دریافت کد», the legal line with a link to the rules.

## Props / what the consumer provides

| Prop | Type | Description |
|---|---|---|
| `cover` | `string` | Game cover. |
| `title`, `text` | `Node` | Default title «برای نشستن وارد شوید». |
| `step` | `number` | Stepper position (0 number, 1 code, 2 profile). |
| `cta` | `Node` | Default «دریافت کد». |
| `legal` | `Node` | Rules line. |
| `scrim` | `boolean` | Overlay mode: scrim over the positioned container (tap = `onClose`), sheet pinned to its bottom. |
| `onClose` | `() => void` | Close (ghost ×, scrim, Esc). |
| `phoneProps` | `PhoneFieldProps` | Passed to the phone field. |

`role="dialog"`, `aria-modal="true"`, labelled by the title. Types: `LoginSheetProps` in `components/index.d.ts`. Classes: `.bgv-loginsheet`, `__body`, `__head`, `__legal`, `--overlay`, `__scrim` (replaces the local `.lg-*`).

## Do / Don't

**Do**

- Tell the guest how long the seat is held, and that they come back to it.

**Don't**

- Do not send the guest to another page to sit down.
