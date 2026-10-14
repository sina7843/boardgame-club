// BGV design system v1.3 — the only UI component source for the app (see design/CLAUDE.design-system.md).
import Bgv from './bgv.js';

export type * from './bgv.js';
export const {
  Logo, Button, Chip, ChipGroup, TextField, Textarea, Select, Checkbox, Radio, Switch, Segmented, OtpField, PhoneField, Slider, Icon, Badge, Tag, Coin, Avatar, Frame, Seat, Identity, League, Card, GameCard, Stat, Progress, Ring, Skeleton, StateBlock, DataTable, ListItem, Tooltip, Divider, AppShell, Sidebar, NavItem, TopBar, Dock, PageTabs, Tabs, Breadcrumbs, Pagination, Menu, PageHead, Hero, Dialog, Sheet, Popover, Toast, Banner, CritBar, TableScreen, GameBar, Felt, FeltPlate, TurnPill, Clock, Strikes, PlayerCard, Hud, HudStat, Race, TeamPlate, ActionDock, MoveLog, LobbySeat, ReadyCheck, Spectators, Connection, Result, Podium, Reward, Rematch, Chat, Message, SystemMessage, Reactions, ReactionBar, Mention, MentionSuggest, Composer, QuickChat, Typing, UnreadDivider, Conversation, NotificationItem, PushNotification, ProfileHead, BannerArt, Trophy, CosmeticTile, Rarity, CardBack
} = Bgv;
export const fa = Bgv.fa as (v: unknown) => string;
export const formatTime = Bgv.formatTime;
export const iconNames = Bgv.iconNames;
