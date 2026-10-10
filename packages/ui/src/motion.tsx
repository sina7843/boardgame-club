// Shared game motion: one timing/easing language for every board, and a FLIP hook so pieces and cards glide from where
// they were to where they are now (hand → table, deck → hand, square → square) instead of jumping.
//
// Usage in a renderer:
//   const root = useRef<HTMLDivElement>(null);
//   useFlip(root, view.seq);                                   // re-measure after every state change
//   <div ref={root}> … <Card data-flip={`card-${id}`} /> … <div data-flip-anchor="deck" /> …
//   <Card data-flip={`card-${id}`} data-flip-from="deck" />   // a new card flies in from the deck instead of fading in
//
// Exits: `data-flip-exit="<anchor>"` (or "drop") makes a card that disappears without reappearing elsewhere fly to that
// anchor instead of vanishing. Dice: any `.bg-roll` element that newly appears is thrown on the top layer.
//
// Rules: a `data-flip` id must be unique in the root and stable for the same physical thing. On SVG, put `data-flip` on
// a <g> that has no `transform` attribute of its own (wrap it), because the animation drives the CSS transform.
// Motion is skipped when the user asked for reduced motion (system setting, or data-motion="reduce" on <html>).
import './motion.css';
import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Easing and durations shared by all games (ms). */
export const MOTION = {
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)', // ease-out quint: quick start, soft landing
  move: 560,
  deal: 640,
  enter: 380,
  roll: 980
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
  const w = n.offsetWidth || to.w, h = n.offsetHeight || to.h;
  const ghost = htmlGhost(n);
  const remove = mount(ghost, { x: to.x + to.w / 2 - w / 2, y: to.y + to.h / 2 - h / 2, w, h }, 'fly');
  n.style.visibility = 'hidden';
  const dx = from.x + from.w / 2 - (to.x + to.w / 2), dy = from.y + from.h / 2 - (to.y + to.h / 2);
  const a = ghost.animate(frames(dx, dy, to.w ? from.w / to.w : 1, to.h ? from.h / to.h : 1), { ...opts, composite: 'add' });
  const done = () => { remove(); n.style.visibility = ''; };
  a.finished.then(done, done);
}

/**
 * A card that left and exists nowhere else (discarded, trashed, given away face down): its ghost — prepared while it
 * was still on screen — flies from where it was to the `data-flip-exit` anchor, or drops and fades for "drop".
 */
function exitFly(ghost: HTMLElement | SVGSVGElement, from: Box, to: Box | undefined) {
  const remove = mount(ghost, from, 'exit');
  const frames: Keyframe[] = to
    ? [{ transform: 'none', opacity: 1 }, { transform: `translate(${to.x + to.w / 2 - (from.x + from.w / 2)}px, ${to.y + to.h / 2 - (from.y + from.h / 2)}px) scale(${to.w && from.w ? Math.min(1.2, to.w / from.w) : 0.7}) rotate(6deg)`, opacity: 0.25 }]
    : [{ transform: 'none', opacity: 1 }, { transform: 'translate(0, 40px) scale(0.85) rotate(-6deg)', opacity: 0 }];
  const a = ghost.animate(frames, { duration: to ? MOTION.move + 80 : MOTION.enter + 60, easing: MOTION.ease, fill: 'forwards' });
  a.finished.then(remove, remove);
}

const LAYER_Z = '2147483000';
const layerHost = () => document.fullscreenElement ?? document.body;

/** Detached copy of an HTML element that keeps its look outside its own container (computed style inlined). */
function htmlGhost(n: HTMLElement): HTMLElement {
  const ghost = n.cloneNode(true) as HTMLElement;
  const cs = getComputedStyle(n);
  for (let i = 0; i < cs.length; i++) { const p = cs.item(i); ghost.style.setProperty(p, cs.getPropertyValue(p)); }
  ghost.removeAttribute('data-flip');
  ghost.setAttribute('aria-hidden', 'true');
  return ghost;
}

/** Paint properties copied onto SVG clones, because class selectors scoped to the board no longer match outside it. */
const SVG_PAINT = ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'filter', 'font-size', 'font-weight', 'font-family', 'color', 'display'];

/** A standalone <svg> in screen space that draws a copy of `n` exactly where it is now. */
function svgGhost(n: SVGGraphicsElement, at: Box): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(at.w)); svg.setAttribute('height', String(at.h));
  svg.setAttribute('overflow', 'visible'); svg.setAttribute('aria-hidden', 'true');
  const clone = n.cloneNode(true) as SVGGraphicsElement;
  const src = [n, ...Array.from(n.querySelectorAll('*'))], dst = [clone, ...Array.from(clone.querySelectorAll('*'))];
  src.forEach((s, i) => { const cs = getComputedStyle(s); const d = dst[i] as SVGElement; for (const p of SVG_PAINT) d.style.setProperty(p, cs.getPropertyValue(p)); });
  clone.removeAttribute('transform'); clone.removeAttribute('class'); clone.style.animation = 'none';
  const m = n.getScreenCTM();
  const g = document.createElementNS(NS, 'g');
  if (m) g.setAttribute('transform', `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e - at.x} ${m.f - at.y})`);
  g.appendChild(clone); svg.appendChild(g);
  return svg;
}

/** Put a ghost in the fixed top layer over `at`; returns a cleanup that removes it. */
function mount(ghost: HTMLElement | SVGSVGElement, at: Box, kind: 'fly' | 'die' | 'exit'): () => void {
  ghost.setAttribute('data-motion-ghost', kind); // lets tests see which kind of top-layer motion ran
  ghost.setAttribute('inert', ''); // a flying copy is never clickable or focusable
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    position: 'fixed', left: `${at.x}px`, top: `${at.y}px`, right: 'auto', bottom: 'auto', width: `${at.w}px`, height: `${at.h}px`,
    margin: '0', zIndex: LAYER_Z, pointerEvents: 'none', transition: 'none', animation: 'none', visibility: 'visible', transformOrigin: '50% 50%'
  });
  layerHost().appendChild(ghost);
  return () => ghost.remove();
}

/**
 * Dice: a `.bg-roll` element that newly appeared is thrown on the top layer (tumbling in from above, a bounce and a
 * settle), so the board, other pieces and `overflow: hidden` containers can never cover or clip it. The real die is
 * hidden until the throw lands. Without useFlip the plain CSS `.bg-roll` animation is the fallback.
 */
function throwDie(n: HTMLElement | SVGGraphicsElement) {
  const at = box(n);
  if (!at.w || !at.h) return;
  const ghost = n instanceof HTMLElement ? htmlGhost(n) : svgGhost(n, at);
  if (ghost instanceof HTMLElement) ghost.classList.remove('bg-roll');
  const remove = mount(ghost, at, 'die');
  n.style.animation = 'none';
  n.style.visibility = 'hidden';
  const i = Number(getComputedStyle(n).getPropertyValue('--i')) || 0;
  const reach = Math.max(at.w, at.h) * 3;
  const a = ghost.animate([
    { transform: `translate(${-reach * 0.6}px, ${-reach}px) rotate(-540deg) scale(0.55)`, opacity: 0 },
    { opacity: 1, offset: 0.15 },
    { transform: 'translate(4%, 7%) rotate(16deg) scale(1.08)', offset: 0.6 },
    { transform: 'translate(0, -6%) rotate(-6deg) scale(0.97)', offset: 0.78 },
    { transform: 'translate(0, 1%) rotate(2deg) scale(1.01)', offset: 0.9 },
    { transform: 'none', opacity: 1 }
  ], { duration: MOTION.roll, delay: i * 110, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)', fill: 'backwards' });
  const done = () => { remove(); n.style.visibility = ''; };
  a.finished.then(done, done);
}

/** The value `v` had at the previous `key` (e.g. view.seq); stable across re-renders within the same key. Undefined at first. */
export function usePrevious<T>(key: unknown, v: T): T | undefined {
  const r = useRef<{ key: unknown; cur: T; prev: T | undefined }>({ key, cur: v, prev: undefined });
  if (r.current.key !== key) r.current = { key, cur: v, prev: r.current.cur };
  return r.current.prev;
}

/**
 * Animate every `[data-flip]` element under `root` from its previous on-screen box to its current one whenever `key`
 * changes. Elements that are new get an entrance: from their `data-flip-from` anchor (`[data-flip-anchor]`) if given,
 * otherwise a short fade-and-rise. The first render never animates.
 */
export function useFlip(root: RefObject<HTMLElement | null>, key: unknown) {
  const prev = useRef<Map<string, Box> | null>(null);
  const exits = useRef<Map<string, { ghost: HTMLElement | SVGSVGElement; to: string }>>(new Map());
  const scrolled = useRef({ x: 0, y: 0 });
  const seenDice = useRef<WeakSet<Element>>(new WeakSet());
  useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    const nodes = Array.from(host.querySelectorAll<HTMLElement | SVGGraphicsElement>('[data-flip]'));
    const anchors = new Map<string, Box>();
    host.querySelectorAll('[data-flip-anchor]').forEach((a) => anchors.set((a as HTMLElement).dataset.flipAnchor!, box(a)));
    const next = new Map<string, Box>();
    for (const n of nodes) next.set(n.dataset.flip!, box(n));
    // Boxes are viewport-relative: if the page scrolled since the last change, shift the old boxes by the same amount,
    // otherwise every piece would look moved and fly.
    const sx = window.scrollX, sy = window.scrollY;
    const dx = sx - scrolled.current.x, dy = sy - scrolled.current.y;
    scrolled.current = { x: sx, y: sy };
    const before = prev.current && (dx || dy) ? new Map(Array.from(prev.current, ([k, b]) => [k, { ...b, x: b.x - dx, y: b.y - dy }])) : prev.current;
    prev.current = next;
    const leaving = exits.current;
    // Ghosts of exit-marked cards are prepared now, while they are still on screen, for the next change.
    exits.current = new Map();
    const off = motionOff();
    if (!off) for (const n of nodes) {
      if (!n.dataset.flipExit) continue;
      // SVG pieces (map tiles, meeples, structures) get a standalone SVG ghost so they can leave too.
      exits.current.set(n.dataset.flip!, { ghost: n instanceof HTMLElement ? htmlGhost(n) : svgGhost(n, next.get(n.dataset.flip!)!), to: n.dataset.flipExit });
    }
    const dice = Array.from(host.querySelectorAll<HTMLElement | SVGGraphicsElement>('.bg-roll')).filter((d) => !seenDice.current.has(d));
    dice.forEach((d) => seenDice.current.add(d));
    if (!before || off) return;
    for (const d of dice) throwDie(d);
    for (const [id, e] of leaving) {
      const from = before.get(id);
      if (!next.has(id) && from) exitFly(e.ghost, from, e.to === 'drop' ? undefined : anchors.get(e.to));
    }
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
        const opts = { duration: Math.min(MOTION.move + dist * 0.3, 940), easing: MOTION.ease };
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
      } else if (n.dataset.flipEnter !== 'none') {
        // data-flip-enter="none": the element runs its own entrance (e.g. a bg-land class), so no default one here.
        n.animate(
          [{ transform: 'translate(0, 10px) scale(0.92)', opacity: 0 }, { transform: 'translate(0, 0) scale(1)', opacity: 1 }],
          { duration: MOTION.enter, delay: Math.min(delay, 210), easing: MOTION.ease, composite: 'add', fill: 'backwards' }
        );
      }
    }
  }, [root, key]);
}
