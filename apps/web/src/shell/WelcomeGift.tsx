// Launch gift reveal: after a login that granted the free premium days, a wrapped box waits for the player to open it.
// The grant itself is server-side (login response); this only remembers, for this tab, that there is a box to open.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Confetti } from '@bg/ui';
import { Button, Dialog, Icon } from '@bg/ui/bgv';
import { faNum } from '../lib/format.ts';

const KEY = 'bg.welcomeGift';
export const stashGift = (days: number) => { try { sessionStorage.setItem(KEY, String(days)); } catch { /* storage blocked: no reveal, premium is still granted */ } };
/** Read without consuming (effects may run twice); the box is cleared only once the player closes it. */
const readGift = () => { try { const d = Number(sessionStorage.getItem(KEY)); return d > 0 ? d : 0; } catch { return 0; } };
const clearGift = () => { try { sessionStorage.removeItem(KEY); } catch { /* storage blocked */ } };

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
      <Dialog>
        <div className="hm-celebrate">
          {open && <Confetti count={90} spreadX={280} seed={days} className="celebrate__confetti" colors={['var(--accent)', 'var(--primary)', 'var(--invite)', 'var(--success)', 'var(--surface)']} />}
          <p className="hm-celebrate__eyebrow">{open ? 'هدیه‌ی افتتاح' : 'یک هدیه برای شما!'}</p>
          {/* Pointer shortcut; keyboard and screen readers use the «باز کردن هدیه» button. */}
          <div className="hm-gift" aria-hidden onClick={() => setOpen(true)}><Icon name="gift" style={{ inlineSize: 72, blockSize: 72 }} /></div>
          {open ? (
            <>
              <h2 id="gift-h" className="t-h3" style={{ margin: 0 }}>تبریک! {faNum(days)} روز اشتراک پریمیوم رایگان بردید</h2>
              <p className="hm-celebrate__desc">همه‌ی بازی‌های پریمیوم برای شما باز است. خوش آمدید!</p>
              <div className="hm-celebrate__actions">
                <Button variant="primary" block autoFocus onClick={() => { close(); navigate('/games'); }}>بزن بریم بازی</Button>
                <Button variant="ghost" block onClick={() => { close(); navigate('/plans'); }}>اشتراک من</Button>
              </div>
            </>
          ) : (
            <>
              <h2 id="gift-h" className="t-h3" style={{ margin: 0 }}>جعبه را باز کنید</h2>
              <p className="hm-celebrate__desc">روی جعبه بزنید تا ببینید چه برده‌اید.</p>
              <div className="hm-celebrate__actions"><Button variant="primary" block autoFocus onClick={() => setOpen(true)}>باز کردن هدیه</Button></div>
            </>
          )}
        </div>
      </Dialog>
    </dialog>
  );
}
