// Zoomable game board: buttons, ctrl/⌘ + wheel and two-finger pinch zoom (1×–4×), drag to pan while zoomed, full
// screen (phones in landscape get the whole screen). Taps and clicks on board targets still work: a press only becomes
// a pan after it moves a few pixels, and that press's click is then swallowed.
import './zoom.css';
import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { fa } from './components.tsx';

const MIN = 1, MAX = 4, STEP = 1.4, DRAG = 6;
type View = { s: number; x: number; y: number };

export function ZoomBoard({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<View>({ s: 1, x: 0, y: 0 });
  const [full, setFull] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start: View; d0: number; mx: number; my: number; px: number; py: number; moved: boolean } | null>(null);
  const swallow = useRef(false);

  /** Keep the content covering the viewport: never pan past an edge. */
  const clamp = useCallback((n: View): View => {
    const el = box.current;
    if (!el) return n;
    const s = Math.min(MAX, Math.max(MIN, n.s));
    const w = el.clientWidth, h = el.clientHeight;
    return { s, x: Math.min(0, Math.max(w - w * s, n.x)), y: Math.min(0, Math.max(h - h * s, n.y)) };
  }, []);
  /** Zoom to scale `s` keeping the point (px, py) of the viewport fixed. */
  const zoomAt = useCallback((from: View, s: number, px: number, py: number) => {
    const k = Math.min(MAX, Math.max(MIN, s)) / from.s;
    return clamp({ s: from.s * k, x: px - (px - from.x) * k, y: py - (py - from.y) * k });
  }, [clamp]);
  const center = () => ({ x: (box.current?.clientWidth ?? 0) / 2, y: (box.current?.clientHeight ?? 0) / 2 });
  const step = (dir: 1 | -1) => setV((cur) => { const c = center(); return zoomAt(cur, dir > 0 ? cur.s * STEP : cur.s / STEP, c.x, c.y); });

  // Wheel needs a non-passive listener to stop page zoom/scroll; only ctrl/⌘ + wheel zooms, plain wheel scrolls the page.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setV((cur) => zoomAt(cur, cur.s * Math.exp(-e.deltaY / 300), e.clientX - r.left, e.clientY - r.top));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onChange = () => { setFull(document.fullscreenElement === box.current?.parentElement); setV((cur) => clamp(cur)); };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('resize', onChange);
    return () => { document.removeEventListener('fullscreenchange', onChange); window.removeEventListener('resize', onChange); };
  }, [clamp]);

  const rel = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const startGesture = () => {
    const ps = [...pointers.current.values()];
    const mx = ps.reduce((a, p) => a + p.x, 0) / ps.length, my = ps.reduce((a, p) => a + p.y, 0) / ps.length;
    const d0 = ps.length > 1 ? Math.hypot(ps[0]!.x - ps[1]!.x, ps[0]!.y - ps[1]!.y) : 0;
    gesture.current = { start: v, d0, mx, my, px: mx, py: my, moved: gesture.current?.moved ?? false };
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, rel(e));
    swallow.current = false;
    if (pointers.current.size === 1) gesture.current = null;
    startGesture();
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, rel(e));
    const g = gesture.current;
    const ps = [...pointers.current.values()];
    const mx = ps.reduce((a, p) => a + p.x, 0) / ps.length, my = ps.reduce((a, p) => a + p.y, 0) / ps.length;
    if (!g.moved && Math.hypot(mx - g.px, my - g.py) < DRAG && ps.length < 2) return;
    if (ps.length < 2 && g.start.s === 1) return; // not zoomed: let the page scroll
    if (!g.moved) { g.moved = true; box.current?.setPointerCapture(e.pointerId); }
    swallow.current = true;
    if (ps.length > 1 && g.d0 > 0) {
      const d = Math.hypot(ps[0]!.x - ps[1]!.x, ps[0]!.y - ps[1]!.y);
      const z = zoomAt(g.start, g.start.s * (d / g.d0), g.mx, g.my);
      setV(clamp({ ...z, x: z.x + (mx - g.mx), y: z.y + (my - g.my) }));
    } else {
      setV(clamp({ ...g.start, x: g.start.x + (mx - g.mx), y: g.start.y + (my - g.my) }));
    }
  };
  const onPointerUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) startGesture();
    else gesture.current = null;
  };

  // Double tap / click on the board (not on a target) toggles 2× at that point and back.
  const onDoubleClick = (e: MouseEvent) => {
    if ((e.target as Element).closest('[role="button"], button')) return;
    const p = rel(e);
    setV((cur) => (cur.s > 1 ? { s: 1, x: 0, y: 0 } : zoomAt(cur, 2, p.x, p.y)));
  };

  const toggleFull = async () => {
    const host = box.current?.parentElement;
    if (!host) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await host.requestFullscreen();
        // Phones: prefer landscape for the board where the browser allows it (ignored elsewhere).
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => undefined);
      }
    } catch { /* full screen not available (e.g. iOS Safari): the board still zooms */ }
  };
  const canFull = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;

  return (
    <div className={['zb', full ? 'zb--full' : '', v.s > 1 ? 'zb--zoomed' : '', className ?? ''].join(' ')}>
      <div ref={box} className="zb__viewport" role="group" aria-label={`${label}، بزرگ‌نمایی ${fa(Math.round(v.s * 100))}٪`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onClickCapture={(e) => { if (swallow.current) { e.stopPropagation(); e.preventDefault(); swallow.current = false; } }}
        onDoubleClick={onDoubleClick}>
        <div className="zb__content" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.s})` }}>{children}</div>
      </div>
      <div className="zb__controls" role="toolbar" aria-label="بزرگ‌نمایی نقشه">
        <button type="button" onClick={() => step(1)} disabled={v.s >= MAX} aria-label="بزرگ‌نمایی" title="بزرگ‌نمایی">+</button>
        <button type="button" onClick={() => step(-1)} disabled={v.s <= MIN} aria-label="کوچک‌نمایی" title="کوچک‌نمایی">−</button>
        <button type="button" onClick={() => setV({ s: 1, x: 0, y: 0 })} disabled={v.s === 1} aria-label="اندازه اصلی" title="اندازه اصلی">⟲</button>
        {canFull && <button type="button" onClick={toggleFull} aria-pressed={full} aria-label={full ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'} title={full ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}>{full ? '⤡' : '⤢'}</button>}
      </div>
      {v.s > 1 && <p className="zb__tip" aria-hidden="true">برای جابه‌جایی بکشید · دو بار ضربه برای اندازه اصلی</p>}
    </div>
  );
}
