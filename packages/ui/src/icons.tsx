// Icons come from lucide (VibeFarsi rule: no hand-drawn SVG). Names stay stable for existing call sites.
import {
  BookOpen, ChevronRight, Club, Castle, Clock, Crown, Dices, House, LayoutGrid, Lock, LogOut, Package, PersonStanding, Play,
  RefreshCw, Search, Settings, Shield, Star, Sun, TriangleAlert, User, Users, WifiOff, X, type LucideIcon
} from 'lucide-react';

const ICONS = {
  home: House, grid: LayoutGrid, settings: Settings, user: User, search: Search, clock: Clock, players: Users, close: X,
  chevron: ChevronRight /* "back": points right in RTL */, alert: TriangleAlert, lock: Lock, offline: WifiOff, box: Package, logout: LogOut, play: Play,
  turn: RefreshCw, shield: Shield, meeple: PersonStanding, dice: Dices, crown: Crown, pawn: Castle, card: Club, star: Star,
  sun: Sun, book: BookOpen
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** strokeWidth follows the adjacent text weight (VibeFarsi craft rule: 1.5 regular, 2 medium/semibold). */
export function Icon({ name, size = 20, className, strokeWidth = 1.75 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  const C = ICONS[name];
  return <C className={className} size={size} strokeWidth={strokeWidth} aria-hidden focusable={false} />;
}
