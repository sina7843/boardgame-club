import { useState } from 'react';
import { Button, Icon, Sheet } from '@bg/ui/bgv';
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
      <Sheet aria-label="خبرتان کنیم؟"
        footer={<>
          <Button variant="primary" block icon="bell" onClick={async () => { await setBrowserNotifications(true); done(); }}>اجازه‌ی اعلان</Button>
          <Button variant="secondary" block onClick={done}>فعلاً نه</Button>
        </>}>
        <div className="np">
          <span className="np__icon"><Icon name="bell" /></span>
          <h2 className="t-title np__title">وقتی نوبت شما شد، خبرتان کنیم؟</h2>
          <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>اگر نوبتی بازی می‌کنید، مرورگر می‌تواند حتی وقتی این برگه در پس‌زمینه است خبرتان کند.</p>
          <ul className="np__list">
            <li><Icon name="play" size="sm" />وقتی نوبت شما شروع می‌شود</li>
            <li><Icon name="alarm-clock" size="sm" />یادآوری وقتی مهلت رو به پایان است</li>
            <li><Icon name="trophy" size="sm" />وقتی بازی تمام می‌شود</li>
          </ul>
          <p className="t-caption bgv-muted np__note"><Icon name="lock" size="sm" />اعلان‌ها هیچ اطلاعات پنهان بازی (کارت‌ها یا متن پیام‌ها) را نشان نمی‌دهند. هر وقت خواستید از تنظیمات خاموشش کنید.</p>
        </div>
      </Sheet>
    </div>
  );
}
