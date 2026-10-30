// Site onboarding UI: guided tours (highlight + short note), walkthroughs (the player really does each step) and
// contextual hints. Guides come from the registry in contracts/onboarding.ts; progress lives on the server
// (/me/onboarding), which also verifies real-action steps and grants «Getting Started».
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ONBOARDING_TOURS, type OnboardingState, type OnboardingTour } from '@bg/contracts';
import { cn, useToast } from '@bg/ui';
import { Button } from '@bg/ui/bgv';
import { api, ApiFailure } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';

interface Active { tour: OnboardingTour; index: number }
interface Ctx {
  state: OnboardingState | undefined;
  /** Resume from the first unfinished step, or replay from the start. */
  start: (tourKey: string, mode?: 'resume' | 'replay') => void;
  setDismissed: (tourKey: string, dismissed: boolean) => Promise<void>;
  running: boolean;
}
const OnboardingCtx = createContext<Ctx>({ state: undefined, start: () => {}, setDismissed: async () => {}, running: false });
export const useOnboarding = () => useContext(OnboardingCtx);

const VERIFY_EVERY_MS = 5000;
/** Never cover a game in progress; the guide waits until the player leaves the table. */
const quietPath = (p: string) => p.startsWith('/tables/') || p.startsWith('/login');

/** The open guide survives a reload or a typed URL in this tab (per-tab convenience; progress itself is on the server). */
const ACTIVE_KEY = 'bg.guide';
const readActive = (): Active | null => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(ACTIVE_KEY) ?? 'null') as { tour: string; index: number } | null;
    const tour = ONBOARDING_TOURS.find((t) => t.key === saved?.tour);
    return tour && saved && saved.index < tour.steps.length ? { tour, index: saved.index } : null;
  } catch { return null; }
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { me, status } = useSession();
  const { pathname } = useLocation();
  const toast = useToast();
  const [state, setState] = useState<OnboardingState>();
  const [active, setActive] = useState<Active | null>(readActive);

  useEffect(() => {
    try {
      if (active) sessionStorage.setItem(ACTIVE_KEY, JSON.stringify({ tour: active.tour.key, index: active.index }));
      else sessionStorage.removeItem(ACTIVE_KEY);
    } catch { /* storage blocked: the guide just ends on reload */ }
  }, [active]);

  useEffect(() => {
    setState(undefined);
    if (me) void api<OnboardingState>('/me/onboarding').then(setState, () => { /* guides stay available from /guides */ });
    else if (status !== 'loading') setActive(null);
  }, [me?.id, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback((tourKey: string, mode: 'resume' | 'replay' = 'resume') => {
    const tour = ONBOARDING_TOURS.find((t) => t.key === tourKey);
    if (!tour) return;
    const done = state?.tours.find((t) => t.key === tourKey)?.completedSteps ?? [];
    const first = mode === 'replay' ? 0 : Math.max(0, tour.steps.findIndex((s) => !done.includes(s.key)));
    setActive({ tour, index: first });
  }, [state]);

  const setDismissed = useCallback(async (tourKey: string, dismissed: boolean) => {
    setState(await api<OnboardingState>(`/me/onboarding/${tourKey}`, { method: 'PATCH', body: { dismissed } }));
  }, []);

  /** Record a step on the server; false when a real-action step is not done yet. */
  const record = useCallback(async (tour: OnboardingTour, stepKey: string): Promise<boolean> => {
    try {
      const next = await api<OnboardingState>(`/me/onboarding/${tour.key}/steps/${stepKey}`, { method: 'POST', body: {} });
      setState(next);
      if (next.achievement.grantedAt) window.dispatchEvent(new Event('bg:progress')); // Celebration checks right away
      return true;
    } catch (e) {
      if (e instanceof ApiFailure && e.body.errorCode === 'ONBOARDING_STEP_NOT_DONE') return false;
      throw e;
    }
  }, []);

  const advance = useCallback((a: Active) => {
    if (a.index + 1 < a.tour.steps.length) { setActive({ tour: a.tour, index: a.index + 1 }); return; }
    setActive(null);
    toast('success', `آموزش «${a.tour.titleFa}» کامل شد.`);
  }, [toast]);

  // Walkthrough: path steps finish on arrival; verified steps are re-checked on navigation and every few seconds.
  const step = active?.tour.steps[active.index];
  const checking = useRef(false);
  const tryStep = useCallback(async (manual = false) => {
    if (!active || !step || checking.current) return;
    checking.current = true;
    try {
      if (await record(active.tour, step.key)) advance(active);
      else if (manual) toast('error', 'هنوز انجام نشده است؛ کار خواسته‌شده را انجام دهید و دوباره بررسی کنید.');
    } catch { if (manual) toast('error', 'بررسی ممکن نشد؛ اتصال را بررسی کنید.'); }
    finally { checking.current = false; }
  }, [active, step, record, advance, toast]);

  useEffect(() => {
    if (active?.tour.kind !== 'walkthrough' || !step) return;
    if (step.doneOn && new RegExp(step.doneOn).test(pathname)) void tryStep();
    if (!step.verify) return;
    void tryStep();
    const id = setInterval(() => void tryStep(), VERIFY_EVERY_MS);
    return () => clearInterval(id);
  }, [active, step, pathname, tryStep]);

  return (
    <OnboardingCtx.Provider value={{ state, start, setDismissed, running: !!active }}>
      {children}
      {active && step && !quietPath(pathname) && (
        <TourCard active={active} onClose={() => setActive(null)}
          onSkip={() => { setActive(null); void setDismissed(active.tour.key, true).then(() => toast('success', 'این آموزش رد شد؛ هر وقت خواستید از «راهنما» اجرایش کنید.'), () => {}); }}
          onBack={() => setActive({ tour: active.tour, index: active.index - 1 })}
          onNext={() => { advance(active); record(active.tour, step.key).catch(() => { /* not saved: the tour can be replayed */ }); }}
          onCheck={() => void tryStep(true)} />
      )}
    </OnboardingCtx.Provider>
  );
}


/** Visible element carrying data-tour="target" (the same anchor can exist in the desktop header and the phone dock). */
function useTargetRect(target: string | undefined): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    setRect(null);
    if (!target) return;
    let scrolled = false;
    const tick = () => {
      const visible = (t: string) => [...document.querySelectorAll(`[data-tour="${t}"]`)].find((e) => e.getClientRects().length > 0);
      // Nav links missing from the phone dock live under «بیشتر».
      const el = visible(target) ?? (target.startsWith('nav-') ? (visible('nav-more') ?? visible('nav-profile')) : undefined);
      if (el && !scrolled) { scrolled = true; el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      const r = el?.getBoundingClientRect() ?? null;
      setRect((old) => (old && r && old.x === r.x && old.y === r.y && old.width === r.width && old.height === r.height) || (!old && !r) ? old : r);
    };
    tick();
    const id = setInterval(tick, 300); // pages load lazily and lists reflow; cheap enough while a guide is open
    window.addEventListener('resize', tick);
    window.addEventListener('scroll', tick, true);
    return () => { clearInterval(id); window.removeEventListener('resize', tick); window.removeEventListener('scroll', tick, true); };
  }, [target]);
  return rect;
}

const GAP = 12;
const PAD = 6;

function TourCard({ active, onClose, onSkip, onBack, onNext, onCheck }: {
  active: Active; onClose: () => void; onSkip: () => void; onBack: () => void; onNext: () => void; onCheck: () => void;
}) {
  const { tour, index } = active;
  const step = tour.steps[index]!;
  const navigate = useNavigate();
  const rect = useTargetRect(step.target);
  const card = useRef<HTMLDivElement>(null);
  const isTour = tour.kind === 'tour';
  const last = index === tour.steps.length - 1;

  // Desktop: beside the highlighted element (below, else above). Phones: a bottom sheet above the dock (CSS).
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    if (!matchMedia('(min-width: 640px)').matches) {
      // Phone sheet covers the bottom of the screen: add that much scroll room so nothing stays hidden under it.
      el.style.top = ''; el.style.left = '';
      const room = `${el.offsetHeight + 16}px`;
      document.body.style.paddingBottom = room;
      document.documentElement.style.scrollPaddingBottom = room;
      return;
    }
    if (!rect) { el.style.top = ''; el.style.left = ''; return; }
    const w = el.offsetWidth, h = el.offsetHeight;
    const clampX = (x: number) => Math.min(Math.max(8, x), innerWidth - w - 8);
    const clampY = (y: number) => Math.min(Math.max(8, y), innerHeight - h - 8);
    const edge = PAD + GAP;
    let top: number, left: number;
    if (rect.bottom + edge + h <= innerHeight - 8) { top = rect.bottom + edge; left = clampX(rect.left + rect.width / 2 - w / 2); }
    else if (rect.top - edge - h >= 8) { top = rect.top - edge - h; left = clampX(rect.left + rect.width / 2 - w / 2); }
    // Tall target (a form, a list): beside it, so the card never covers what the player has to use.
    else if (rect.left - edge - w >= 8) { top = clampY(rect.top); left = rect.left - edge - w; }
    else if (rect.right + edge + w <= innerWidth - 8) { top = clampY(rect.top); left = rect.right + edge; }
    else { top = innerHeight - h - 8; left = 8; }
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [rect, index]);

  useEffect(() => () => { document.body.style.paddingBottom = ''; document.documentElement.style.scrollPaddingBottom = ''; }, []);
  useEffect(() => { if (isTour) card.current?.querySelector<HTMLButtonElement>('.tour-card__actions button')?.focus({ preventScroll: true }); }, [isTour, index]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {rect && <div className={cn('hm-tour-spot', !isTour && 'hm-tour-spot--soft')} aria-hidden
        style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />}
      <div ref={card} role="dialog" aria-modal="false" aria-labelledby="tour-h" className={cn('bgv-popover hm-tour bgv-stack', !rect && 'hm-tour--center')} style={{ gap: 12 }}>
        <div className="bgv-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <span className="hm-meta">{tour.titleFa}<span className="bgv-sep" />مرحله‌ی {faNum(index + 1)} از {faNum(tour.steps.length)}</span>
          <Button variant="ghost" iconOnly icon="x" size="sm" onClick={onClose}>بستن (بعداً ادامه می‌دهم)</Button>
        </div>
        <h2 id="tour-h" className="t-title" style={{ margin: 0 }}>{step.titleFa}</h2>
        <p style={{ margin: 0 }} aria-live="polite">{step.bodyFa}</p>
        <div className="hm-tour__dots" aria-hidden>{tour.steps.map((s, i) => <span key={s.key} className={cn(i <= index && 'is-on')} />)}</div>
        <div className="hm-tour__actions tour-card__actions">
          {isTour ? (
            <>
              <Button size="sm" variant="primary" onClick={onNext}>{last ? 'تمام' : 'بعدی'}</Button>
              {index > 0 && <Button size="sm" variant="secondary" onClick={onBack}>قبلی</Button>}
            </>
          ) : (
            <>
              {step.href && <Button size="sm" variant="primary" onClick={() => navigate(step.href!)}>برو</Button>}
              {step.verify && <Button size="sm" variant="secondary" onClick={onCheck}>انجام دادم، بررسی کن</Button>}
            </>
          )}
          <Button size="sm" variant="ghost" style={{ marginInlineStart: 'auto' }} onClick={onSkip}>رد کردن آموزش</Button>
        </div>
      </div>
    </>
  );
}

const HINTS_KEY = 'bg.hints.seen';
const seenHints = (): string[] => { try { return JSON.parse(localStorage.getItem(HINTS_KEY) ?? '[]') as string[]; } catch { return []; } };

/** Contextual help next to a feature: tap/click «?» for a short note. A dot marks hints this device has not opened yet. */
export function Hint({ id, children, label = 'راهنما' }: { id: string; children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(() => !seenHints().includes(id));
  const box = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const toggle = () => {
    setOpen((o) => !o);
    if (fresh) {
      setFresh(false);
      try { localStorage.setItem(HINTS_KEY, JSON.stringify([...seenHints(), id])); } catch { /* storage blocked: the dot returns next visit */ }
    }
  };
  return (
    <span ref={box} className="hm-hint">
      <Button variant="ghost" size="sm" iconOnly icon="circle-help" aria-expanded={open} aria-describedby={open ? tipId : undefined} onClick={toggle}>{label}</Button>
      {fresh && <span className="bgv-dot hm-hint__dot" aria-hidden />}
      {open && <span id={tipId} role="tooltip" className="bgv-popover hm-hint__tip">{children}</span>}
    </span>
  );
}
