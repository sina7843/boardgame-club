// Shared game motion: one timing/easing language for every board, and a FLIP hook so pieces and cards glide from where
// they were to where they are now (hand → table, deck → hand, square → square) instead of jumping.
//
// Usage in a renderer:
//   const root = useRef<HTMLDivElement>(null);
//   useFlip(root, view.seq);                                   // re-measure after every state change
//   <div ref={root}> … <Card data-flip={`card-${id}`} /> … <div data-flip-anchor="deck" /> …
//   <Card data-flip={`card-${id}`} data-flip-from="deck" />   // a new card flies in from the deck instead of fading in
//
// Rules: a `data-flip` id must be unique in the root and stable for the same physical thing. On SVG, put `data-flip` on
// a <g> that has no `transform` attribute of its own (wrap it), because the animation drives the CSS transform.
// Motion is skipped when the user asked for reduced motion (system setting, or data-motion="reduce" on <html>).
import './motion.css';
import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Easing and durations shared by all games (ms). */
export const MOTION = {
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)', // ease-out quint: quick start, soft landing
  move: 420,
  deal: 480,
  enter: 300
} as const;

export function motionOff(): boolean {
  if (typeof document === 'undefined') return true;
  const pref = document.documentElement.dataset.motion;
  if (pref === 'reduce') return true;
  if (pref === 'full') return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type Box = { x: number; y: number; w: number; h: number };
const box = (el: Element): Box => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };

/** Screen px → the element's own CSS-transform units (SVG content is scaled by its viewBox). */
function unit(el: Element): number {
  if (el instanceof SVGGraphicsElement) {
    const m = el.parentElement instanceof SVGGraphicsElement ? el.parentElement.getScreenCTM() : el.ownerSVGElement?.getScreenCTM();
    return m ? Math.hypot(m.a, m.b) || 1 : 1;
  }
  return 1;
}

/**
 * Fly an HTML element from `from` to its current box in a fixed layer above the page, so containers with
 * `overflow: hidden` (tables, scrolling hands) cannot clip it mid-flight. The real element stays hidden until it lands.
 * The copy carries the element's computed style (its look does not depend on where it is mounted).
 */
function fly(n: HTMLElement, from: Box, to: Box, frames: (dx: number, dy: number, sx: number, sy: number) => Keyframe[], opts: KeyframeAnimationOptions) {
  const ghost = n.cloneNode(true) as HTMLElement;
  const cs = getComputedStyle(n);
  for (let i = 0; i < cs.length; i++) { const p = cs.item(i); ghost.style.setProperty(p, cs.getPropertyValue(p)); }
  const w = n.offsetWidth || to.w, h = n.offsetHeight || to.h;
  Object.assign(ghost.style, {
    position: 'fixed', left: `${to.x + to.w / 2 - w / 2}px`, top: `${to.y + to.h / 2 - h / 2}px`, right: 'auto', bottom: 'auto', width: `${w}px`, height: `${h}px`,
    margin: '0', zIndex: '2147483000', pointerEvents: 'none', transition: 'none', animation: 'none', visibility: 'visible'
  });
  ghost.removeAttribute('data-flip');
  ghost.setAttribute('aria-hidden', 'true');
  (document.fullscreenElement ?? document.body).appendChild(ghost);
  n.style.visibility = 'hidden';
  const dx = from.x + from.w / 2 - (to.x + to.w / 2), dy = from.y + from.h / 2 - (to.y + to.h / 2);
  const a = ghost.animate(frames(dx, dy, to.w ? from.w / to.w : 1, to.h ? from.h / to.h : 1), { ...opts, composite: 'add' });
  const done = () => { ghost.remove(); n.style.visibility = ''; };
  a.finished.then(done, done);
}

/**
 * Animate every `[data-flip]` element under `root` from its previous on-screen box to its current one whenever `key`
 * changes. Elements that are new get an entrance: from their `data-flip-from` anchor (`[data-flip-anchor]`) if given,
 * otherwise a short fade-and-rise. The first render never animates.
 */
export function useFlip(root: RefObject<HTMLElement | null>, key: unknown) {
  const prev = useRef<Map<string, Box> | null>(null);
  useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    const nodes = Array.from(host.querySelectorAll<HTMLElement | SVGGraphicsElement>('[data-flip]'));
    const anchors = new Map<string, Box>();
    host.querySelectorAll('[data-flip-anchor]').forEach((a) => anchors.set((a as HTMLElement).dataset.flipAnchor!, box(a)));
    const next = new Map<string, Box>();
    for (const n of nodes) next.set(n.dataset.flip!, box(n));
    const before = prev.current;
    prev.current = next;
    if (!before || motionOff()) return;
    let i = 0;
    for (const n of nodes) {
      const id = n.dataset.flip!;
      const to = next.get(id)!;
      const from = before.get(id);
      const k = unit(n);
      if (from) {
        const dx = (from.x + from.w / 2 - (to.x + to.w / 2)) / k, dy = (from.y + from.h / 2 - (to.y + to.h / 2)) / k;
        const sx = to.w ? from.w / to.w : 1, sy = to.h ? from.h / to.h : 1;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.03 && Math.abs(sy - 1) < 0.03) continue;
        const dist = Math.hypot(dx * k, dy * k);
        const opts = { duration: Math.min(MOTION.move + dist * 0.25, 720), easing: MOTION.ease };
        const move = (x: number, y: number, a: number, b: number): Keyframe[] => [{ transform: `translate(${x}px, ${y}px) scale(${a}, ${b})` }, { transform: 'translate(0, 0) scale(1, 1)' }];
        // Long hops between zones fly above the page; short slides (and SVG pieces) move in place.
        if (n instanceof HTMLElement && dist > 48) fly(n, from, to, move, opts);
        else n.animate(move(dx, dy, sx, sy), { ...opts, composite: 'add' });
        continue;
      }
      const src = n.dataset.flipFrom ? anchors.get(n.dataset.flipFrom) : undefined;
      const delay = Math.min(i++, 8) * 70;
      if (src && n instanceof HTMLElement) {
        fly(n, src, to, (x, y) => [{ transform: `translate(${x}px, ${y}px) scale(0.6) rotate(-8deg)`, opacity: 0.2 }, { opacity: 1, offset: 0.35 }, { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 }],
          { duration: MOTION.deal, delay, easing: MOTION.ease, fill: 'backwards' });
      } else if (src) {
        const dx = (src.x + src.w / 2 - (to.x + to.w / 2)) / k, dy = (src.y + src.h / 2 - (to.y + to.h / 2)) / k;
        n.animate(
          [{ transform: `translate(${dx}px, ${dy}px) scale(0.6) rotate(-8deg)`, opacity: 0.2 }, { opacity: 1, offset: 0.35 }, { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 }],
          { duration: MOTION.deal, delay, easing: MOTION.ease, composite: 'add', fill: 'backwards' }
        );
      } else {
        n.animate(
          [{ transform: 'translate(0, 10px) scale(0.92)', opacity: 0 }, { transform: 'translate(0, 0) scale(1)', opacity: 1 }],
          { duration: MOTION.enter, delay: Math.min(delay, 210), easing: MOTION.ease, composite: 'add', fill: 'backwards' }
        );
      }
    }
  }, [root, key]);
}
