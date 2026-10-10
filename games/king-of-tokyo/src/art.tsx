// Art for غول‌های شهر: painted monster portraits, chunky vector dice glyphs.
import type { ReactNode } from 'react';
import type { Face } from './rules.ts';
import dragon from './art/m-dragon.webp';
import robot from './art/m-robot.webp';
import gorilla from './art/m-gorilla.webp';
import sea from './art/m-sea.webp';
import bat from './art/m-bat.webp';
import dino from './art/m-dino.webp';

// Monster paintings and the city backdrop are cut from a generated sheet (see DECISIONS.md).
const PORTRAITS = [dragon, robot, gorilla, sea, bat, dino]; // renderer MONSTERS order

export function Monster({ k, className = '' }: { k: number; className?: string }) {
  return <img src={PORTRAITS[k % 6]} className={`kt-art ${className}`} alt="" aria-hidden="true" draggable={false} />;
}

const num = (n: string, c: string) => <text x="32" y="46" textAnchor="middle" className={`d-num ${c}`}>{n}</text>;
const GLYPH: Record<Face, ReactNode> = {
  '1': num('۱', 'd-ink'), '2': num('۲', 'd-ink'), '3': num('۳', 'd-ink'),
  heart: <path d="M32 54C10 38 12 16 24 16c5 0 8 3 8 6 0-3 3-6 8-6 12 0 14 22-8 38Z" className="d-heart" />,
  bolt: <path d="M37 8 16 36h12l-4 20 24-30H35Z" className="d-bolt" />,
  claw: <path d="M14 10C24 22 24 40 18 56M30 8C40 22 40 42 34 58M46 10C54 24 54 40 50 54" className="d-claw" />,
};

export function DieGlyph({ f }: { f: Face }) {
  return <svg viewBox="0 0 64 64" className="kt-glyph" data-pip aria-hidden="true">{GLYPH[f]}</svg>;
}

export const Bolt = () => <svg viewBox="0 0 24 24" className="kt-bolt" aria-hidden="true"><path d="M14 2 5 14h6l-2 8 10-13h-6Z" fill="currentColor" stroke="#14102a" strokeWidth="1.6" strokeLinejoin="round" /></svg>;
