// Replay of a finished game: the game's own renderer, read-only, inside the table frame. Every step comes from the
// server as the spectator projection of that revision (no hidden information, even for the players).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { TableReplay } from '@bg/contracts';
import { ActionDock, Badge, Button, Felt, GameBar, Hud, Slider, StateBlock, TableScreen, type PlayerCardProps, type SeatNo } from '@bg/ui/bgv';
import { RENDERERS } from '../games/renderers.tsx';
import { ApiFailure, api } from '../lib/api.ts';
import { faNum, jalaliDate } from '../lib/format.ts';
import { replayKey } from '../lib/replay.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { GuestState } from '../shell/GuestState.tsx';

const noop = () => {};

export function ReplayPage() {
  const { id = '' } = useParams();
  const { me, status } = useSession();
  const navigate = useNavigate();
  const cache = useRef(new Map<number, Promise<TableReplay>>());
  const [rev, setRev] = useState(1);
  const [step, setStep] = useState<TableReplay | null>(null);
  const [error, setError] = useState<ApiFailure | Error | null>(null);
  const [nonce, setNonce] = useState(0);
  usePageTitle(step ? `بازپخش ${step.gameNameFa}` : 'بازپخش');

  // Snapshots of a finished game never change: one request per revision (the browser may also serve it from cache).
  const load = useCallback((r: number) => {
    let p = cache.current.get(r);
    if (!p) {
      p = api<TableReplay>(`/tables/${id}/replay?rev=${r}`);
      p.catch(() => cache.current.delete(r));
      cache.current.set(r, p);
    }
    return p;
  }, [id]);

  useEffect(() => {
    if (!me) return;
    let live = true;
    load(rev).then((s) => {
      if (!live) return;
      setStep(s); setError(null);
      if (s.revision > 1) void load(s.revision - 1).catch(noop);
      if (s.revision < s.total) void load(s.revision + 1).catch(noop);
    }, (e: Error) => { if (live) setError(e); });
    return () => { live = false; };
  }, [me, rev, load, nonce]);

  const total = step?.total ?? 1;
  const cur = step?.revision ?? 1;
  const go = useCallback((r: number) => setRev(Math.min(Math.max(r, 1), total)), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const next = replayKey(e.key, cur, total, getComputedStyle(document.documentElement).direction === 'rtl');
      if (next === null) return;
      e.preventDefault();
      go(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cur, total, go]);

  if (status !== 'loading' && !me) return <GuestState title="برای دیدن بازپخش وارد شوید" text="بعد از ورود، مستقیم به همین بازپخش برمی‌گردید." next={`/tables/${id}/replay`} />;
  if (error instanceof ApiFailure && error.status === 403) return <StateBlock kind="denied" title="به این بازپخش دسترسی ندارید" text="بازپخش میزهای خصوصی فقط برای اعضای همان میز است." />;
  if (error instanceof ApiFailure && error.status === 404) return <StateBlock kind="empty" title="این میز پیدا نشد" action={<Button variant="secondary" href="/tables">میزها</Button>} />;
  if (error instanceof ApiFailure && error.status === 409) return <StateBlock kind="empty" title="بازپخش هنوز آماده نیست" text={error.messageFa} action={<Button variant="secondary" href={`/tables/${id}`}>بازگشت به میز</Button>} />;
  if (error && !step) return <StateBlock kind="error" title="بازپخش بارگذاری نشد" text={error instanceof ApiFailure ? error.messageFa : undefined}
    action={<Button variant="primary" icon="refresh-cw" onClick={() => { setError(null); setNonce((n) => n + 1); }}>تلاش دوباره</Button>} />;
  if (!step) return <StateBlock kind="loading" title="در حال بارگذاری بازپخش…" />;

  const Renderer = RENDERERS[step.clientBundleRef];
  const nameOf = (seat: number) => step.seats.find((s) => s.seat === seat)?.name ?? `جایگاه ${faNum(seat + 1)}`;
  const last = cur === total;
  const sum = step.publicSummary;
  const players: PlayerCardProps[] = step.seats.map((s) => {
    const ss = sum?.seats.find((x) => x.seat === s.seat);
    const place = last ? step.result?.placements.find((p) => p.seat === s.seat) : undefined;
    return {
      name: s.name, seat: (Math.min(s.seat, 9) + 1) as SeatNo, avatar: { name: s.name, initials: s.name.charAt(0) },
      ...(ss?.primary ? { score: ss.primary.target !== undefined ? `${faNum(ss.primary.value)}/${faNum(ss.primary.target)}` : ss.primary.value, scoreLabel: ss.primary.label } : {}),
      ...(place ? { score: place.score ?? place.place, scoreLabel: place.score !== undefined ? 'امتیاز' : 'رتبه', leader: place.place === 1 } : {})
    };
  });
  const counter = `حرکت ${faNum(cur)} از ${faNum(total)}`;

  return (
    <div className="tbl">
      <TableScreen desk className="tbl-screen tbl-screen--nochat">
        <div className="tbl-top">
          <GameBar title={step.gameNameFa} latin={step.gameNameOriginal} onBack={() => navigate(`/tables/${id}`)} backLabel="بازگشت به میز"
            meta={[<Badge key="r" size="sm" icon="history">بازپخش</Badge>, ...(step.finishedAt ? [jalaliDate(step.finishedAt)] : [])]} />
        </div>
        <Hud layout="rail" className="tbl-rail" label="بازیکنان" players={players} />
        <Felt as="main" className="tbl-felt" label={`بازپخش ${step.gameNameFa}`}
          stage={<div data-theme="dark" data-game={step.gameId} data-hud={sum ? 'on' : undefined} className="table-night tbl-stage">
            {Renderer
              ? <Renderer view={step.view as never} legalActions={[]} mySeat={null} seatName={nameOf} busy onAction={noop} expected={null} />
              : <StateBlock kind="error" title="رابط این نسخه از بازی در دسترس نیست" text={<>این بازی با نسخه <bdi dir="ltr">{step.clientBundleRef}</bdi> انجام شده است که در این نسخه از برنامه وجود ندارد.</>} />}
          </div>} />
        <ActionDock className="tbl-dock" label="کنترل بازپخش"
          prompt={<span className="tbl-prompt" role="status" aria-live="polite"><strong>{counter}</strong></span>}
          actions={<>
            <Button size="sm" variant="secondary" iconOnly icon="arrow-right" disabled={cur <= 1} onClick={() => go(1)}>اول</Button>
            <Button size="sm" variant="secondary" iconOnly icon="chevron-right" disabled={cur <= 1} onClick={() => go(cur - 1)}>قبلی</Button>
            <Button size="sm" variant="secondary" iconOnly icon="chevron-left" disabled={last} onClick={() => go(cur + 1)}>بعدی</Button>
            <Button size="sm" variant="secondary" iconOnly icon="arrow-left" disabled={last} onClick={() => go(total)}>آخر</Button>
          </>}>
          {total > 1 && <Slider aria-label="حرکت" min={1} max={total} step={1} value={cur} aria-valuetext={counter} onChange={(e) => go(Number(e.currentTarget.value))} />}
        </ActionDock>
      </TableScreen>
    </div>
  );
}
