// App glue for the BGV design-system components: router-aware links, the user's built avatar, identity props.
import { useMemo, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { avatarSvg, cosmetic, parseAvatar, type League } from '@bg/contracts';
import type { IdentityProps } from '@bg/ui/bgv';

/**
 * DS components render plain <a href> links. Put the returned handler on a container (the app shell) and every
 * same-origin link inside it navigates in-app instead of reloading the page.
 */
export function useLinkRouting() {
  const navigate = useNavigate();
  return (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.origin !== location.origin) return;
    const href = a.getAttribute('href') ?? '';
    if (href === '#' || href.startsWith('#')) { if (href === '#') e.preventDefault(); return; }
    e.preventDefault();
    navigate(a.pathname + a.search + a.hash);
  };
}

/** The user's built avatar as inline SVG art (catalogue SVG only, so the markup is trusted), or undefined. */
export function AvatarArt({ avatarKey }: { avatarKey: string }) {
  const svg = useMemo(() => { const p = parseAvatar(avatarKey); return p ? avatarSvg(p) : null; }, [avatarKey]);
  if (!svg) return null;
  return <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
}

const initials = (name: string) => name.trim().charAt(0);

/** Identity props for a user: name, avatar art (or initial), «لقب» title. Add league/level/status/seat at the call site. */
export function userIdentity(u: { displayName: string; avatarKey: string; titleKey?: string | null }, extra?: Partial<IdentityProps>): IdentityProps {
  const art = parseAvatar(u.avatarKey) ? <AvatarArt avatarKey={u.avatarKey} /> : undefined;
  const title = u.titleKey ? cosmetic(u.titleKey)?.nameFa : undefined;
  return {
    name: <bdi>{u.displayName}</bdi>,
    initials: initials(u.displayName),
    ...(title ? { title } : {}),
    ...extra,
    avatar: { name: `آواتار ${u.displayName}`, ...(art ? { children: art } : {}), ...extra?.avatar }
  };
}

const LEAGUE_ORDER: League[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
/** Highest league across the user's ratings (null when unrated). */
export function bestLeague(ratings: { league: League | null }[]): League | null {
  let best = -1;
  for (const r of ratings) if (r.league) best = Math.max(best, LEAGUE_ORDER.indexOf(r.league));
  return best < 0 ? null : LEAGUE_ORDER[best]!;
}
