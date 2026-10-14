import { useState } from 'react';
import { Button, Sheet } from '@bg/ui/bgv';
import { browserNotificationsEnabled, setBrowserNotifications } from '../lib/realtime.tsx';

const ASKED = 'bg.notifyAsked';
const asked = () => { try { return localStorage.getItem(ASKED) === '1'; } catch { return true; } };

/**
 * «خبرتان کنیم؟»: asks once per device, in context (a turn-based table), before the browser's own permission prompt.
 * The browser prompt only opens from the button; «فعلاً نه» is remembered and Settings can turn it on later.
 */
export function NotifyPrompt() {
  const [open, setOpen] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'default' && !browserNotificationsEnabled() && !asked());
  if (!open) return null;
  const done = () => { try { localStorage.setItem(ASKED, '1'); } catch { /* storage unavailable */ } setOpen(false); };
  return (
    <div className="tbl-overlay" onClick={(e) => { if (e.target === e.currentTarget) done(); }}>
      <Sheet title="خبرتان کنیم؟" icon="bell" onClose={done} closeLabel="فعلاً نه"
        footer={<>
          <Button variant="primary" block onClick={async () => { await setBrowserNotifications(true); done(); }}>اجازه‌ی اعلان</Button>
          <Button variant="ghost" block onClick={done}>فعلاً نه</Button>
        </>}>
        <p className="t-body-sm" style={{ margin: 0 }}>وقتی نوبت شما شد یا مهلت رو به پایان است، مرورگر خبرتان می‌کند؛ حتی اگر این برگه در پس‌زمینه باشد. اعلان‌ها هیچ اطلاعات پنهان بازی را نشان نمی‌دهند.</p>
      </Sheet>
    </div>
  );
}
