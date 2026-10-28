/**
 * بردگیم‌ورس (BGV) design system — React components (window.Bgv).
 * Types are documentation: every component also passes through `className`, `style`,
 * `aria-*`, `data-*`, `id` and DOM event handlers to its root element (inputs: to the control).
 * Numbers passed as props are rendered with Persian digits and «٬» separators.
 */
import * as React from 'react';

type Node = React.ReactNode;
/** Props every component accepts and passes to its root element. */
interface BaseProps {
  /** Extra class names, appended after the bgv-* classes. */
  className?: string;
  /** Inline style, merged over computed custom properties. */
  style?: React.CSSProperties;
  [aria: `aria-${string}`]: unknown;
  [data: `data-${string}`]: unknown;
}
/** Lucide icon name from the embedded subset (see `Bgv.iconNames`), or a ready element. */
export type IconName = string;
/** Seat number 1–10: each seat has a colour AND a glyph (circle, square, triangle, diamond, star, pentagon, plus, hexagon, down-triangle, crescent). */
export type SeatNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';
/** 'coral' is the seasonal amber frame (legacy key name kept for code compatibility). */
export type FrameTier = LeagueTier | 'coral';
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
/** stale = YOUR connection dropped (dashed ring, wifi-off, last confirmed time); frozen = server incident only. */
export type ClockState = 'calm' | 'warn' | 'critical' | 'paused' | 'stale' | 'frozen';

/* ── Brand ─────────────────────────────────────────────────────── */
export interface LogoProps extends BaseProps {
  /** URL of a brand-kit file (logo-fa-primary.svg on light, logo-fa-reversed.svg on dark). Required: the logo is never redrawn. */
  src: string;
  /** Accessible name. Default «بردگیم‌ورس»; pass "" when the name is printed beside it. */
  alt?: string;
  /** Rendered height in px. Default 32. */
  height?: number;
  /** Reversed file for dark theme (logo-fa-reversed.svg); both render, CSS shows the right one per theme. */
  srcDark?: string;
  /** Symbol file (symbol-primary-small.svg) shown instead of the lock-up when the logo has the class `bgv-logo--mark`. */
  markSrc?: string;
  /** Reversed symbol for dark theme. */
  markSrcDark?: string;
  /** Renders an <a> (home link). */
  href?: string;
  /** Optional content after the image (e.g. a product label). */
  children?: Node;
}

/* ── Actions ───────────────────────────────────────────────────── */
export interface ButtonProps extends BaseProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style'> {
  /** Roles: primary = go (join, ready, rematch, send, accept) · secondary (default) = neutral (invite, details, «رد», cancel-but-stay) · ghost = low emphasis («قوانین», links in bars) · leave = exits without destroying («ترک میز», «انصراف از صف», «خروج از حساب»; log-out icon by default) · danger = destroys (delete account, confirm resign). outline = deprecated, renders as secondary. Only primary is a solid amber tile; never style a button with --invite/--accent. */
  variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'leave' | 'danger' | 'outline';
  /** sm 36px, md 44px (default), lg 52px. */
  size?: 'sm' | 'md' | 'lg';
  /** Full-width. */
  block?: boolean;
  /** Leading icon (lucide name or element). */
  icon?: IconName | React.ReactElement;
  /** Trailing icon. */
  iconEnd?: IconName | React.ReactElement;
  /** Square icon button; a string `children` becomes the aria-label. */
  iconOnly?: boolean;
  /** Spinner in the label colour, hides the label, sets aria-busy + aria-disabled and blocks click/Enter/Space; with reduced motion the label stays with «…». */
  loading?: boolean;
  /** Disabled tile: same family, quieter; no hover, no press. */
  disabled?: boolean;
  /** Small crimson count pill after the label. */
  count?: number;
  /** Toggle state: true → aria-pressed="true": the same raised token, navy selection fill with --ink-selected; false → aria-pressed="false". Menu triggers use aria-expanded instead. */
  pressed?: boolean;
  /** Render as a link. */
  href?: string;
  /** Label. */
  children?: Node;
}
export interface ChipProps extends BaseProps {
  /** invite = amber chip with a dashed navy border, for empty seats and invitations only. */
  variant?: 'default' | 'invite';
  /** Selected filter chip (primary fill, aria-pressed). */
  selected?: boolean;
  /** sm 28px, md 36px. */
  size?: 'sm' | 'md';
  /** Leading 16px icon. */
  icon?: IconName;
  /** Muted count after the label. */
  count?: number;
  href?: string;
  onClick?: React.MouseEventHandler;
  children?: Node;
}
export interface ChipGroupProps extends BaseProps {
  /** Options rendered as chips. Omit and pass `children` for custom chips. */
  options?: Array<string | { value: string; label: Node; icon?: IconName; count?: number }>;
  /** Selected value; pass an array for multi-select. */
  value?: string | string[];
  defaultValue?: string | string[];
  /** Called with the new value (or array). */
  onChange?: (value: string | string[]) => void;
  /** One horizontally scrolling row instead of wrapping. */
  scroll?: boolean;
  size?: 'sm' | 'md';
  /** Group accessible name. */
  label?: string;
  children?: Node;
}

/* ── Inputs ────────────────────────────────────────────────────── */
interface FieldProps extends BaseProps {
  /** Visible label (always give one; placeholder is not a label). */
  label?: Node;
  /** Helper text under the control. */
  hint?: Node;
  /** Error text: turns the field crimson, sets aria-invalid, replaces hint. */
  error?: Node;
}
export interface TextFieldProps extends FieldProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'style'> {
  /** Prefix icon inside the field (e.g. "search"). */
  icon?: IconName;
  /** Trailing node inside the field (e.g. a ghost icon Button). */
  end?: Node;
}
export interface TextareaProps extends FieldProps, Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'style'> {}
export interface SelectProps extends FieldProps, Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'style'> {
  /** Options; strings or {value,label}. */
  options: Array<string | { value: string; label: string; disabled?: boolean }>;
}
export interface CheckboxProps extends BaseProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'style'> {
  /** Label text next to the box. */
  label?: Node;
  /** Second line, muted. */
  hint?: Node;
}
export interface RadioProps extends CheckboxProps {}
export interface SwitchProps extends BaseProps {
  /** Controlled state. */
  checked?: boolean;
  defaultChecked?: boolean;
  /** Called with the next state. */
  onChange?: (checked: boolean, e: React.MouseEvent) => void;
  /** Label (the whole row toggles). */
  label?: Node;
  /** Muted second line. */
  hint?: Node;
  /** State words shown beside the track. Default ['روشن', 'خاموش']; ON is the green (--success) track + check in both themes. */
  stateLabels?: [string, string];
  /** Hide the state word (only when the row already says it). */
  hideState?: boolean;
  disabled?: boolean;
}
export interface SegmentedProps extends BaseProps {
  /** 2–4 options. */
  options: Array<string | { value: string; label: Node; icon?: IconName; disabled?: boolean }>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Stretch to full width. */
  block?: boolean;
  /** Accessible name of the radiogroup. */
  label?: string;
}
export interface OtpFieldProps extends BaseProps {
  /** Number of digits. Default 6. */
  length?: number;
  /** Controlled code (Latin or Persian digits). */
  value?: string;
  defaultValue?: string;
  /** Wrong code: crimson boxes. */
  invalid?: boolean;
  onChange?: (code: string) => void;
  /** Called once all digits are filled. */
  onComplete?: (code: string) => void;
  /** Group accessible name. Default «کد ۶ رقمی». */
  label?: string;
  disabled?: boolean;
}
export interface PhoneFieldProps extends FieldProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'style' | 'prefix'> {
  /** Country prefix shown in Manrope. Default "+98". */
  prefix?: string;
}
export interface SliderProps extends BaseProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'style'> {
  label?: Node;
  /** Current value as words, e.g. «۶۰ ثانیه». Shown and announced. */
  valueText?: string;
  hint?: Node;
}

/* ── Display ───────────────────────────────────────────────────── */
export interface IconProps extends BaseProps {
  /** Lucide icon name. */
  name: IconName;
  /** sm 16, md 20 (default), lg 24, or px. */
  size?: 'sm' | 'md' | 'lg' | number;
  /** Accessible name; omit for decorative icons (aria-hidden). */
  label?: string;
  /** Mirror horizontally (directional icons in RTL, e.g. "send"). */
  mirror?: boolean;
}
export interface BadgeProps extends BaseProps {
  /** you = navy «شما» only; count = crimson number pill; premium = soft «پریمیوم» (never solid amber); test = dashed. */
  tone?: 'neutral' | 'you' | 'success' | 'warning' | 'danger' | 'info' | 'premium' | 'test' | 'count' | 'count-invite';
  size?: 'sm' | 'md';
  /** Leading 14px icon (status is never colour-only). */
  icon?: IconName;
  children?: Node;
}
export interface TagProps extends BaseProps {
  /** Set in Manrope (codes, Latin labels). */
  latin?: boolean;
  icon?: IconName;
  children?: Node;
}
export interface ModeTagProps extends BaseProps {
  /** Real players can join (people half, outlined navy). Default true. */
  people?: boolean;
  /** A bot is available (bot half, filled navy). Default true. */
  bot?: boolean;
  /** Icons only, for phone; the aria-label still names both modes. */
  compact?: boolean;
}
export interface CoinProps extends BaseProps {
  /** Amount; rendered with Persian digits and «٬». */
  amount?: number | string;
  /** sm 14px coin (top bar), md 18px (inherits text size), lg 32px coin / 28px number (wallet). Coins are real metallic gold (--coin-light/--coin/--coin-dark). */
  size?: 'sm' | 'md' | 'lg';
  /** Append the unit word («سکه» when true). */
  unit?: boolean | string;
  /** Wallet balance chip (.bgv-coinchip) for the account menu and the phone top bar. */
  chip?: boolean;
  /** With `chip`: link to the wallet. */
  href?: string;
  children?: Node;
}
export interface AvatarProps extends BaseProps {
  /** xs 24, sm 32, md 40 (default), lg 56, xl 96, 2xl 128. */
  size?: AvatarSize;
  /** One or two letters shown when there is no image. */
  initials?: string;
  /** Image URL (the user's 11-layer avatar render). */
  src?: string;
  /** Accessible name (role="img"). */
  name?: string;
  /** Seat ring colour 1–10. */
  seat?: SeatNo;
  /** Viewer: amber ring. */
  you?: boolean;
  /** Presence dot. */
  status?: 'online' | 'away' | 'offline';
  /** Bot chip at the corner. */
  bot?: boolean;
  /** Spinning turn ring. */
  turn?: boolean;
  /** Colours the turn ring by clock state. */
  clockState?: ClockState;
  /** Use on-felt clock colours. */
  onFelt?: boolean;
  /** Rematch vote ring. */
  vote?: 'yes' | 'no';
  /** Custom art (e.g. inline SVG avatar). */
  children?: Node;
}
export interface FrameProps extends BaseProps {
  /** Cosmetic frame drawn outside the seat ring. */
  tier?: FrameTier;
  /** Avatar size inside, to pick the frame thickness. */
  size?: AvatarSize;
  /** True when the avatar has a seat/you ring (adds room). Auto from `avatar`. */
  ring?: boolean;
  /** Avatar props to render inside (alternative to children). */
  avatar?: AvatarProps;
  title?: string;
  children?: Node;
}
export interface SeatProps extends BaseProps {
  /** Seat 1–10 (colour + glyph). */
  n: SeatNo;
  /** md 16px, lg 22px. */
  size?: 'md' | 'lg';
  /** true = announce «صندلی ۳، قرمز، مثلث»; string = custom; default decorative. */
  label?: boolean | string;
}
export interface IdentityProps extends BaseProps {
  /** Display name. */
  name: Node;
  initials?: string;
  src?: string;
  /** Seat glyph before the name and seat ring on the avatar. */
  seat?: SeatNo;
  /** Viewer: amber ring + «شما» badge. */
  you?: boolean;
  status?: 'online' | 'away' | 'offline';
  bot?: boolean;
  /** Cosmetic frame tier. */
  frame?: FrameTier;
  /** Title «لقب» (--label: cream in dark; --felt-gold on the felt). */
  title?: Node;
  league?: LeagueTier;
  level?: number;
  /** Extra sub-line item. */
  sub?: Node;
  /** xs (chat), sm (HUD/ranking), md (lobby/rail/notifications, default), lg (lists/headers). */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Extra Avatar props. */
  avatar?: AvatarProps;
  /** Node pushed to the far end. */
  trailing?: Node;
}
export interface LeagueProps extends BaseProps {
  tier: LeagueTier;
  /** Custom label; default the Persian tier name (برنز… استاد). */
  children?: Node;
}
export interface CardProps extends BaseProps {
  /** surface-raised background. */
  raised?: boolean;
  /** No padding, clips children (lists, tables, covers). */
  flush?: boolean;
  /** Hover lift; focusable when onClick is given. */
  interactive?: boolean;
  /** Card heading. */
  title?: Node;
  /** Nodes at the end of the heading row. */
  actions?: Node;
  /** Root element. Default "section". */
  as?: string;
  onClick?: React.MouseEventHandler;
  children?: Node;
}
export interface GameCardProps extends BaseProps {
  /** Box photo URL (any ratio; shown whole with object-fit: contain on a square shelf). When set, the box is the card's only image, shown at its own shape with 6px corners; hover / keyboard focus enlarges it from its centre (no image swap). */
  box?: string;
  /** Node drawn instead of a box photo (house box for our own games). Same shelf treatment as `box`. */
  boxArt?: Node;
  /** 480×270 painted cover URL, used only without `box`/`boxArt` (16:9 card). Ignored when a box is given. */
  cover?: string;
  /** Node shown when there is no cover. */
  art?: Node;
  /** Persian game name. */
  title: Node;
  /** Latin original name (Manrope). */
  latin?: string;
  /** Meta items: text or {icon,text}; separated by space, never «·». */
  meta?: Array<Node | { icon?: IconName; text: Node }>;
  /** Badges on the cover: Badge props (+label) or nodes. */
  flags?: Array<Node | (BadgeProps & { label: Node })>;
  href?: string;
  footer?: Node;
}
export interface StatProps extends BaseProps {
  label: Node;
  value: Node;
  /** Change; number → signed, arrow icon, green/crimson. */
  delta?: number | string;
  /** Force direction for string deltas. */
  deltaDir?: 'up' | 'down';
  /** Muted words after the delta («این هفته»). */
  deltaText?: Node;
}
export interface ProgressProps extends BaseProps {
  /** 0–1. */
  value: number;
  label?: Node;
  /** Right-hand value text, e.g. «۹۶۰ از ۱٬۲۰۰». */
  valueText?: Node;
  /** primary (default), invite (you), accent (XP/rewards). */
  tone?: 'primary' | 'invite' | 'accent';
}
export interface RingProps extends BaseProps {
  /** 0–1. */
  value: number;
  /** Diameter px. Default 48. */
  size?: number;
  /** Track width px. */
  width?: number;
  /** Fill colour token name or CSS colour. */
  tone?: 'primary' | 'accent' | 'invite' | 'success' | 'warning' | 'danger' | 'info' | string;
  label?: string;
  children?: Node;
}
export interface SkeletonProps extends BaseProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  /** Circle of `width`. */
  circle?: boolean;
  /** Render N text lines (last one shorter). */
  lines?: number;
}
export interface StateBlockProps extends BaseProps {
  /** guest = «ابتدا وارد حساب خود شوید»: a page a guest reaches from the dock but that needs an account (messages). */
  kind?: 'loading' | 'empty' | 'error' | 'denied' | 'offline' | 'guest';
  /** Heading; defaults per kind in Persian. */
  title?: Node;
  /** One or two sentences: what happened and what to do. */
  text?: Node;
  /** Recovery action(s), usually one primary Button. kind="guest" defaults to «ورود / ثبت‌نام» + a ghost «بدون ورود، بازی سریع». */
  action?: Node;
  icon?: IconName;
  /** kind="guest": the short «what you get after login» list. */
  perks?: Array<{ icon?: IconName; title: Node; text?: Node }>;
  /** kind="guest": /login?next=… */
  loginHref?: string;
  quickHref?: string;
  children?: Node;
}
export interface DataTableColumn<Row = any> {
  key: string;
  label: Node;
  align?: 'start' | 'end' | 'center';
  width?: string | number;
  /** Bold (900) cells, e.g. rank or score. */
  strong?: boolean;
  /** With DataTable `stack`: where the cell goes on phones — lead (rank/icon), main, end on line 1; unset = below with its label; hide = dropped. Rendered as data-stack; the label as data-label. */
  stack?: 'lead' | 'main' | 'end' | 'hide';
  render?: (row: Row, index: number) => Node;
}
export interface DataTableProps<Row = any> extends BaseProps {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  /** Row index, predicate, or rows with `you: true` → the whole row gets the --row-you tint and a 3px navy bar at its start. */
  youRow?: number | ((row: Row, i: number) => boolean);
  selectedRow?: number;
  /** Screen-reader caption. */
  caption?: string;
  rowKey?: string;
  /** .bgv-table--stack: under 600px rows fold into stacked rows (see DataTableColumn.stack). 'phone' forces the folded look (previews). */
  stack?: boolean | 'phone';
}
export interface ListItemProps extends BaseProps {
  /** Leading node (Avatar, Coin…). */
  leading?: Node;
  /** Leading icon tile instead of `leading`. */
  icon?: IconName;
  title: Node;
  sub?: Node;
  trailing?: Node;
  href?: string;
  as?: string;
  onClick?: React.MouseEventHandler;
  children?: Node;
}
export interface TooltipProps extends BaseProps {
  /** Tooltip text (or children when there is no trigger). */
  content?: Node;
  /** Element that shows the tooltip on hover/focus. Without it, the bubble renders inline. */
  trigger?: React.ReactElement;
  /** Force open. */
  open?: boolean;
  placement?: 'top' | 'bottom';
  children?: Node;
}
export interface DividerProps extends BaseProps {
  /** Centered label between two lines. */
  label?: Node;
  vertical?: boolean;
}

/* ── Navigation ────────────────────────────────────────────────── */
export interface AppShellProps extends BaseProps {
  /** auto (default) = the viewport decides: ≥1200 full header, 900–1199 header with a collapsed search, <900 sticky top bar + floating dock (no header). full / mid / phone force one layout (previews, screenshots). */
  layout?: 'auto' | 'full' | 'mid' | 'phone';
  /** Brand-kit files: lock-up (src, srcDark) for the header, symbol (markSrc, markSrcDark) for the phone top bar. */
  logo?: { src: string; srcDark?: string; markSrc?: string; markSrcDark?: string };
  /** Header destinations (default: خانه، بازی‌ها، میزها، تورنمنت‌ها، رتبه‌بندی). */
  nav?: SiteHeaderProps['nav'];
  /** Phone dock items: خانه، میزها، پیام‌ها، بیشتر — for guests too (no counts). */
  dockItems?: DockProps['items'];
  /** Guest: header and top bar show «ورود / ثبت‌نام» (secondary) instead of the icons; the dock keeps its four items without counts. */
  guest?: boolean;
  /** Avatar button (the account menu holds coins on desktop). */
  user?: SiteHeaderProps['user'];
  /** Coin balance in the phone top bar. */
  coins?: number;
  coinsHref?: string;
  /** Unread notifications: a number, or the header item {href,count,current}. */
  notifications?: number | { href?: string; count?: number; current?: boolean } | false;
  notificationsHref?: string;
  messages?: { href?: string; count?: number; current?: boolean } | false;
  /** «بازی سریع» in the header; false on the home page (its first section already has it). */
  quickPlay?: false | { href?: string; label?: Node };
  /** SiteSearch props, a node, or false. */
  search?: false | SiteSearchProps | Node;
  loginHref?: string;
  homeHref?: string;
  /** Phone top-bar title. */
  title?: Node;
  /** Replace the built parts with your own nodes. */
  header?: Node;
  topbar?: Node;
  dock?: Node;
  /** SiteFooter on public pages only (games, game page, wiki, support) — never on tables, messages or settings. */
  footer?: Node;
  /** Page content (inside main.bgv-app__main, between top bar and dock). */
  children?: Node;
}

/* ── Site shell (v2.1) ─────────────────────────────────────────── */
export interface SiteHeaderProps extends BaseProps {
  logo?: { src: string; srcDark?: string };
  /** Five destinations; `active` = a 3px navy rule under the label; `turns` = crimson count on «میزها» (members only). */
  nav?: Array<{ label: Node; href?: string; active?: boolean; turns?: number }>;
  /** Guest: «ورود / ثبت‌نام» as a secondary token in place of messages, notifications and the avatar; no counts. */
  guest?: boolean;
  /** Avatar button; `current` = navy ring (you are on an account page). */
  user?: { initials?: string; src?: string; name?: string; current?: boolean };
  /** Messages and notifications icons; `current` = filled navy (you are on that page). */
  messages?: { href?: string; count?: number; current?: boolean } | false;
  notifications?: { href?: string; count?: number; current?: boolean } | false;
  /** Amber «بازی سریع»: a registered exception to «one amber action per page» (it may sit next to the page's primary); false on the home page. */
  quickPlay?: false | { href?: string; label?: Node };
  search?: false | SiteSearchProps | Node;
  loginHref?: string;
  homeHref?: string;
  /** auto (viewport) or force mid (900–1199: search collapses to a 44px button) / wide, for previews. */
  width?: 'auto' | 'mid' | 'wide';
  /** Avatar click (open AccountMenu); menuOpen sets aria-expanded. */
  onAvatar?: React.MouseEventHandler;
  menuOpen?: boolean;
  children?: Node;
}
export interface SiteSearchResult {
  title: Node;
  latin?: string;
  cover?: string;
  /** Game page. Tapping the row opens it. */
  href?: string;
  /** «بازی سریع» on the row. */
  quickHref?: string;
  meta?: Array<Node | { icon?: IconName; text: Node }>;
}
export interface SiteSearchProps extends BaseProps {
  value?: string;
  defaultValue?: string;
  onChange?: (q: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Highlighted option (aria-activedescendant). */
  activeIndex?: number;
  /** idle (empty field: recent + popular), results, empty (no result + suggestions). Default: from the value and results. */
  state?: 'idle' | 'results' | 'empty';
  /** Up to 6 games (idle: «محبوب این هفته»). */
  results?: SiteSearchResult[];
  recent?: Array<string | { label: Node; href?: string }>;
  filters?: Array<string | { label: Node; href?: string; selected?: boolean; icon?: IconName }>;
  categories?: Array<string | { label: Node; href?: string }>;
  suggestions?: Array<string | { label: Node; href?: string }>;
  /** e.g. finglish: «نتیجه برای «کاتان»؛ katan را فینگلیش خواندیم». */
  hint?: Node;
  emptyTitle?: Node;
  emptyText?: Node;
  allHref?: string;
  /** Ctrl K and «/» focus the field (default true). Esc clears, then closes. */
  shortcut?: boolean;
  /** Phone: the full-screen sheet opened from the top bar's magnifier. */
  sheet?: boolean;
  onClose?: () => void;
  onClearRecent?: () => void;
  placeholder?: string;
  label?: string;
}
export interface AccountMenuProps extends BaseProps {
  user: { name: Node; sub?: Node; initials?: string; src?: string };
  /** Coin balance (also shown on «اشتراک و سکه»). */
  coins?: number;
  coinsHref?: string;
  buyHref?: string;
  /** Show «پنل مدیریت» (tagged «فقط مدیران»). */
  admin?: boolean;
  /** Counts by item key: { messages: 4 }. */
  counts?: Record<string, number>;
  /** Replace the canonical 14 items. '-' = separator. */
  items?: Array<'-' | { icon?: IconName; label: Node; href?: string; key?: string; tag?: Node; danger?: boolean; focus?: boolean }>;
  label?: string;
}
export interface SiteFooterProps extends BaseProps {
  logo?: { src: string };
  about?: Node;
  storeHref?: string | false;
  storeLabel?: Node;
  /** Link columns (default: بازی‌های محبوب، جامعه، پشتیبانی و قوانین). Each link is [label, href]. */
  columns?: Array<{ title: Node; links: Array<[Node, string] | { label: Node; href: string }> }>;
  /** Phone accordion: which column starts open (default 0). */
  defaultOpen?: number;
  seal?: Node | false;
  copyright?: Node;
  social?: Array<{ icon: IconName; label: string; href?: string }>;
  /** Force the phone accordion (previews). */
  phone?: boolean;
  /** Force the four desktop columns (previews, mock-ups). */
  wide?: boolean;
}
export interface StepperProps extends BaseProps {
  /** Default: شماره، کد تأیید، پروفایل. */
  steps?: Node[];
  /** 0-based current step: earlier = done (navy disc + tick), current = navy ring, later = white disc. */
  current?: number;
  align?: 'center' | 'start';
  label?: string;
}
export interface LoginSheetProps extends BaseProps {
  /** Game cover (small). */
  cover?: string;
  title?: Node;
  /** e.g. «صندلی ۳ میز کاتانِ نیلوفر ۲ دقیقه برای شما نگه داشته می‌شود.» */
  text?: Node;
  step?: number;
  cta?: Node;
  legal?: Node;
  onClose?: () => void;
  /** Overlay mode: a scrim over the positioned container (tap = onClose) and the sheet pinned to its bottom. */
  scrim?: boolean;
  phoneProps?: PhoneFieldProps;
  children?: Node;
}
export interface MoreTileProps extends BaseProps {
  icon?: IconName;
  label?: Node;
  href?: string;
  /** Crimson unread count. */
  count?: number;
  /** Amber «نوبت» count. */
  turns?: number;
  children?: Node;
}
export interface MoreGroupProps extends BaseProps {
  /** بازی و میز · پروفایل و پیشرفت · اجتماعی · حساب و کیف پول */
  title: Node;
  items?: MoreTileProps[];
  children?: Node;
}
export interface TopBarProps extends BaseProps {
  title: Node;
  /** Shows a back button (arrow-right in RTL) in place of the logo. */
  onBack?: () => void;
  backLabel?: string;
  /** Usually the symbol logo (44px target). */
  leading?: Node;
  /** Magnifier after the title (opens the full-screen SiteSearch sheet): {href} / {onClick} or a node. */
  search?: { href?: string; onClick?: () => void } | Node;
  /** After the search: coin chip and bell; for a guest the secondary «ورود / ثبت‌نام». */
  actions?: Node;
  children?: Node;
}
export interface DockProps extends BaseProps {
  /** 4 items: خانه، میزها، پیام‌ها، بیشتر (games and a game page keep خانه current). The current one is an amber token. `count` = crimson unread; `turns` = count of tables waiting for your move. On 404 and notifications no item is active. */
  items: Array<{ icon: IconName; label: Node; href?: string; active?: boolean; count?: number; turns?: number; onClick?: React.MouseEventHandler }>;
  /** Pages without AppShell: float 12px from the bottom and sides (`.bgv-dock--float`, fixed, z `--z-dock`); hidden from 900px up. */
  float?: boolean;
  /** Guest: same four items, no counts. */
  guest?: boolean;
  label?: string;
}
export interface PageTabsProps extends BaseProps {
  items: Array<{ value: string; label: Node; href?: string; count?: number }>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  label?: string;
}
export interface TabsProps extends BaseProps {
  items: Array<{ value: string; label: Node; icon?: IconName; count?: number; countTone?: BadgeProps['tone'] }>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  label?: string;
}
export interface BreadcrumbsProps extends BaseProps {
  /** Last item is the current page. */
  items: Array<{ label: Node; href?: string }>;
  label?: string;
}
export interface PaginationProps extends BaseProps {
  /** Current page, 1-based: the navy selection token with aria-current="page". */
  page: number;
  pages: number;
  onChange?: (page: number) => void;
  label?: string;
}
export interface MenuItem {
  icon?: IconName;
  label: Node;
  /** Crimson destructive item (حذف، گزارش، مسدود). */
  danger?: boolean;
  /** Trailing muted meta, e.g. «۲ دقیقه» or a shortcut. */
  meta?: Node;
  separator?: boolean;
  disabled?: boolean;
  /** Keyboard-focus highlight (for specs). */
  focus?: boolean;
  /** Renders the item as a link (account menu). */
  href?: string;
  onClick?: React.MouseEventHandler;
}
export interface MenuProps extends BaseProps {
  /** Items; `'-'` or `{separator:true}` draws a separator. */
  items: Array<MenuItem | '-'>;
  label?: string;
  children?: Node;
}
export interface PageHeadProps extends BaseProps {
  title: Node;
  sub?: Node;
  eyebrow?: Node;
  /** Buttons at the end (one primary at most). */
  actions?: Node;
  /** 1 = h1 (default), 2 = h2. */
  level?: 1 | 2;
  children?: Node;
}
export interface HeroProps extends BaseProps {
  eyebrow?: Node;
  title?: Node;
  text?: Node;
  actions?: Node;
  /** Right-side (start-end) panel, e.g. a progress plate. */
  aside?: Node;
  /** Force dark tokens inside the hero. */
  dark?: boolean;
  children?: Node;
}

/* ── Overlays ──────────────────────────────────────────────────── */
export interface DialogProps extends BaseProps {
  title?: Node;
  /** Leading icon tile. */
  icon?: IconName;
  /** Destructive confirm: crimson icon tile, role alertdialog. */
  danger?: boolean;
  /** Footer buttons (cancel, then the one main action). */
  footer?: Node;
  /** Shows a close button; also scrim click in modal mode. */
  onClose?: () => void;
  closeLabel?: string;
  /** Render fixed with a scrim. Default false (inline, for specs and previews). */
  modal?: boolean;
  children?: Node;
}
export interface SheetProps extends BaseProps {
  /** Desktop side panel (all corners rounded, no handle). */
  side?: boolean;
  title?: Node;
  icon?: IconName;
  footer?: Node;
  onClose?: () => void;
  /** Show the drag handle (bottom sheets). Default true. */
  handle?: boolean;
  closeLabel?: string;
  children?: Node;
}
export interface PopoverProps extends BaseProps {
  title?: Node;
  children?: Node;
}
export interface ToastProps extends BaseProps {
  /** turn = amber «نوبت شماست»; critical = crimson last seconds; default = ink. */
  tone?: 'default' | 'turn' | 'critical';
  title?: Node;
  text?: Node;
  /** Icon name or false for none. */
  icon?: IconName | false;
  /** Node or {label,onClick} rendered as a small outline button. */
  action?: Node | ({ label: Node } & ButtonProps);
  onClose?: () => void;
  children?: Node;
}
export interface BannerProps extends BaseProps {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: Node;
  text?: Node;
  icon?: IconName;
  action?: Node;
  onClose?: () => void;
  children?: Node;
}
export interface CritBarProps extends BaseProps {
  /** Seconds left (live games, last 10s). */
  seconds?: number;
  /** Total seconds, to derive `p`. */
  total?: number;
  /** Remaining fraction 0–1. */
  p?: number;
  /** One bold line, e.g. «۸ ثانیه تا حرکت خودکار». */
  title?: Node;
  /** One short line, e.g. «وگرنه یک کارت کشیده و نوبت رد می‌شود». */
  sub?: Node;
  /** Old name of `title`. */
  text?: Node;
  icon?: IconName;
  action?: Node;
}

/* ── Table ─────────────────────────────────────────────────────── */
export interface TableScreenProps extends BaseProps {
  /** Desktop grid: rail 296 (inline-start, right in RTL) | felt + action dock | chat 360 (inline-end) with the game bar on top; fluid height, min 900px. <1200 the chat column hides (open it from the game bar as a side sheet); <900 the phone order. */
  desk?: boolean;
  /** With `desk`: auto (viewport decides) or force full / mid (rail + felt) / phone — for previews and screenshots. */
  layout?: 'auto' | 'full' | 'mid' | 'phone';
  children?: Node;
}
export interface GameBarProps extends BaseProps {
  /** Persian game name. */
  title: Node;
  latin?: string;
  /** Meta items (pace, clock rule, table type, Connection, Spectators): each is a whole .bgv-gamebar__mi; when space runs out a whole item drops. Separated by dots, never «·». */
  meta?: Node[];
  /** Icon buttons at the end (sound, fullscreen, chat, leave). */
  actions?: Node;
  onBack?: () => void;
  backLabel?: string;
  children?: Node;
}
export interface FeltProps extends BaseProps {
  /** felt = cards on cloth; board = a game board sits ON the felt; world = full-bleed art (Gaia). */
  variant?: 'felt' | 'board' | 'world';
  /** Board art (variant board). */
  board?: Node;
  /** Top row (turn pill + plates). */
  top?: Node;
  /** Bottom row of plates. */
  bottom?: Node;
  /** CSS background for variant world. */
  world?: string;
  /** The game's OWN UI (board, hand, game controls) rendered as-is inside our frame: an image URL (capture) or the renderer node. Letterboxed, never stretched. */
  stage?: string | Node;
  /** Width / height of the stage content (e.g. 728/718) so it keeps its shape at any size. */
  stageRatio?: number | string;
  stageAlt?: string;
  /** Root element. Default "div" (use "main" on the screen). */
  as?: string;
  label?: string;
  children?: Node;
}
export interface FeltPlateProps extends BaseProps {
  icon?: IconName;
  seat?: SeatNo;
  label?: Node;
  /** Bold number. */
  value?: Node;
  children?: Node;
}
export interface ClockProps extends BaseProps {
  /** calm >50%, warn 50%→critical, critical (live: last 10 s; turn-based: last hour — Table.tsx lowSeconds), paused, stale (your connection dropped), frozen (server incident). Auto from `p` when omitted (≤50% warn, ≤20% critical). */
  state?: ClockState;
  /** Remaining fraction 0–1. */
  p?: number;
  /** Seconds (formatted «۰:۴۲», «۱۲:۰۵», «۵ ساعت و ۲۰ دقیقه», «۲ روز»; chips drop the minutes: «۵ ساعت») or ready text. */
  time: number | string;
  /** Second line, e.g. «زمان شما», «بانک زمان», «+۵ ثانیه». */
  sub?: Node;
  /** chip (HUD), md (turn pill, default), lg (action dock), bar (thin track). */
  size?: 'chip' | 'md' | 'lg' | 'bar';
  /** Ring icon; default pause (paused) / lock (frozen). null for none. */
  icon?: IconName | null;
  /** Screen-reader label. */
  label?: string;
}
export interface TurnPillProps extends BaseProps {
  /** Player name («نوبت نیلوفر»). */
  who?: Node;
  seat?: SeatNo;
  initials?: string;
  src?: string;
  avatar?: AvatarProps;
  /** Your turn: amber pill «نوبت شماست». */
  mine?: boolean;
  /** Simultaneous phase text, e.g. «همه انتخاب می‌کنند، ۲ از ۴ آماده». */
  simul?: Node;
  /** Clock props or node after a divider. */
  clock?: ClockProps | Node;
  /** Override the text. */
  text?: Node;
}
export interface StrikesProps extends BaseProps {
  /** Timeouts used. */
  used: number;
  /** Limit. Default 3. */
  of?: number;
  /** Add «اخطار ۱ از ۳» text. */
  showLabel?: boolean;
}
export interface HudStatProps extends BaseProps {
  /** Icon name (or use `resource`). */
  icon?: IconName;
  /** Resource swatch colour (game art may use literal colours). */
  resource?: string;
  value: Node;
  label?: Node;
  /** Change since last turn; animated pop. */
  delta?: number | string;
  /** Tile form for the action dock (label over big number). */
  tile?: boolean;
}
export interface PlayerCardProps extends BaseProps {
  /** mini (phone strip), default (desktop rail), wide (duel, on felt). */
  variant?: 'mini' | 'default' | 'wide';
  name: Node;
  initials?: string;
  src?: string;
  avatar?: AvatarProps;
  seat?: SeatNo;
  you?: boolean;
  bot?: boolean;
  /** «آسان» | «متوسط» | «سخت». */
  botLevel?: string;
  status?: 'online' | 'away' | 'offline';
  frame?: FrameTier;
  title?: Node;
  league?: LeagueTier;
  level?: number;
  sub?: Node;
  /** Primary stat of the game. */
  score?: Node;
  /** Unit under the score («امتیاز», «کارت در دست»). */
  scoreLabel?: Node;
  /** 1–3 key secondary stats (HudStat props or nodes). */
  stats?: Array<HudStatProps | Node>;
  /** The player's clock (chip on mini/default, md on wide). */
  clock?: ClockProps;
  /** Timeouts used (shows dots; label on default/wide). */
  strikes?: number;
  strikesOf?: number;
  /** Their turn: edge in clock colour, spinning avatar ring. */
  turn?: boolean;
  /** Eliminated (string = custom text). */
  out?: boolean | string;
  /** Offline (string = custom text). */
  offline?: boolean | string;
  /** Leading: «پیشتاز» over the score. */
  leader?: boolean;
  /** Done/ready this phase (string = custom text). */
  done?: boolean | string;
  /** Waiting text, e.g. «۲ نوبت دیگر». */
  waiting?: Node;
  /** Extra badge (e.g. «اونو!»). */
  badge?: Node;
  /** Footer row node. */
  foot?: Node;
  /** Expanded public stats grid. */
  detail?: Node;
  /** Card sits on the felt (duel): on-felt clock colours. */
  onFelt?: boolean;
  onClick?: React.MouseEventHandler;
  children?: Node;
}
export interface HudProps extends BaseProps {
  /** strip (phone, ≤5 mini cards), rail (desktop column), duel (two wide cards), grid3 (5–10 players, rows of 3). */
  layout?: 'strip' | 'rail' | 'duel' | 'grid3';
  /** PlayerCard props; variant picked from the layout. */
  players?: PlayerCardProps[];
  onFelt?: boolean;
  label?: string;
  children?: Node;
}
export interface RaceProps extends BaseProps {
  /** Rows in rank order. `p` 0–1 bar length (auto from value/max). */
  rows: Array<{ seat: SeatNo; name: Node; value: number | string; p?: number; you?: boolean }>;
  /** Target or scale maximum. */
  max?: number;
  label?: string;
}
export interface TeamPlateProps extends BaseProps {
  /** Amber (--felt-gold) label, e.g. «تیم» or «جهت». */
  label?: Node;
  /** Shared resources; with `of` they render pips («۵/۸»). */
  resources?: Array<{ icon?: IconName; label?: Node; value: number; of?: number; tone?: string }>;
  children?: Node;
}
export interface ActionDockProps extends BaseProps {
  /** What to do now («یک کارت بازی کنید») or who is next. */
  prompt?: Node;
  /** Your resources: HudStat props (tile form) or nodes. */
  resources?: Array<HudStatProps | Node> | Node;
  /** Button props (with `label`) or nodes; one primary. */
  actions?: Array<(ButtonProps & { label: Node }) | Node> | Node;
  /** Your clock (lg by default). */
  clock?: ClockProps | Node;
  /** Not your turn: sunken dock. */
  waiting?: boolean;
  label?: string;
  children?: Node;
}
export interface MoveLogProps extends BaseProps {
  /** Entries newest last; `{round:'دور ۳'}` draws a round divider. */
  items: Array<{ seat?: SeatNo; icon?: IconName; name?: Node; text?: Node; time?: Node; isNew?: boolean; round?: Node }>;
  label?: string;
}
export interface LobbySeatProps extends Omit<IdentityProps, 'name'> {
  /** Empty seat → dashed amber invite chip. */
  empty?: boolean;
  inviteLabel?: Node;
  onInvite?: () => void;
  name?: Node;
  /** true «آماده», false «منتظر». */
  ready?: boolean;
  /** «میزبان» tag. */
  host?: boolean;
  actions?: Node;
  onClick?: React.MouseEventHandler;
  children?: Node;
}
export interface ReadyCheckProps extends BaseProps {
  title?: Node;
  text?: Node;
  players: Array<{ name: Node; seat?: SeatNo; initials?: string; src?: string; you?: boolean; bot?: boolean; ready?: boolean }>;
  clock?: ClockProps;
  actions?: Node;
  children?: Node;
}
export interface SpectatorsProps extends BaseProps {
  count: number;
  /** Add the word «تماشاگر». */
  showLabel?: boolean;
}
export interface ConnectionProps extends BaseProps {
  state?: 'ok' | 'retry' | 'lost';
  /** Override text («متصل», «در حال اتصال دوباره…», «اتصال قطع شد»). */
  label?: Node;
}
export interface PodiumPlace {
  name: Node;
  seat?: SeatNo;
  initials?: string;
  src?: string;
  you?: boolean;
  bot?: boolean;
  /** Under the name, e.g. «۱۰ امتیاز». */
  meta?: Node;
}
export interface PodiumProps extends BaseProps {
  /** In rank order [1st, 2nd, 3rd]; drawn 2-1-3. */
  places: PodiumPlace[];
  label?: string;
}
export interface RewardProps extends BaseProps {
  icon?: IconName;
  /** Coin glyph instead of an icon. */
  coin?: boolean;
  label: Node;
  /** Signed number (+۱۹) or text («باز شد»). */
  value?: number | string;
  dir?: 'up' | 'down';
  /** Unit after the value («XP», «سکه»). */
  unit?: string;
  /** 0–1 progress bar under the label (XP). */
  progress?: number;
  progressText?: Node;
  children?: Node;
}
export interface RematchProps extends BaseProps {
  title?: Node;
  votes: Array<{ name: Node; seat?: SeatNo; initials?: string; src?: string; you?: boolean; vote?: 'yes' | 'no' | 'wait' }>;
  /** Vote countdown (Clock props, chip). */
  countdown?: ClockProps | Node;
  note?: Node;
  actions?: Node;
  children?: Node;
}
export interface ResultProps extends BaseProps {
  title: Node;
  sub?: Node;
  /** Text (green success badge with a trophy) or node. */
  badge?: Node;
  /** Podium places or a node. */
  podium?: PodiumPlace[] | Node;
  rewards?: Array<RewardProps | Node>;
  actions?: Node;
  children?: Node;
}

/* ── Chat ──────────────────────────────────────────────────────── */
export interface ChatProps extends BaseProps {
  title?: Node;
  icon?: IconName;
  /** Per-table mute button: true (uncontrolled) or {muted,onToggle}. */
  mutedToggle?: boolean | { muted?: boolean; onToggle?: (muted: boolean) => void };
  onClose?: () => void;
  /** Spectators: replaces the composer with «تماشاگرها فقط می‌خوانند» (or custom text). */
  readOnly?: boolean | string;
  /** <Composer/> node. */
  composer?: Node;
  /** Phone bottom sheet (top radius + handle). */
  sheet?: boolean;
  /** Anchor messages to the bottom. */
  bottom?: boolean;
  headExtra?: Node;
  children?: Node;
}
export interface MessageProps extends BaseProps {
  /** Your message: primary bubble at the end side. */
  mine?: boolean;
  author?: Node;
  seat?: SeatNo;
  initials?: string;
  src?: string;
  avatar?: AvatarProps;
  league?: LeagueTier;
  title?: Node;
  time?: Node;
  /** Text; «@name» tokens become mentions (filled navy when equal to `viewer`). */
  text?: string | Node;
  /** Viewer's name, to highlight their mentions. */
  viewer?: string;
  reply?: { author: Node; text: Node };
  reactions?: Array<{ emoji: string; count: number; mine?: boolean; label?: string }>;
  onReact?: (emoji: string) => void;
  /** Your message was seen (double check). */
  seen?: boolean;
  state?: 'sent' | 'pending' | 'failed' | 'deleted';
  onRetry?: () => void;
  edited?: boolean;
  /** Big emoji / quick-chat message without bubble. */
  quick?: boolean;
  /** Message mentions you: white bubble with a 2px navy outline (cream in dark). */
  mentioned?: boolean;
  deletedText?: Node;
  children?: Node;
}
export interface SystemMessageProps extends BaseProps {
  /** Game event (outlined) vs system notice (filled). */
  game?: boolean;
  seat?: SeatNo;
  icon?: IconName;
  text?: Node;
  children?: Node;
}
export interface ReactionsProps extends BaseProps {
  items: Array<{ emoji: string; count: number; mine?: boolean; label?: string }>;
  onToggle?: (emoji: string) => void;
  /** Shows an add-reaction button. */
  onAdd?: () => void;
}
export interface ReactionBarProps extends BaseProps {
  /** Default 👍 😂 😮 😢 🔥 👏. */
  emojis?: string[];
  onPick?: (emoji: string) => void;
  /** Trailing «more» button (true or handler). */
  more?: boolean | (() => void);
  /** Your current reaction. */
  selected?: string;
}
export interface MentionProps extends BaseProps {
  name?: Node;
  /** Mention of the viewer: filled navy token (cream in dark). */
  you?: boolean;
  children?: Node;
}
export interface MentionSuggestProps extends BaseProps {
  /** Grouped people («بازیکن‌های این میز», «تماشاگرها»). */
  groups?: Array<{ title?: Node; items: MentionSuggestItem[] }>;
  items?: MentionSuggestItem[];
  onPick?: (name: string) => void;
  label?: string;
}
export interface MentionSuggestItem {
  name: string;
  seat?: SeatNo;
  initials?: string;
  src?: string;
  bot?: boolean;
  meta?: Node;
  metaIcon?: IconName;
  focus?: boolean;
}
export interface ComposerProps extends BaseProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  /** Enter sends; Shift+Enter breaks a line. */
  onSend?: (value: string) => void;
  /** Reply preview strip. */
  reply?: { author: Node; text: Node; onCancel?: () => void };
  /** Context-aware quick messages above the field. */
  quick?: string[];
  onQuick?: (text: string) => void;
  onEmoji?: () => void;
  disabled?: boolean;
  sendLabel?: string;
  children?: Node;
}
export interface QuickChatProps extends BaseProps {
  items: string[];
  onPick?: (text: string) => void;
  label?: string;
}
export interface TypingProps extends BaseProps {
  names?: string[];
  text?: Node;
}
export interface UnreadDividerProps extends BaseProps {
  count?: number;
  text?: Node;
}
export interface ConversationProps extends BaseProps {
  name: Node;
  initials?: string;
  src?: string;
  seat?: SeatNo;
  /** Group/club icon instead of an avatar. */
  icon?: IconName;
  status?: 'online' | 'away' | 'offline';
  /** Last message preview. */
  preview?: Node;
  time?: Node;
  unread?: number;
  /** You were mentioned: crimson «@» count badge. */
  mention?: boolean;
  muted?: boolean;
  active?: boolean;
  href?: string;
  onClick?: React.MouseEventHandler;
}

/* ── Notifications ─────────────────────────────────────────────── */
export interface NotificationItemProps extends BaseProps {
  /** turn = amber tile, urgent = crimson, reward = neutral tile (no solid amber, v2.1.2), default = neutral. */
  kind?: 'turn' | 'urgent' | 'reward' | 'default';
  icon?: IconName;
  /** Avatar props instead of the icon tile (friend requests). */
  avatar?: AvatarProps;
  /** Main line (bold the names/games). */
  title: Node;
  text?: Node;
  time?: Node;
  unread?: boolean;
  /** Button props (+label) or nodes. */
  actions?: Array<(ButtonProps & { label: Node }) | Node> | Node;
  /** Root element ("li" inside a list). */
  as?: string;
  children?: Node;
}
export interface PushNotificationProps extends BaseProps {
  app?: Node;
  /** URL of app-icon.svg from the brand kit. */
  iconSrc?: string;
  time?: Node;
  title?: Node;
  text?: Node;
}

/* ── Profile ───────────────────────────────────────────────────── */
export interface BannerArtProps extends BaseProps {
  variant?: 'felt' | 'coral' | 'gold' | 'night' | 'cream';
  /** px. Default 160. */
  height?: number;
  /** Art layered on top (pattern, illustration). */
  children?: Node;
}
export interface ProfileHeadProps extends BaseProps {
  banner?: BannerArtProps['variant'];
  bannerArt?: Node;
  name: Node;
  initials?: string;
  src?: string;
  status?: 'online' | 'away' | 'offline';
  avatar?: AvatarProps;
  frame?: FrameTier;
  title?: Node;
  league?: LeagueTier;
  level?: number;
  /** Badges after the name (premium). */
  badges?: Node;
  /** Meta line items (online state, current game, member since). */
  meta?: Node | Node[];
  actions?: Node;
  /** 2–4 stats under the header. */
  stats?: Array<{ value: Node; label: Node }>;
  /** Phone layout: xl avatar, shorter banner. */
  compact?: boolean;
  /** Bio paragraph. */
  children?: Node;
}
export interface TrophyProps extends BaseProps {
  tier?: 'bronze' | 'silver' | 'gold' | 'turquoise' | 'diamond';
  locked?: boolean;
  icon?: IconName;
  name?: Node;
  /** Progress or date, e.g. «۳۲ از ۵۰». */
  sub?: Node;
}
export interface CosmeticTileProps extends BaseProps {
  /** Preview art (avatar part, card back, board skin swatch). */
  art: Node;
  name: Node;
  state?: 'owned' | 'equipped' | 'locked' | 'trying';
  /** Coin price (locked items). */
  price?: number;
  /** Lock reason when not for sale («سطح ۲۰»). */
  lockText?: Node;
  rarity?: RarityProps['level'];
  /** Premium-subscription exclusive. */
  premium?: boolean;
  onClick?: React.MouseEventHandler;
}
export interface RarityProps extends BaseProps {
  level: 'common' | 'rare' | 'epic' | 'legend';
  children?: Node;
}
export interface CardBackProps extends BaseProps {
  /** Back colour (game art; literal colours allowed). */
  color?: string;
  /** Width px. Default 72 (5:7). */
  width?: number;
  label?: string;
  /** Pattern art; default a sparkle glyph. */
  children?: Node;
}

declare const Bgv: {
  Logo: React.FC<LogoProps>;
  Button: React.FC<ButtonProps>; Chip: React.FC<ChipProps>; ChipGroup: React.FC<ChipGroupProps>;
  TextField: React.FC<TextFieldProps>; Textarea: React.FC<TextareaProps>; Select: React.FC<SelectProps>; Checkbox: React.FC<CheckboxProps>; Radio: React.FC<RadioProps>;
  Switch: React.FC<SwitchProps>; Segmented: React.FC<SegmentedProps>; OtpField: React.FC<OtpFieldProps>; PhoneField: React.FC<PhoneFieldProps>; Slider: React.FC<SliderProps>;
  Icon: React.FC<IconProps>; Badge: React.FC<BadgeProps>; Tag: React.FC<TagProps>; ModeTag: React.FC<ModeTagProps>; Coin: React.FC<CoinProps>; Avatar: React.FC<AvatarProps>; Frame: React.FC<FrameProps>;
  Seat: React.FC<SeatProps>; Identity: React.FC<IdentityProps>; League: React.FC<LeagueProps>; Card: React.FC<CardProps>; GameCard: React.FC<GameCardProps>; Stat: React.FC<StatProps>;
  Progress: React.FC<ProgressProps>; Ring: React.FC<RingProps>; Skeleton: React.FC<SkeletonProps>; StateBlock: React.FC<StateBlockProps>; DataTable: React.FC<DataTableProps>;
  ListItem: React.FC<ListItemProps>; Tooltip: React.FC<TooltipProps>; Divider: React.FC<DividerProps>;
  AppShell: React.FC<AppShellProps>; SiteHeader: React.FC<SiteHeaderProps>; SiteSearch: React.FC<SiteSearchProps>; AccountMenu: React.FC<AccountMenuProps>; SiteFooter: React.FC<SiteFooterProps>; MoreTile: React.FC<MoreTileProps>; MoreGroup: React.FC<MoreGroupProps>; Stepper: React.FC<StepperProps>; LoginSheet: React.FC<LoginSheetProps>; TopBar: React.FC<TopBarProps>; Dock: React.FC<DockProps>; PageTabs: React.FC<PageTabsProps>; Tabs: React.FC<TabsProps>;
  Breadcrumbs: React.FC<BreadcrumbsProps>; Pagination: React.FC<PaginationProps>; Menu: React.FC<MenuProps>; PageHead: React.FC<PageHeadProps>; Hero: React.FC<HeroProps>;
  Dialog: React.FC<DialogProps>; Sheet: React.FC<SheetProps>; Popover: React.FC<PopoverProps>; Toast: React.FC<ToastProps>; Banner: React.FC<BannerProps>; CritBar: React.FC<CritBarProps>;
  TableScreen: React.FC<TableScreenProps>; GameBar: React.FC<GameBarProps>; Felt: React.FC<FeltProps>; FeltPlate: React.FC<FeltPlateProps>; TurnPill: React.FC<TurnPillProps>;
  Clock: React.FC<ClockProps>; Strikes: React.FC<StrikesProps>; PlayerCard: React.FC<PlayerCardProps>; Hud: React.FC<HudProps>; HudStat: React.FC<HudStatProps>; Race: React.FC<RaceProps>;
  TeamPlate: React.FC<TeamPlateProps>; ActionDock: React.FC<ActionDockProps>; MoveLog: React.FC<MoveLogProps>; LobbySeat: React.FC<LobbySeatProps>; ReadyCheck: React.FC<ReadyCheckProps>;
  Spectators: React.FC<SpectatorsProps>; Connection: React.FC<ConnectionProps>; Result: React.FC<ResultProps>; Podium: React.FC<PodiumProps>; Reward: React.FC<RewardProps>; Rematch: React.FC<RematchProps>;
  Chat: React.FC<ChatProps>; Message: React.FC<MessageProps>; SystemMessage: React.FC<SystemMessageProps>; Reactions: React.FC<ReactionsProps>; ReactionBar: React.FC<ReactionBarProps>;
  Mention: React.FC<MentionProps>; MentionSuggest: React.FC<MentionSuggestProps>; Composer: React.FC<ComposerProps>; QuickChat: React.FC<QuickChatProps>; Typing: React.FC<TypingProps>;
  UnreadDivider: React.FC<UnreadDividerProps>; Conversation: React.FC<ConversationProps>;
  NotificationItem: React.FC<NotificationItemProps>; PushNotification: React.FC<PushNotificationProps>;
  ProfileHead: React.FC<ProfileHeadProps>; BannerArt: React.FC<BannerArtProps>; Trophy: React.FC<TrophyProps>; CosmeticTile: React.FC<CosmeticTileProps>; Rarity: React.FC<RarityProps>; CardBack: React.FC<CardBackProps>;
  /** Persian digits («٬» separators for numbers). */
  readonly fa: (v: unknown) => unknown;
  /** Seconds → «۰:۴۲» / «۱۲:۰۵» / «۵ ساعت و ۲۰ دقیقه» / «۲ روز». */
  readonly formatTime: (seconds: number, compact?: boolean) => string;
  /** Names of the embedded lucide icons. */
  readonly iconNames: string[];
};
export default Bgv;
declare global { interface Window { Bgv: typeof Bgv; } }
