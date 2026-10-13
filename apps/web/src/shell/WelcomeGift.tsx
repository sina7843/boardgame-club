// Launch gift reveal: after a login that granted the free premium days, a wrapped box waits for the player to open it.
// The grant itself is server-side (login response); this only remembers, for this tab, that there is a box to open.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button, Confetti } from '@bg/ui';
import { faNum } from '../lib/format.ts';

const KEY = 'bg.welcomeGift';
export const stashGift = (days: number) => { try { sessionStorage.setItem(KEY, String(days)); } catch { /* storage blocked: no reveal, premium is still granted */ } };
/** Read without consuming (effects may run twice); the box is cleared only once the player closes it. */
const readGift = () => { try { const d = Number(sessionStorage.getItem(KEY)); return d > 0 ? d : 0; } catch { return 0; } };
const clearGift = () => { try { sessionStorage.removeItem(KEY); } catch { /* storage blocked */ } };

function GiftBox({ open }: { open: boolean }) {
  return (
    <svg className={`gift ${open ? 'gift--open' : ''}`} viewBox="0 0 200 200" aria-hidden>
      <defs>
        <linearGradient id="gift-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9b5cf0" /><stop offset="1" stopColor="#6a35c4" /></linearGradient>
        <linearGradient id="gift-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b583ff" /><stop offset="1" stopColor="#8a4ee6" /></linearGradient>
        <linearGradient id="gift-ribbon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe08a" /><stop offset="1" stopColor="#e0a826" /></linearGradient>
      </defs>
      <ellipse cx="100" cy="186" rx="62" ry="8" fill="rgb(0 0 0 / 0.25)" />
      <g className="gift__glow"><circle cx="100" cy="92" r="46" fill="#fff6c8" /></g>
      <rect x="38" y="92" width="124" height="90" rx="8" fill="url(#gift-body)" />
      <rect x="38" y="92" width="124" height="14" fill="rgb(0 0 0 / 0.15)" />
      <rect x="88" y="92" width="24" height="90" fill="url(#gift-ribbon)" />
      <g className="gift__lid">
        <rect x="30" y="70" width="140" height="28" rx="7" fill="url(#gift-lid)" />
        <rect x="88" y="70" width="24" height="28" fill="url(#gift-ribbon)" />
        <path d="M100 70 C 78 38, 50 46, 62 64 C 70 74, 92 72, 100 70 Z" fill="url(#gift-ribbon)" />
        <path d="M100 70 C 122 38, 150 46, 138 64 C 130 74, 108 72, 100 70 Z" fill="url(#gift-ribbon)" />
        <circle cx="100" cy="69" r="8" fill="#e0a826" />
      </g>
    </svg>
  );
}

export function WelcomeGift() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [days, setDays] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  // Wait until the player has left the login/profile step, then show the box once.
  useEffect(() => { if (!days && pathname !== '/login') setDays(readGift()); }, [pathname, days]);
  useEffect(() => { if (days && ref.current && !ref.current.open) ref.current.showModal(); }, [days]);
  if (!days) return null;
  const close = () => { clearGift(); ref.current?.close(); setDays(0); setOpen(false); };

  return (
    <dialog ref={ref} className="celebrate celebrate--gift" aria-labelledby="gift-h" onClose={close}>
      <div className="celebrate__card">
        <div className="celebrate__rays" aria-hidden />
        {open && <Confetti count={90} spreadX={280} seed={days} className="celebrate__confetti" colors={['#f5c542', '#22b5b0', '#9b5cf0', '#ffffff', 'var(--brand)']} />}
        <p className="celebrate__eyebrow">{open ? 'هدیهٔ افتتاح' : 'یک هدیه برای شما!'}</p>
        {/* Pointer shortcut; keyboard and screen readers use the «باز کردن هدیه» button. */}
        <div className={`gift-btn ${open ? 'gift-btn--done' : ''}`} aria-hidden onClick={() => setOpen(true)}>
          <GiftBox open={open} />
        </div>
        {open ? (
          <div className="gift-reveal">
            <h2 id="gift-h" className="celebrate__title">تبریک! {faNum(days)} روز اشتراک پریمیوم رایگان بردید</h2>
            <p className="celebrate__desc">همهٔ بازی‌های پریمیوم برای شما باز است. خوش آمدید!</p>
            <div className="celebrate__actions">
              <Button variant="primary" autoFocus onClick={() => { close(); navigate('/games'); }}>بزن بریم بازی</Button>
              <Button variant="ghost" onClick={() => { close(); navigate('/plans'); }}>اشتراک من</Button>
            </div>
          </div>
        ) : (
          <>
            <h2 id="gift-h" className="celebrate__title">جعبه را باز کنید</h2>
            <p className="celebrate__desc">روی جعبه بزنید تا ببینید چه برده‌اید.</p>
            <div className="celebrate__actions"><Button variant="primary" autoFocus onClick={() => setOpen(true)}>باز کردن هدیه</Button></div>
          </>
        )}
      </div>
    </dialog>
  );
}
