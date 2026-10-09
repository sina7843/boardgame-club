// Big centred celebration for a level-up or a new achievement. Rewards stay server-derived: this only notices them
// by comparing /me/progression with what this device last celebrated. Never shown on a table page (rewards appear
// only after the game, docs/PROGRESSION.md UX rules); it waits until the player leaves the table.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Progression, TrophyTier } from '@bg/contracts';
import { Button, Confetti } from '@bg/ui';
import { api } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { LevelBadge, TIER_FA, Trophy } from '../lib/rewards.tsx';
import { useSession } from '../lib/session.tsx';

type Moment = { kind: 'level'; level: number } | { kind: 'achievement'; key: string; titleFa: string; descriptionFa: string; tier: TrophyTier };
interface Seen { level: number; keys: string[] }

const MIN_GAP_MS = 20_000;
const storageKey = (userId: string) => `bg.celebrated.${userId}`;
const readSeen = (userId: string): Seen | null => {
  try { return JSON.parse(localStorage.getItem(storageKey(userId)) ?? 'null') as Seen | null; } catch { return null; }
};
const writeSeen = (userId: string, s: Seen) => {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(s)); } catch { /* storage unavailable: may celebrate again next visit */ }
};

/** New moments since `seen`; level-up first, then achievements. First visit on a device only records a baseline. */
export function newMoments(seen: Seen | null, p: Pick<Progression, 'level' | 'achievements'>): Moment[] {
  if (!seen) return [];
  const out: Moment[] = [];
  if (p.level > seen.level) out.push({ kind: 'level', level: p.level });
  for (const a of p.achievements) {
    if (a.grantedAt && !seen.keys.includes(a.key)) out.push({ kind: 'achievement', key: a.key, titleFa: a.titleFa, descriptionFa: a.descriptionFa, tier: a.tier });
  }
  return out;
}

export function Celebration() {
  const { me } = useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Moment[]>([]);
  const lastCheck = useRef(0);
  const ref = useRef<HTMLDialogElement>(null);
  const onTable = pathname.startsWith('/tables/');
  const userId = me?.id;

  const check = useCallback(async (force = false) => {
    if (!userId || onTable || (!force && Date.now() - lastCheck.current < MIN_GAP_MS)) return;
    lastCheck.current = Date.now();
    try {
      const p = await api<Progression>('/me/progression');
      const seen = readSeen(userId);
      const found = newMoments(seen, p);
      writeSeen(userId, { level: Math.max(p.level, seen?.level ?? 0), keys: p.achievements.filter((a) => a.grantedAt).map((a) => a.key) });
      if (found.length) setQueue((q) => [...q, ...found]);
    } catch { /* offline or signed out: try again on the next navigation */ }
  }, [userId, onTable]);

  // Leaving a table is exactly when fresh rewards land, so that check skips the throttle.
  const wasOnTable = useRef(onTable);
  useEffect(() => { void check(wasOnTable.current && !onTable); wasOnTable.current = onTable; }, [pathname, check, onTable]);
  useEffect(() => {
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [check]);

  const current = onTable ? undefined : queue[0];
  useEffect(() => { if (current && ref.current && !ref.current.open) ref.current.showModal(); }, [current]);
  const next = () => setQueue((q) => q.slice(1));

  if (!current) return null;
  const isLevel = current.kind === 'level';
  return (
    <dialog ref={ref} className={`celebrate ${isLevel ? 'celebrate--level' : `tier--${current.tier}`}`} aria-labelledby="celebrate-h" onClose={next}
      onClick={(e) => { if (e.target === e.currentTarget) next(); }}>
      <div className="celebrate__card" key={isLevel ? `l${current.level}` : current.key}>
        <div className="celebrate__rays" aria-hidden />
        <Confetti count={70} spreadX={260} seed={isLevel ? current.level : current.key.length} className="celebrate__confetti"
          colors={['#f5c542', '#22b5b0', '#9b5cf0', '#ffffff', 'var(--brand)']} />
        <p className="celebrate__eyebrow">{isLevel ? 'سطح جدید!' : `دستاورد ${TIER_FA[current.tier]}`}</p>
        <div className="celebrate__art">{isLevel ? <LevelBadge level={current.level} size={180} /> : <Trophy tier={current.tier} />}</div>
        <h2 id="celebrate-h" className="celebrate__title">{isLevel ? `به سطح ${faNum(current.level)} رسیدید` : current.titleFa}</h2>
        <p className="celebrate__desc">{isLevel ? 'با هر بازی کامل، آموزش و مأموریت XP می‌گیرید.' : current.descriptionFa}</p>
        <div className="celebrate__actions">
          <Button variant="primary" onClick={next} autoFocus>{queue.length > 1 ? `بعدی (${faNum(queue.length - 1)})` : 'عالیه!'}</Button>
          <Button variant="ghost" onClick={() => { setQueue([]); navigate('/progress'); }}>دیدن پیشرفت</Button>
        </div>
      </div>
    </dialog>
  );
}
