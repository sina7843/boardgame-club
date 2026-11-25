import { useState } from 'react';
import { Button, Icon, Sheet } from '@bg/ui/bgv';
import { browserNotificationsEnabled, setBrowserNotifications } from '../lib/realtime.tsx';
import { iosNeedsInstall } from '../lib/push.ts';

const ASKED = 'bg.notifyAsked';
const asked = () => { try { return localStorage.getItem(ASKED) === '1'; } catch { return true; } };

/**
 * «خبرتان کنیم؟»: asks once per device, in context (a turn-based table), before the browser's own permission prompt.
 * The browser prompt only opens from the button; «فعلاً نه» is remembered and Settings can turn it on later.
 */
export function NotifyPrompt() {
  // iPhone Safari outside the home screen has no notifications at all: explain installing first.
  const [ios] = useState(iosNeedsInstall);
  const [open, setOpen] = useState(() => !asked() && (ios || (typeof Notification !== 'undefined' && Notification.permission === 'default' && !browserNotificationsEnabled())));
  if (!open) return null;
  const done = () => { try { localStorage.setItem(ASKED, '1'); } catch { /* storage unavailable */ } setOpen(false); };
  if (ios) return (
    <div className="tbl-overlay" onClick={(e) => { if (e.target === e.currentTarget) done(); }}>
      <Sheet aria-label="افزودن به صفحهٔ اصلی" footer={<Button variant="primary" block onClick={done}>متوجه شدم</Button>}>
        <div className="np">
          <span className="np__icon"><Icon name="house" /></span>
          <h2 className="t-title np__title">برای اعلان، اول سایت را نصب کنید</h2>
          <p className="t-body-sm bgv-muted np__title">آیفون فقط به سایتی که روی صفحهٔ اصلی نصب شده اعلان می‌دهد.</p>
          <ul className="np__list">
            <li><Icon name="share-2" size="sm" />در سافاری دکمهٔ «اشتراک‌گذاری» را بزنید</li>
            <li><Icon name="plus" size="sm" />«افزودن به صفحهٔ اصلی» را انتخاب کنید</li>
            <li><Icon name="bell" size="sm" />سایت را از همان آیکون باز کنید و از تنظیمات اعلان را روشن کنید</li>
          </ul>
        </div>
      </Sheet>
    </div>
  );
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
